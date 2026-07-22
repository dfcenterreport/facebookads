import { useEffect, useState } from "react";
import { wfetch, ensureKey, USE_PROXY, SRC_COLORS } from "@/lib/windsor";
import { acctOf, norm, fmtMoney } from "@/lib/format";

function SourceDots({ srcs }) {
  return (
    <span className="sdots">
      {srcs.map((s) => (
        <span key={s} className="sdot" style={{ background: SRC_COLORS[s] || SRC_COLORS.other }} title={s} />
      ))}
    </span>
  );
}

export default function Landing({ onSelect }) {
  const [accts, setAccts] = useState(null); // null = ยังไม่โหลด
  const [grand, setGrand] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    if (!ensureKey(false)) {
      setLoading(false);
      setError("ยังไม่มี API key — กดปุ่ม “🔑 Key”");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await wfetch(`date_preset=last_7d&fields=account_name,account_id,source,spend`);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const rows = (await res.json()).data || [];
      const map = {};
      let g = 0;
      rows.forEach((r) => {
        const a = acctOf(r);
        if (!map[a]) map[a] = { name: a, id: r.account_id || "—", spend: 0, srcs: new Set() };
        map[a].spend += +r.spend || 0;
        if (r.source) map[a].srcs.add(norm(r.source));
        g += +r.spend || 0;
      });
      setAccts(Object.values(map).map((v) => ({ ...v, srcs: [...v.srcs] })).sort((a, b) => b.spend - a.spend));
      setGrand(g);
    } catch (e) {
      setError(`❌ โหลดรายชื่อ Account ไม่สำเร็จ: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!accts) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = (accts || []).filter(
    (a) => !q || a.name.toLowerCase().includes(q.toLowerCase()) || String(a.id).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <section className="landing-view">
      <div className="landing-head">
        <div>
          <h1>📊 Windsor Media <span className="accent">Dashboard</span></h1>
          <div className="sub">เลือก Ad Account ที่ต้องการดู เพื่อเข้าสู่หน้า dashboard</div>
        </div>
        {!USE_PROXY && (
          <button onClick={() => { if (ensureKey(true)) { setAccts(null); load(); } }}>🔑 Key</button>
        )}
      </div>
      <div className="land-bar">
        <div className="search">
          🔍<input placeholder="ค้นหาชื่อ Account หรือ ID…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={load}>↻ รีเฟรชข้อมูล</button>
      </div>

      <div>
        {loading ? (
          <div className="loading">กำลังโหลดรายชื่อ Account…</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : (
          <>
            {!q && (
              <div className="acct-row all">
                <div className="acct-ico">📂</div>
                <div className="acct-info">
                  <div className="acct-name">ทุก Ad Account</div>
                  <div className="acct-id">รวมทุกบัญชี · {(accts || []).length} accounts</div>
                </div>
                <div className="acct-meta">
                  <div className="spend">{fmtMoney(grand)}</div>
                  <div className="cap">รวม Spend 7 วัน</div>
                </div>
                <button className="btn-primary" onClick={() => onSelect("__all__")}>เลือก ›</button>
              </div>
            )}
            {list.length === 0 ? (
              <div className="loading">ไม่พบ Account ที่ค้นหา</div>
            ) : (
              list.map((a) => (
                <div className="acct-row" key={a.name}>
                  <div className="acct-ico">📈</div>
                  <div className="acct-info">
                    <div className="acct-name">{a.name}</div>
                    <div className="acct-id">Account ID: {a.id} <SourceDots srcs={a.srcs} /></div>
                  </div>
                  <div className="acct-meta">
                    <div className="spend">{fmtMoney(a.spend)}</div>
                    <div className="cap">Spend 7 วัน</div>
                  </div>
                  <button className="btn-primary" onClick={() => onSelect(a.name)}>เลือก ›</button>
                </div>
              ))
            )}
          </>
        )}
      </div>
      <div className="land-note">ℹ️ หากไม่พบ Account ที่ต้องการ กรุณาตรวจสอบสิทธิ์การเข้าถึงใน Business Manager / Windsor connector ของคุณ</div>
    </section>
  );
}
