import { useEffect, useMemo, useState } from "react";
import { wfetch, ensureKey } from "@/lib/windsor";
import { acctOf, fmtMoney } from "@/lib/format";
import { BENCH_BASE, BENCH_OPT_TIERS, TT_TIERS, G_PAGE, gEmbedUrl, gOpenUrl, parseCampaign, parseCampaignTT, bnum, bstat } from "@/lib/benchmark";
import Pills from "@/components/Pills.jsx";
import DateRange from "@/components/DateRange.jsx";
import MultiSelect from "@/components/MultiSelect.jsx";
import RecoList from "@/components/RecoList.jsx";

const MODES = [
  { value: "cost", label: "FB Cost per" },
  { value: "rate", label: "FB Result Rate" },
  { value: "ttcost", label: "TT Cost per" },
  { value: "ttrate", label: "TT Result Rate" },
  { value: "gcost", label: "Google Cost per" },
  { value: "gresult", label: "Google Result" },
];

// formatters
const fMoney = (v) => "฿" + v.toLocaleString("en-US", { maximumFractionDigits: 2 });
const fPct = (v) => (v * 100).toFixed(2) + "%";
const fNum = (v) => v.toLocaleString("en-US", { maximumFractionDigits: 2 });

const MAIN = [
  { k: "cpm", l: "CPM", f: fMoney }, { k: "cpr", l: "CPR / 1K reach", f: fMoney }, { k: "cpv", l: "CPV", f: fMoney },
  { k: "cptp", l: "CP Thruplay", f: fMoney }, { k: "cpc", l: "CPC", f: fMoney }, { k: "cpe", l: "CPE", f: fMoney },
];
const MSG = [
  { k: "cpmsg", l: "CP MSG", f: fMoney, obj: "Message" }, { k: "cpvc", l: "CP View Content", f: fMoney, obj: "CPAS" },
  { k: "cpatc", l: "CP ATC", f: fMoney, obj: "CPAS" }, { k: "cppur", l: "CP Purchase", f: fMoney, obj: "CPAS" },
];
const RATE = [
  { k: "vr3", l: "VR% (3s)", f: fPct, hi: 1 }, { k: "vrtp", l: "VR% (Thruplay)", f: fPct, hi: 1 },
  { k: "ctr", l: "CTR", f: fPct, hi: 1 }, { k: "er", l: "ER%", f: fPct, hi: 1 },
  { k: "freq", l: "Frequency", f: fNum }, { k: "octr", l: "Outbound CTR", f: fPct, hi: 1 },
];
const TT_MAIN = [
  { k: "cpm", l: "CPM", f: fMoney }, { k: "cpr", l: "CPR / 1K reach", f: fMoney },
  { k: "cpc", l: "CPC", f: fMoney }, { k: "freq", l: "Frequency", f: fNum },
];
const TT_VIDEO = [
  { k: "cpv", l: "CPV", f: fMoney }, { k: "cpv6", l: "CPV (6s)", f: fMoney }, { k: "cpv15", l: "CPV (15s)", f: fMoney },
];
const TT_RATE = [
  { k: "vr2", l: "VR% (2s)", f: fPct, hi: 1 }, { k: "vr6", l: "VR% (6s)", f: fPct, hi: 1 },
  { k: "vr15", l: "VR% (15s)", f: fPct, hi: 1 }, { k: "ctr", l: "CTR", f: fPct, hi: 1 }, { k: "freq", l: "Frequency", f: fNum },
];

const METR = ["spend", "impressions", "reach", "clicks", "video", "v6s", "v15s", "octrc", "thruplay", "engage", "msg", "atc", "purchase", "viewc"];
const SUBS = ["avg", "min", "max", "med"];

// heatmap ต่อคอลัมน์ — cost: ต่ำ=เขียว ; rate(hi): สูง=เขียว
function heat(v, range, hi) {
  if (v == null || !v || !isFinite(v) || !range) return undefined;
  if (range.max === range.min) return { background: "hsl(145,52%,93%)" };
  let t = Math.max(0, Math.min(1, (v - range.min) / (range.max - range.min)));
  if (hi) t = 1 - t;
  return { background: `hsl(${Math.round(145 - 137 * t)},58%,${92 - t * 3}%)` };
}

