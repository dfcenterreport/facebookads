import { useEffect, useMemo, useState } from "react";
import { wfetch, ensureKey } from "@/lib/windsor";
import { acctOf, addDays, weekStart, fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import Pills from "@/components/Pills.jsx";
import DateRange from "@/components/DateRange.jsx";
import { Trend } from "@/components/KpiCard.jsx";
import ChartCanvas, { yellowGradient } from "@/components/ChartCanvas.jsx";

const PRESET_LABEL = { last_7d: "7 วัน", last_14d: "14 วัน", last_30d: "30 วัน", this_month: "เดือนนี้", last_month: "เดือนก่อน", custom: "ช่วงที่เลือก" };
const PRESETS = [
  { value: "last_7d", label: "7 วัน" },
  { value: "last_14d", label: "14 วัน" },
  { value: "last_30d", label: "30 วัน" },
  { value: "this_month", label: "เดือนนี้" },
  { value: "last_month", label: "เดือนก่อน" },
];
const STATUS = [
  { value: "all", label: "ทั้งหมด" },
  { value: "active", label: "🟢 Active" },
  { value: "inactive", label: "⚪ Inactive" },
];

export default function ActiveAccounts() {
  const [preset, setPreset] = useState("last_7d");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [statusFilter, setStatusFilter] = useState("all");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openRows, setOpenRows] = useState(() => new Set());
  const [trendData, setTrendData] = useState(null); // {weeks, weekVals, qLabels, qVals}

  /* ---- รายชื่อบัญชี + สถานะแคมเปญตามช่วงเวลา ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ensureKey(false)) { setError("ยังไม่มี API key"); setLoading(false); return; }
      setLoading(true); setError(""); setOpenRows(new Set());
      const range = preset === "custom" ? `date_from=${custom.from}&date_to=${custom.to}` : `date_preset=${preset}`;
      try {
        const res = await wfetch(`${range}&fields=account_name,campaign,campaign_status,spend`);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const rows = (await res.json()).data || [];
        const map = {};
        rows.forEach((r) => {
          const a = acctOf(r);
          if (!map[a]) map[a] = { name: a, active: false, spend: 0, campaigns: {} };
          const status = (r.campaign_status || "").toUpperCase();
          if (status === "ACTIVE") map[a].active = true;
          map[a].spend += +r.spend || 0;
          const cname = r.campaign || "(ไม่ระบุแคมเปญ)";
          if (!map[a].campaigns[cname]) map[a].campaigns[cname] = { name: cname, status, spend: 0 };
          map[a].campaigns[cname].spend += +r.spend || 0;
          if (status) map[a].campaigns[cname].status = status;
        });
        if (!cancelled) {
          setData(
            Object.values(map)
              .map((v) => ({ ...v, campaigns: Object.values(v.campaigns).sort((a, b) => b.spend - a.spend) }))
              .sort((a, b) => b.spend - a.spend)
          );
        }
      } catch (e) {
        if (!cancelled) setError(`❌ โหลดข้อมูลไม่สำเร็จ: ${e.message}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [preset, custom]);

  /* ---- Weekly / Quarterly trend (โหลดครั้งเดียว) ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ensureKey(false)) return;
      try {
        const res = await wfetch(`date_from=2024-01-01&date_to=2026-12-31&fields=spend,date`);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const rows = (await res.json()).data || [];
        const byWeek = {}, byQuarter = {};
        rows.forEach((r) => {
          if (!r.date) return;
          const wk = weekStart(r.date);
          byWeek[wk] = (byWeek[wk] || 0) + (+r.spend || 0);
          const [y, mo] = r.date.split("-");
          const qk = `${y}-Q${Math.floor((+mo - 1) / 3) + 1}`;
          byQuarter[qk] = (byQuarter[qk] || 0) + (+r.spend || 0);
        });
        const weeks = [];
        for (let w = weekStart("2024-01-01"); w <= "2026-12-31"; w = addDays(w, 7)) weeks.push(w);

        const now = new Date(), curY = now.getFullYear(), curQ = Math.floor(now.getMonth() / 3) + 1;
        const qKeys = [];
        for (let y = 2024; y <= Math.max(curY, 2024); y++) {
          const maxQ = y === curY ? curQ : y < curY ? 4 : 0;
          for (let q = 1; q <= maxQ; q++) qKeys.push(`${y}-Q${q}`);
        }
        if (!cancelled) {
          setTrendData({
            weeks,
            weekVals: weeks.map((w) => byWeek[w] || 0),
            qLabels: qKeys.map((k) => k.replace("-", " ")),
            qVals: qKeys.map((k) => byQuarter[k] || 0),
          });
        }
      } catch (e) { /* เงียบไว้แบบเดิม */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const weeklyConfig = useMemo(() => {
    if (!trendData) return null;
    return {
      type: "line",
      data: {
        labels: trendData.weeks,
        datasets: [{ label: "Spend (฿)", data: trendData.weekVals, borderColor: "#ebc300", backgroundColor: (c) => yellowGradient(c.chart.ctx), fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2.5 }],
      },
      options: {
        responsive: true, interaction: { mode: "index", intersect: false },
        plugins: { legend: { labels: { color: "#6b7178", font: { family: "Work Sans" }, usePointStyle: true, boxWidth: 8 } } },
        scales: {
          x: { ticks: { color: "#969A9E", font: { family: "JetBrains Mono", size: 10 } }, grid: { display: false } },
          y: { ticks: { color: "#969A9E", font: { family: "JetBrains Mono", size: 10 } }, grid: { color: "#E2E4E6" } },
        },
      },
    };
  }, [trendData]);

  const quarterConfig = useMemo(() => {
    if (!trendData) return null;
    const values = trendData.qVals;
    const diffs = values.map((v, i) => (i === 0 || !values[i - 1] ? null : ((v - values[i - 1]) / values[i - 1]) * 100));
    const diffLabelPlugin = {
      id: "diffLabels",
      afterDatasetsDraw(chart) {
        const meta = chart.getDatasetMeta(0);
        const ctx = chart.ctx;
        ctx.save();
        ctx.font = "600 11px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        meta.data.forEach((bar, i) => {
          const d = diffs[i];
          if (d === null) return;
          const up = d >= 0;
          ctx.fillStyle = up ? "#16a34a" : "#ba1a1a";
          ctx.fillText(`${up ? "▲" : "▼"} ${up ? "+" : "-"}${Math.abs(d).toFixed(1)}%`, bar.x, bar.y - 8);
        });
        ctx.restore();
      },
    };
    return {
      type: "bar",
      data: {
        labels: trendData.qLabels,
        datasets: [{ label: "Spend (฿)", data: values, backgroundColor: "#FDD205", borderRadius: 4, maxBarThickness: 56 }],
      },
      options: {
        responsive: true,
        layout: { padding: { top: 24 } },
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#969A9E", font: { family: "JetBrains Mono", size: 10 } }, grid: { display: false } },
          y: { ticks: { color: "#969A9E", font: { family: "JetBrains Mono", size: 10 } }, grid: { color: "#E2E4E6" } },
        },
      },
      plugins: [diffLabelPlugin],
    };
  }, [trendData]);

  const list = data.filter((a) => statusFilter === "all" || (statusFilter === "active" ? a.active : !a.active));
  const total = list.reduce((s, a) => s + a.spend, 0);
  const periodLabel = PRESET_LABEL[preset] || "";
  const toggleRow = (i) => setOpenRows((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  return (
    <section>
      <div className="landing-head">
        <div>
          <h1 style={{ marginBottom: 6 }}>Active Ad account</h1>
          <div className="sub">สถานะบัญชีโฆษณาทั้งหมด (Active / Inactive)</div>
        </div>
        <div className="kpi primary" style={{ minWidth: 190 }}>
          <div className="klabel">Total Budget</div>
          <div className="kval">{fmtMoney(total)}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
        <Pills options={STATUS} value={statusFilter} onChange={setStatusFilter} />
        <Pills options={PRESETS} value={preset === "custom" ? "" : preset} onChange={(v) => { setPreset(v); setCustom({ from: "", to: "" }); }} />
        <DateRange from={custom.from} to={custom.to} onApply={(f, t) => { setCustom({ from: f, to: t }); setPreset("custom"); }} />
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head"><h3>Weekly Spend Trend (2024–2026)</h3></div>
        <div className="psub">ยอด Spend รวมรายสัปดาห์ของทุก Ad Account</div>
        {weeklyConfig && <ChartCanvas config={weeklyConfig} />}
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head"><h3>Quarterly Budget Comparison</h3></div>
        <div className="psub">เปรียบเทียบ Spend รายไตรมาส (QoQ % diff)</div>
        {quarterConfig && <ChartCanvas config={quarterConfig} />}
        {trendData && (
          <div className="kpis" style={{ marginTop: 16 }}>
            {trendData.qLabels.map((l, i) => (
              <div className="kpi" key={l}>
                <div className="klabel">{l}</div>
                <div className="kval">{fmtMoney(trendData.qVals[i])}</div>
                <div className="ktrend">
                  <Trend cur={trendData.qVals[i]} prev={i > 0 ? trendData.qVals[i - 1] : null} vsText="vs ไตรมาสก่อน" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading">กำลังดึงข้อมูลจาก Windsor…</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : list.length === 0 ? (
        <div className="loading">ไม่พบ Ad Account ตามตัวกรองนี้</div>
      ) : (
        list.map((a, i) => (
          <div key={a.name} style={{ marginBottom: 12 }}>
            <div className="acct-row" style={{ marginBottom: 0, cursor: "pointer" }} onClick={() => toggleRow(i)}>
              <div className="acct-ico">{a.active ? "🟢" : "⚪"}</div>
              <div className="acct-info">
                <div className="acct-name"><span className="car">{openRows.has(i) ? "▾" : "▸"}</span>{a.name}</div>
                <div className="acct-id">
                  <span className={cn("tag", a.active ? "active" : "paused")}>{a.active ? "ACTIVE" : "INACTIVE"}</span>
                </div>
              </div>
              <div className="acct-meta">
                <div className="spend">{fmtMoney(a.spend)}</div>
                <div className="cap">Spend {periodLabel}</div>
              </div>
            </div>
            {openRows.has(i) && (
              <div style={{ padding: "4px 18px 8px 78px", background: "var(--well)", border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 8px 8px" }}>
                {a.campaigns.length ? (
                  a.campaigns.map((c) => (
                    <div key={c.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                      <span>
                        <span className={cn("tag", c.status === "ACTIVE" ? "active" : "paused")}>{c.status === "ACTIVE" ? "ACTIVE" : c.status || "—"}</span> {c.name}
                      </span>
                      <span className="num" style={{ whiteSpace: "nowrap" }}>{fmtMoney(c.spend)}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "7px 0", color: "var(--muted)", fontSize: 13 }}>ไม่มีแคมเปญในช่วงเวลานี้</div>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </section>
  );
}