export default function Benchmark({ active }) {
  const today = new Date().toISOString().slice(0, 10);
  const [mode, setMode] = useState("cost");
  const [range, setRange] = useState({ from: "2025-01-01", to: today });
  const [fb, setFb] = useState({ rows: [], loaded: false });
  const [tt, setTt] = useState({ rows: [], loaded: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState({ objective: [], brand: [], material: [] });
  const [reload, setReload] = useState(0);

  const isTT = mode.startsWith("tt");
  const isGoogle = mode === "gcost" || mode === "gresult";

  /* ---- โหลด FB benchmark ---- */
  const loadFB = async () => {
    if (!ensureKey(false)) { setError("ยังไม่มี API key — กดปุ่ม 🔑 Key"); return; }
    const { from } = range, to = range.to || today;
    setLoading(true); setError("");
    try {
      let data = null, lastStatus = 0, lastBody = "";
      for (const o of BENCH_OPT_TIERS) {
        const f = BENCH_BASE + (o ? "," + o : "");
        try {
          const res = await wfetch(`date_from=${from}&date_to=${to}&fields=${f}`, "facebook", 120000);
          if (res.ok) { data = (await res.json()).data || []; break; }
          lastStatus = res.status; lastBody = (await res.text()).slice(0, 200);
          if ([400, 401, 403].includes(lastStatus) && /key|auth|token|unauthor|permission/i.test(lastBody)) break;
        } catch (err) { lastBody = (err && err.message) || String(err); } // timeout/network → ลอง tier ถัดไป (field น้อยลง)
      }
      if (data === null) throw new Error(`Windsor ไม่ตอบ/ปฏิเสธทุกชุด field (HTTP ${lastStatus}: ${lastBody || "—"}) — ลองลดช่วงวันที่ให้สั้นลง`);
      const rows = data.map((r) => {
        const p = parseCampaign(r.campaign);
        const sp = +r.spend || 0;
        // Windsor ให้ cost_per_* มาแล้ว → แปลงกลับเป็นจำนวน result (count = spend / cost_per)
        // เพื่อรวมข้ามแถวได้ถูกต้อง (สุดท้าย cpv = Σspend / Σcount) ; ไม่มี → fallback raw count
        const fromCost = (costKeys, rawKeys) => { const cp = bnum(r, costKeys); return cp > 0 ? sp / cp : bnum(r, rawKeys); };
        return {
          account: acctOf(r), campaign: r.campaign || "(ไม่ระบุแคมเปญ)",
          brand: p.brand, objective: p.objective, material: p.material,
          spend: sp, impressions: +r.impressions || 0, reach: +r.reach || 0, clicks: +r.clicks || 0,
          video: fromCost(["cost_per_action_type_video_view"], ["video_views", "video_view", "actions_video_view"]), v6s: 0, v15s: 0,
          octrc: bnum(r, ["outbound_clicks_outbound_click", "outbound_clicks"]),
          thruplay: fromCost(["cost_per_thruplay_video_view"], ["video_thruplay_watched_actions", "thruplays", "thruplay"]),
          engage: fromCost(["cost_per_action_type_page_engagement"], ["post_engagement", "post_engagements", "page_engagement"]),
          msg: bnum(r, ["actions_onsite_conversion_messaging_conversation_started_7d", "actions_onsite_conversion_messaging_conversation_started"]),
          atc: bnum(r, ["actions_omni_add_to_cart", "actions_add_to_cart"]),
          purchase: bnum(r, ["actions_omni_purchase", "actions_purchase"]),
          viewc: bnum(r, ["actions_omni_view_content", "actions_view_content"]),
        };
      });
      setFb({ rows, loaded: true });
    } catch (e) {
      setError(`❌ โหลด benchmark ไม่สำเร็จ: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  /* ---- โหลด TikTok benchmark ---- */
  const loadTT = async () => {
    if (!ensureKey(false)) { setError("ยังไม่มี API key — กดปุ่ม 🔑 Key"); return; }
    const { from } = range, to = range.to || today;
    setLoading(true); setError("");
    try {
      let data = null, lastStatus = 0, lastBody = "";
      for (const f of TT_TIERS) {
        try {
          const res = await wfetch(`date_from=${from}&date_to=${to}&fields=${f}`, "tiktok", 120000);
          if (res.ok) { data = (await res.json()).data || []; break; }
          lastStatus = res.status; lastBody = (await res.text()).slice(0, 200);
          if ([400, 401, 403].includes(lastStatus) && /key|auth|token|unauthor|permission/i.test(lastBody)) break;
        } catch (err) { lastBody = (err && err.message) || String(err); }
      }
      if (data === null) throw new Error(`Windsor (tiktok) ไม่ตอบ/ปฏิเสธทุกชุด field (HTTP ${lastStatus}: ${lastBody || "—"})`);
      const rows = data.map((r) => {
        const name = r.campaign || r.campaign_name || "(ไม่ระบุแคมเปญ)";
        const p = parseCampaignTT(name);
        return {
          campaign: name, brand: p.brand, objective: p.objective, material: p.material,
          spend: +r.spend || 0, impressions: +r.impressions || 0, reach: +r.reach || 0, clicks: +r.clicks || 0,
          video: bnum(r, ["play_duration_2s"]), v6s: bnum(r, ["play_duration_6s"]), v15s: bnum(r, ["focused_view_15s"]),
          octrc: 0, thruplay: 0, engage: 0, msg: 0, atc: 0, purchase: 0, viewc: 0,
        };
      });
      setTt({ rows, loaded: true });
    } catch (e) {
      setError(`❌ โหลด TikTok benchmark ไม่สำเร็จ: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!active || isGoogle) return;
    if (isTT && !tt.loaded) loadTT();
    else if (!isTT && !fb.loaded) loadFB();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, mode, reload]);

  const src = isTT ? tt.rows : fb.rows;

  const filterOptions = useMemo(() => {
    const uniq = (arr) => [...new Set(arr)].filter((x) => x && x !== "(ไม่ระบุ)").sort((a, b) => a.localeCompare(b));
    return {
      objective: uniq(src.map((r) => r.objective)),
      brand: uniq(src.map((r) => r.brand)),
      material: uniq(src.map((r) => r.material)),
    };
  }, [src]);

  const view = useMemo(() => {
    const inSel = (arr, v) => !arr.length || arr.includes(v);
    const rows = src.filter((r) => inSel(filter.objective, r.objective) && inSel(filter.brand, r.brand) && inSel(filter.material, r.material));
    if (!rows.length) return null;
    const byCamp = {};
    rows.forEach((r) => {
      const c = byCamp[r.campaign] || (byCamp[r.campaign] = { campaign: r.campaign, brand: r.brand, objective: r.objective, material: r.material, spend: 0, impressions: 0, reach: 0, clicks: 0, video: 0, v6s: 0, v15s: 0, octrc: 0, thruplay: 0, engage: 0, msg: 0, atc: 0, purchase: 0, viewc: 0 });
      METR.forEach((m) => (c[m] += +r[m] || 0));
    });
    const camps = Object.values(byCamp);
    camps.forEach((c) => {
      const im = c.impressions;
      c._cost = {
        cpm: im ? (c.spend / im) * 1000 : 0, cpr: c.reach ? (c.spend / c.reach) * 1000 : 0,
        cpv: c.video ? c.spend / c.video : 0, cpv6: c.v6s ? c.spend / c.v6s : 0, cpv15: c.v15s ? c.spend / c.v15s : 0,
        cptp: c.thruplay ? c.spend / c.thruplay : 0,
        cpc: c.clicks ? c.spend / c.clicks : 0, cpe: c.engage ? c.spend / c.engage : 0,
        cpmsg: c.msg ? c.spend / c.msg : 0, cpvc: c.viewc ? c.spend / c.viewc : 0,
        cpatc: c.atc ? c.spend / c.atc : 0, cppur: c.purchase ? c.spend / c.purchase : 0,
        // --- Result Rate (อัตราต่อ impressions) ---
        vr3: im ? c.video / im : 0, vrtp: im ? c.thruplay / im : 0, ctr: im ? c.clicks / im : 0,
        er: im ? c.engage / im : 0, freq: c.reach ? im / c.reach : 0, octr: im ? c.octrc / im : 0,
        // TikTok result rate (2s/6s/15s ÷ impressions)
        vr2: im ? c.video / im : 0, vr6: im ? c.v6s / im : 0, vr15: im ? c.v15s / im : 0,
      };
    });
    const byBrand = {};
    camps.forEach((c) => { (byBrand[c.brand] = byBrand[c.brand] || []).push(c); });
    const brands = Object.keys(byBrand).sort((a, b) => a.localeCompare(b));
    const brandSpend = (b) => byBrand[b].reduce((s, c) => s + c.spend, 0);
    const topBrands = [...brands].sort((a, b) => brandSpend(b) - brandSpend(a));
    const campSorted = [...camps].sort((a, b) => b.spend - a.spend);
    return { camps, byBrand, brands, topBrands, campSorted };
  }, [src, filter]);

  const rangeLabel = isGoogle
    ? `${mode === "gcost" ? "Google Cost per Result" : "Google Result Rate"} · รายงาน Looker Studio (ฝังจากเว็บจริง)`
    : loading
      ? `กำลังโหลด… (${range.from} → ${range.to || today})`
      : isTT
        ? `TikTok Cost per Result · ${range.from} → ${range.to || today} · ${tt.rows.length} แถว`
        : `Cost per Result แยกตามแบรนด์ · ${range.from} → ${range.to || today} · ${fb.rows.length} แถว`;

  const doReload = () => {
    if (isGoogle) return;
    if (isTT) setTt((s) => ({ ...s, loaded: false }));
    else setFb((s) => ({ ...s, loaded: false }));
    setReload((n) => n + 1);
  };

  return (
    <section>
      <div className="bid-head">
        <div>
          <h1>📊 Ad <span className="accent">Benchmark</span></h1>
          <div className="sub">{rangeLabel}</div>
        </div>
        <div className="controls">
          <DateRange from={range.from} to={range.to} onApply={(f, t) => { setRange({ from: f, to: t }); doReload(); }} />
          <button className="btn-primary" onClick={doReload}>↻ รีเฟรช</button>
        </div>
      </div>

      <Pills
        options={MODES}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setFilter({ objective: [], brand: [], material: [] }); // reset ตัวกรองตอนสลับแหล่งข้อมูล
        }}
        style={{ marginBottom: 18 }}
      />

      {!isGoogle && (
        <div className="bench-filters">
          <label>Objective<MultiSelect options={filterOptions.objective} selected={filter.objective} onChange={(v) => setFilter((f) => ({ ...f, objective: v }))} /></label>
          <label>Brand name<MultiSelect options={filterOptions.brand} selected={filter.brand} onChange={(v) => setFilter((f) => ({ ...f, brand: v }))} /></label>
          <label>Material type<MultiSelect options={filterOptions.material} selected={filter.material} onChange={(v) => setFilter((f) => ({ ...f, material: v }))} /></label>
        </div>
      )}

      {isGoogle ? (
        <GoogleEmbed mode={mode} />
      ) : loading ? (
        <div className="loading">กำลังดึงข้อมูล{isTT ? " TikTok " : ""}จาก Windsor… ({range.from} → {range.to || today}) · ช่วงยาวอาจใช้เวลาสักครู่</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : !view ? (
        <div className="bench-empty">ไม่พบข้อมูลตามตัวกรองที่เลือก</div>
      ) : mode === "ttcost" ? (
        <TTCost view={view} />
      ) : mode === "ttrate" ? (
        <TTRate view={view} />
      ) : mode === "rate" ? (
        <FBRate view={view} />
      ) : (
        <FBCost view={view} />
      )}
    </section>
  );
}

function GoogleEmbed({ mode }) {
  const pg = G_PAGE[mode];
  const title = mode === "gcost" ? "Google Cost per Result" : "Google Result Rate";
  return (
    <>
      <div className="g-embed-bar">
        <span>📊 {title} — ฝังจาก Google Looker Studio (ข้อมูล Google ไม่ได้ผ่าน Windsor จึงแสดงรายงานจริงแทน)</span>
        <a href={gOpenUrl(pg)} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ padding: "9px 15px", borderRadius: 4, textDecoration: "none" }}>↗ เปิดในแท็บใหม่</a>
      </div>
      <iframe className="g-embed" src={gEmbedUrl(pg)} allowFullScreen title={title} />
      <div className="g-embed-note">ถ้ารายงานไม่แสดง = ยังไม่ได้เปิดสิทธิ์ฝังใน Looker Studio (File → Embed report → เปิด Enable embedding) หรือกด "เปิดในแท็บใหม่" แทน</div>
    </>
  );
}

/* ---- ตารางสรุปต่อแบรนด์ (Avg/Min/Max/Med + heatmap + grand total) ---- */
function BrandTable({ metrics, view }) {
  const { byBrand, topBrands, camps } = view;
  const pick = (list, m) => list.filter((c) => !m.obj || c.objective === m.obj); // บาง metric นับเฉพาะ objective ที่กำหนด
  const mx = topBrands.map((b) => ({ b, stats: metrics.map((m) => bstat(pick(byBrand[b], m).map((c) => c._cost[m.k]))) }));
  const ranges = metrics.map((m, mi) => {
    const r = {};
    SUBS.forEach((s) => {
      const vals = mx.map((x) => x.stats[mi] && x.stats[mi][s]).filter((v) => v != null && v > 0 && isFinite(v));
      r[s] = vals.length ? { min: Math.min(...vals), max: Math.max(...vals) } : null;
    });
    return r;
  });
  const gq = metrics.map((m) => bstat(pick(camps, m).map((c) => c._cost[m.k])));
  const HCell = ({ v, style, cls, f }) =>
    v == null || !v || !isFinite(v)
      ? <td className={"na" + (cls || "")}>—</td>
      : <td className={"num" + (cls || "")} style={style}>{(f || fMoney)(v)}</td>;

  return (
    <div className="bench-scroll">
      <table className="bench">
        <thead>
          <tr>
            <th rowSpan={2} className="rn">#</th>
            <th rowSpan={2} className="bcol">Brand</th>
            {metrics.map((m) => <th key={m.k} className="grp gsep" colSpan={4}>{m.l}</th>)}
          </tr>
          <tr>
            {metrics.map((m) => (
              <FragmentRow key={m.k} />
            ))}
          </tr>
        </thead>
        <tbody>
          {mx.map((x, i) => (
            <tr key={x.b}>
              <td className="rn">{i + 1}</td>
              <td className="bcol">{x.b}</td>
              {metrics.map((m, mi) =>
                SUBS.map((s, si) => {
                  const st = x.stats[mi], gs = si === 0 ? " gsep" : "";
                  return st
                    ? <HCell key={m.k + s} v={st[s]} style={heat(st[s], ranges[mi][s], m.hi)} cls={gs} f={m.f} />
                    : <td key={m.k + s} className={"na" + gs}>—</td>;
                })
              )}
            </tr>
          ))}
          <tr className="grand">
            <td className="rn"></td>
            <td className="bcol">Grand total</td>
            {metrics.map((m, mi) => {
              const s = gq[mi];
              return s ? (
                <FragmentCells key={m.k} s={s} f={m.f} />
              ) : (
                <FragmentNa key={m.k} />
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// แถว header ชั้นสอง (Avg/Min/Max/Med) ต่อ 1 metric
function FragmentRow() {
  return (<><th className="gsep">Avg</th><th>Min</th><th>Max</th><th>Med</th></>);
}
function FragmentCells({ s, f }) {
  return (<><td className="num gsep">{f(s.avg)}</td><td className="num">{f(s.min)}</td><td className="num">{f(s.max)}</td><td className="num">{f(s.med)}</td></>);
}
function FragmentNa() {
  return (<><td className="na gsep">—</td><td className="na">—</td><td className="na">—</td><td className="na">—</td></>);
}

const Cell = ({ v, f }) =>
  v == null || !v || !isFinite(v) ? <td className="na">—</td> : <td className="num">{(f || fMoney)(v)}</td>;

/* AI Recommend — สรุปค่าเฉลี่ย benchmark ต่อ metric ไว้อ้างอิงตอน report แบรนด์ */
function BenchReco({ view, metrics }) {
  const { camps, byBrand, brands } = view;
  const recos = metrics
    .map((m) => {
      const f = m.f;
      const vals = camps.map((c) => c._cost[m.k]).filter((v) => v > 0 && isFinite(v));
      if (!vals.length) return null;
      const avg = vals.reduce((s, x) => s + x, 0) / vals.length;
      const sorted = [...vals].sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)];
      const bAvg = brands
        .map((b) => { const bv = byBrand[b].map((c) => c._cost[m.k]).filter((v) => v > 0 && isFinite(v)); return bv.length ? { b, v: bv.reduce((s, x) => s + x, 0) / bv.length } : null; })
        .filter(Boolean);
      bAvg.sort((a, b) => (m.hi ? b.v - a.v : a.v - b.v)); // เรียง "ดีสุด" ก่อน (rate=สูง, cost=ต่ำ)
      const best = bAvg[0];
      const above = bAvg.filter((x) => (m.hi ? x.v > avg : x.v < avg)).length;
      const cmp = m.hi ? "เหนือค่าเฉลี่ย" : "ถูกกว่าค่าเฉลี่ย";
      return {
        level: "info", ic: "📊", title: m.l,
        detail: (
          <>Benchmark เฉลี่ย <b>{f(avg)}</b> · มัธยฐาน {f(med)} · {brands.length} แบรนด์ ({above} แบรนด์{cmp}){best ? <> · ดีสุด: {best.b} ({f(best.v)})</> : null}</>
        ),
      };
    })
    .filter(Boolean);
  return (
    <div className="panel bench-panel">
      <RecoList
        heading="AI Recommend — Benchmark อ้างอิง"
        sub="ค่าเฉลี่ย benchmark ต่อ metric (จากข้อมูลตามตัวกรองปัจจุบัน) ใช้เป็นเกณฑ์อ้างอิงเวลา report แต่ละแบรนด์ว่าเหนือ/ต่ำกว่าค่ากลาง"
        recos={recos}
        style={{ marginTop: 0, borderTop: 0, paddingTop: 0 }}
      />
    </div>
  );
}

function FBCost({ view }) {
  const { brands, camps, campSorted } = view;
  return (
    <>
      <div className="panel bench-panel">
        <div className="panel-head"><h3>Cost Per Result by Brand</h3><span className="bench-count">{brands.length} แบรนด์ · {camps.length} แคมเปญ · เลื่อนดูได้</span></div>
        <div className="psub">🟢 ถูก → 🔴 แพง (ไล่สีต่อคอลัมน์) · สรุป Avg / Min / Max / Med ต่อแบรนด์ · — = Windsor ไม่มีข้อมูล</div>
        <BrandTable metrics={MAIN} view={view} />
      </div>
      <div className="panel bench-panel">
        <div className="panel-head"><h3>Cost Per Result by Brand (Message &amp; CPAS)</h3><span className="bench-count">{brands.length} แบรนด์ · เลื่อนดูได้</span></div>
        <div className="psub">⚠️ <b>Remark:</b> CP MSG นับเฉพาะแคมเปญ Objective = <b>Message</b> · CP View Content / CP ATC / CP Purchase นับเฉพาะ Objective = <b>CPAS</b> (แบรนด์ที่ไม่มีแคมเปญตรงเงื่อนไขจะขึ้น —)</div>
        <BrandTable metrics={MSG} view={view} />
      </div>
      <div className="panel bench-panel">
        <div className="panel-head"><h3>Campaign</h3><span className="bench-count">{camps.length} แคมเปญ (เรียงตาม Spend · เลื่อนดูได้)</span></div>
        <div className="bench-scroll">
          <table className="bench">
            <thead><tr><th className="rn">#</th><th>Campaign</th><th>Brand</th><th>Objective</th><th>Material type</th><th>Spend</th><th>CPM</th><th>CPV</th></tr></thead>
            <tbody>
              {campSorted.map((c, i) => (
                <tr key={c.campaign}>
                  <td className="rn">{i + 1}</td>
                  <td className="camp" title={c.campaign}>{c.campaign}</td>
                  <td className="txt">{c.brand}</td><td className="txt">{c.objective}</td><td className="camp">{c.material}</td>
                  <td className="num">{fmtMoney(c.spend)}</td><Cell v={c._cost.cpm} /><Cell v={c._cost.cpv} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bench-legend">
        * <b>CP MSG</b> = Cost per Message · <b>CPVC</b> = Cost per View Content (CPAS) · <b>CP ATC</b> = Cost per Add to Cart (CPAS) · <b>CP Purchase</b> = Cost per Purchase (CPAS) · <b>CPR</b> = ต้นทุนต่อ 1,000 reach · <b>AN</b> = Audience Network
      </div>
    </>
  );
}

function FBRate({ view }) {
  const { brands, camps, campSorted } = view;
  return (
    <>
      <div className="panel bench-panel">
        <div className="panel-head"><h3>Result Rate by Brand</h3><span className="bench-count">{brands.length} แบรนด์ · {camps.length} แคมเปญ · เลื่อนดูได้</span></div>
        <div className="psub">🟢 สูง (ดี) → 🔴 ต่ำ · VR% / CTR / ER% / Outbound CTR = อัตราต่อ impressions</div>
        <BrandTable metrics={RATE} view={view} />
      </div>
      <div className="panel bench-panel">
        <div className="panel-head"><h3>Campaign</h3><span className="bench-count">{camps.length} แคมเปญ (เรียงตาม Spend · เลื่อนดูได้)</span></div>
        <div className="bench-scroll">
          <table className="bench">
            <thead><tr><th className="rn">#</th><th>Campaign</th><th>Brand</th><th>Material type</th><th>Spend</th><th>Avg VR% 3s</th><th>Avg VR% Thruplay</th><th>Avg ER%</th><th>Avg CTR</th></tr></thead>
            <tbody>
              {campSorted.map((c, i) => (
                <tr key={c.campaign}>
                  <td className="rn">{i + 1}</td>
                  <td className="camp" title={c.campaign}>{c.campaign}</td>
                  <td className="txt">{c.brand}</td><td className="camp">{c.material}</td>
                  <td className="num">{fmtMoney(c.spend)}</td>
                  <Cell v={c._cost.vr3} f={fPct} /><Cell v={c._cost.vrtp} f={fPct} /><Cell v={c._cost.er} f={fPct} /><Cell v={c._cost.ctr} f={fPct} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <BenchReco view={view} metrics={RATE} />
      <div className="bench-legend">
        * <b>VR% (3s)</b> = 3-sec video views ÷ impressions · <b>VR% (Thruplay)</b> = thruplays ÷ impressions · <b>ER%</b> = engagement ÷ impressions · <b>CTR</b> = clicks ÷ impressions · <b>Frequency</b> = impressions ÷ reach · <b>Outbound CTR</b> = outbound clicks ÷ impressions
      </div>
    </>
  );
}

function TTCost({ view }) {
  const { brands, camps, campSorted } = view;
  return (
    <>
      <div className="panel bench-panel">
        <div className="panel-head"><h3>Cost Per Result by Brand — TikTok</h3><span className="bench-count">{brands.length} แบรนด์ · {camps.length} แคมเปญ · เลื่อนดูได้</span></div>
        <div className="psub">🟢 ถูก → 🔴 แพง · CPM / CPR / CPC / Frequency (จาก spend · impressions · reach · clicks ของ TikTok)</div>
        <BrandTable metrics={TT_MAIN} view={view} />
      </div>
      <div className="panel bench-panel">
        <div className="panel-head"><h3>Cost Per Result by Brand — Video (TikTok)</h3><span className="bench-count">{brands.length} แบรนด์</span></div>
        <div className="psub">🟢 ถูก → 🔴 แพง · CPV = spend ÷ play 2s · CPV (6s) = spend ÷ play 6s · CPV (15s) = spend ÷ focused view 15s</div>
        <BrandTable metrics={TT_VIDEO} view={view} />
      </div>
      <div className="panel bench-panel">
        <div className="panel-head"><h3>Campaign — TikTok</h3><span className="bench-count">{camps.length} แคมเปญ (เรียงตาม Spend · เลื่อนดูได้)</span></div>
        <div className="bench-scroll">
          <table className="bench">
            <thead><tr><th className="rn">#</th><th>Campaign</th><th>Brand</th><th>Material type</th><th>Spend</th><th>CPM</th><th>CPV</th><th>CPC</th></tr></thead>
            <tbody>
              {campSorted.map((c, i) => (
                <tr key={c.campaign}>
                  <td className="rn">{i + 1}</td>
                  <td className="camp" title={c.campaign}>{c.campaign}</td>
                  <td className="txt">{c.brand}</td><td className="camp">{c.material}</td>
                  <td className="num">{fmtMoney(c.spend)}</td><Cell v={c._cost.cpm} /><Cell v={c._cost.cpv} /><Cell v={c._cost.cpc} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bench-legend">
        * TikTok · <b>CPM</b> = spend ÷ impressions ×1000 · <b>CPR</b> = spend ÷ 1,000 reach · <b>CPC</b> = spend ÷ clicks · <b>Frequency</b> = impressions ÷ reach · <b>CPV</b> = spend ÷ play 2s · <b>CPV (6s)</b> = spend ÷ play 6s · <b>CPV (15s)</b> = spend ÷ focused view 15s
      </div>
    </>
  );
}

function TTRate({ view }) {
  const { brands, camps, campSorted } = view;
  const tier = (s) => (s >= 100000 ? "100K+" : s >= 10000 ? "10K+" : s >= 1000 ? "1K+" : "<1K");
  return (
    <>
      <div className="panel bench-panel">
        <div className="panel-head"><h3>Result Rate by Brand — TikTok</h3><span className="bench-count">{brands.length} แบรนด์ · {camps.length} แคมเปญ · เลื่อนดูได้</span></div>
        <div className="psub">🟢 สูง (ดี) → 🔴 ต่ำ · VR% = play ÷ impressions ×100 · CTR = clicks ÷ impressions · Frequency = impressions ÷ reach</div>
        <BrandTable metrics={TT_RATE} view={view} />
      </div>
      <div className="panel bench-panel">
        <div className="panel-head"><h3>Campaign — TikTok</h3><span className="bench-count">{camps.length} แคมเปญ (เรียงตาม Spend · เลื่อนดูได้)</span></div>
        <div className="bench-scroll">
          <table className="bench">
            <thead><tr><th className="rn">#</th><th>Campaign</th><th>Brand</th><th>Material type</th><th>Spend tier</th><th>VR% (2s)</th><th>VR% (6s)</th><th>VR% (15s)</th><th>CTR</th><th>Frequency</th></tr></thead>
            <tbody>
              {campSorted.map((c, i) => (
                <tr key={c.campaign}>
                  <td className="rn">{i + 1}</td>
                  <td className="camp" title={c.campaign}>{c.campaign}</td>
                  <td className="txt">{c.brand}</td><td className="camp">{c.material}</td><td className="txt">{tier(c.spend)}</td>
                  <Cell v={c._cost.vr2} f={fPct} /><Cell v={c._cost.vr6} f={fPct} /><Cell v={c._cost.vr15} f={fPct} /><Cell v={c._cost.ctr} f={fPct} /><Cell v={c._cost.freq} f={fNum} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <BenchReco view={view} metrics={TT_RATE} />
      <div className="bench-legend">
        * TikTok · <b>VR% (2s)</b> = play 2s ÷ impressions · <b>VR% (6s)</b> = play 6s ÷ impressions · <b>VR% (15s)</b> = focused view 15s ÷ impressions · <b>CTR</b> = clicks ÷ impressions · <b>Frequency</b> = impressions ÷ reach
      </div>
    </>
  );
}
