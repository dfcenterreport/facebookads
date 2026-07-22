import { useEffect, useMemo, useState } from "react";
import { wfetch, ensureKey, USE_PROXY, SRC_COLORS, FIELDS, PREV_FIELDS } from "@/lib/windsor";
import { acctOf, norm, addDays, fmtInt, fmtMoney, fmtPct, sumOf, deriv } from "@/lib/format";
import { cn } from "@/lib/utils";
import Pills from "@/components/Pills";
import DateRange from "@/components/DateRange";
import KpiCard from "@/components/KpiCard";
import ChartCanvas, { yellowGradient } from "@/components/ChartCanvas";

const PRESETS = [
  { value: "last_7d", label: "7 วัน" },
  { value: "last_14d", label: "14 วัน" },
  { value: "last_30d", label: "30 วัน" },
  { value: "this_month", label: "เดือนนี้" },
  { value: "last_month", label: "เดือนก่อน" },
];

export default function Dashboard({ account, setAccount, onBack }) {
  const [preset, setPreset] = useState("last_7d");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [raw, setRaw] = useState([]);
  const [prevRaw, setPrevRaw] = useState([]);
  const [activeSources, setActiveSources] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSortState] = useState({ key: "spend", dir: -1 });
  const [openRows, setOpenRows] = useState(() => new Set());
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ensureKey(false)) { setError("ยังไม่มี API key — กดปุ่ม “🔑 Key”"); setLoading(false); return; }
      setLoading(true); setError(""); setOpenRows(new Set());
      const range = preset === "custom" ? `date_from=${custom.from}&date_to=${custom.to}` : `date_preset=${preset}`;
      try {
        const res = await wfetch(`${range}&fields=${FIELDS}`);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const rows = ((await res.json()).data || []).map((r) => ({
          source: norm(r.source), account: acctOf(r), id: r.account_id || "—",
          campaign: r.campaign || "(ไม่ระบุแคมเปญ)", status: (r.campaign_status || "").toUpperCase(),
          objective: r.objective || "", clicks: +r.clicks || 0, spend: +r.spend || 0,
          impressions: +r.impressions || 0, reach: +r.reach || 0, date: r.date,
        }));
        if (cancelled) return;
        setRaw(rows);
        const srcs = [...new Set(rows.map((r) => r.source))];
        setActiveSources((prev) => (prev.size === 0 ? new Set(srcs) : prev));
        // ดึงช่วงก่อนหน้า (เท่ากับจำนวนวันของช่วงปัจจุบัน) สำหรับคำนวณ trend
        let prevRows = [];
        const dates = [...new Set(rows.map((r) => r.date))].sort();
        if (dates.length) {
          const N = dates.length, to = addDays(dates[0], -1), from = addDays(dates[0], -N);
          try {
            const pr = await wfetch(`date_from=${from}&date_to=${to}&fields=${PREV_FIELDS}`);
            prevRows = ((await pr.json()).data || []).map((r) => ({
              source: norm(r.source), account: acctOf(r),
              spend: +r.spend || 0, impressions: +r.impressions || 0, reach: +r.reach || 0, clicks: +r.clicks || 0,
            }));
          } catch (e) { prevRows = []; }
        }
        if (!cancelled) setPrevRaw(prevRows);
      } catch (e) {
        if (!cancelled) setError(`❌ ดึงข้อมูลไม่สำเร็จ: ${e.message}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, custom, reload]);

  const matchFilters = (r) => activeSources.has(r.source) && (account === "__all__" || r.account === account);
  const data = useMemo(() => raw.filter(matchFilters), [raw, activeSources, account]);
  const prev = useMemo(() => prevRaw.filter(matchFilters), [prevRaw, activeSources, account]);
  const dates = useMemo(() => [...new Set(raw.map((r) => r.date))].sort(), [raw]);
  const srcs = useMemo(() => [...new Set(raw.map((r) => r.source))], [raw]);
  const accounts = useMemo(() => [...new Set(raw.map((r) => r.account))].sort((a, b) => a.localeCompare(b)), [raw]);

  const c = deriv(sumOf(data)), p = deriv(sumOf(prev));

  // ตาราง campaign (รวมยอด + รายวัน)
  const rows = useMemo(() => {
    const agg = {};
    data.forEach((r) => {
      const k = r.campaign + "|" + r.source;
      if (!agg[k]) agg[k] = { campaign: r.campaign, source: r.source, status: r.status, spend: 0, impressions: 0, clicks: 0, days: {} };
      agg[k].spend += r.spend; agg[k].impressions += r.impressions; agg[k].clicks += r.clicks;
      if (r.status) agg[k].status = r.status;
      const d = agg[k].days;
      if (!d[r.date]) d[r.date] = { spend: 0, impr: 0, clicks: 0 };
      d[r.date].spend += r.spend; d[r.date].impr += r.impressions; d[r.date].clicks += r.clicks;
    });
    let out = Object.values(agg).map((r) => ({ ...r, ctr: r.impressions ? r.clicks / r.impressions : 0, cpc: r.clicks ? r.spend / r.clicks : 0 }));
    out.sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      if (typeof x === "string") return sort.dir * String(x).localeCompare(String(y));
      return sort.dir * (x - y);
    });
    return out.slice(0, 50);
  }, [data, sort]);

  const chartConfig = useMemo(() => {
    if (!dates.length) return null;
    const by = {};
    dates.forEach((d) => (by[d] = { spend: 0, impr: 0 }));
    data.forEach((r) => { if (by[r.date]) { by[r.date].spend += r.spend; by[r.date].impr += r.impressions; } });
    return {
      data: {
        labels: dates,
        datasets: [
          { type: "line", label: "Spend (฿)", data: dates.map((d) => by[d].spend), yAxisID: "y", borderColor: "#ebc300", backgroundColor: (ctx) => yellowGradient(ctx.chart.ctx), fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2.5 },
          { type: "line", label: "Impressions", data: dates.map((d) => by[d].impr), yAxisID: "y1", borderColor: "#969A9E", backgroundColor: "#969A9E", tension: 0.4, pointRadius: 0, borderWidth: 1.5, borderDash: [4, 3] },
        ],
      },
      options: {
        responsive: true, interaction: { mode: "index", intersect: false },
        plugins: { legend: { labels: { color: "#6b7178", font: { family: "Work Sans" }, usePointStyle: true, boxWidth: 8 } } },
        scales: {
          x: { ticks: { color: "#969A9E", font: { family: "JetBrains Mono", size: 10 } }, grid: { display: false } },
          y: { position: "left", ticks: { color: "#ebc300", font: { family: "JetBrains Mono", size: 10 } }, grid: { color: "#E2E4E6" } },
          y1: { position: "right", ticks: { color: "#969A9E", font: { family: "JetBrains Mono", size: 10 } }, grid: { drawOnChartArea: false } },
        },
      },
    };
  }, [data, dates]);

  const setSort = (k) => setSortState((s) => (s.key === k ? { ...s, dir: -s.dir } : { key: k, dir: -1 }));
  const Th = ({ k, label }) => (
    <th onClick={() => setSort(k)}>{label}{sort.key === k ? (sort.dir < 0 ? " ▾" : " ▴") : ""}</th>
  );
  const toggleRow = (i) => setOpenRows((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const tag = (s) => (
    <span className={cn("tag", s === "ACTIVE" ? "active" : "paused")}>{s || "—"}</span>
  );

  return (
    <section>
      <header>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={onBack}>←</button>
          <div>
            <h1>{account === "__all__" ? "ทุก Ad Account" : account}</h1>
            <div className="sub">
              {loading ? "กำลังโหลด…" : dates.length ? `${dates[0]} → ${dates[dates.length - 1]} · ${data.length} แถว · ข้อมูลจาก Windsor` : "ไม่มีข้อมูล"}
            </div>
          </div>
        </div>
        <div className="controls">
          <select id="accountFilter" value={account} onChange={(e) => setAccount(e.target.value)}>
            <option value="__all__">ทุก Ad Account ({accounts.length})</option>
            {accounts.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <Pills options={PRESETS} value={preset} onChange={(v) => { setPreset(v); }} />
          <DateRange from={custom.from} to={custom.to} onApply={(f, t) => { setCustom({ from: f, to: t }); setPreset("custom"); }} />
          {!USE_PROXY && <button onClick={() => { if (ensureKey(true)) setReload((n) => n + 1); }}>🔑 Key</button>}
          <button className="btn-primary" onClick={() => setReload((n) => n + 1)}>↻ รีเฟรช</button>
        </div>
      </header>

      <div className="chips">
        {srcs.map((s) => {
          const on = activeSources.has(s);
          return (
            <div key={s} className={cn("chip", !on && "off")} onClick={() =>
              setActiveSources((prev) => { const n = new Set(prev); on ? n.delete(s) : n.add(s); return n; })
            }>
              <span className="dot" style={{ background: SRC_COLORS[s] || SRC_COLORS.other }} />{s}
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="loading">กำลังดึงข้อมูลจาก Windsor…</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <>
          <div className="kpis">
            <KpiCard label="Total Spend" value={fmtMoney(c.spend)} cur={c.spend} prev={p.spend} primary />
            <KpiCard label="Reach" value={fmtInt(c.reach)} cur={c.reach} prev={p.reach} />
            <KpiCard label="Impressions" value={fmtInt(c.impr)} cur={c.impr} prev={p.impr} />
            <KpiCard label="Clicks" value={fmtInt(c.clicks)} cur={c.clicks} prev={p.clicks} />
            <KpiCard label="CPM" value={fmtMoney(c.cpm)} cur={c.cpm} prev={p.cpm} />
            <KpiCard label="CPC" value={"฿" + c.cpc.toFixed(2)} cur={c.cpc} prev={p.cpc} />
            <KpiCard label="CTR" value={fmtPct(c.ctr)} cur={c.ctr} prev={p.ctr} />
            <KpiCard label="Frequency" value={c.freq.toFixed(2)} cur={c.freq} prev={p.freq} />
            <KpiCard label="Conversions" value="—" na />
          </div>

          <div className="grid">
            <div className="panel">
              <div className="panel-head"><h3>Performance Over Time</h3></div>
              <div className="psub">แนวโน้ม Spend และ Impressions รายวัน</div>
              {chartConfig && <ChartCanvas config={chartConfig} />}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>Campaign Performance</h3></div>
            <div className="psub">เรียงตาม Spend · คลิกหัวคอลัมน์เพื่อจัดเรียง</div>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <Th k="status" label="Status" />
                    <Th k="campaign" label="Campaign Name" />
                    <Th k="spend" label="Spend" />
                    <Th k="impressions" label="Impr." />
                    <Th k="ctr" label="CTR" />
                    <Th k="cpc" label="CPC" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <RowGroup key={r.campaign + "|" + r.source} r={r} open={openRows.has(i)} onToggle={() => toggleRow(i)} tag={tag} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="footnote">Conversions / ROAS ไม่แสดง เพราะ Windsor ส่งค่าเป็น 0/ว่าง (แคมเปญเป็นงาน Brand/Reach ไม่มี conversion tracking)</div>
          </div>
        </>
      )}
    </section>
  );
}

function RowGroup({ r, open, onToggle, tag }) {
  return (
    <>
      <tr className="camp-row" onClick={onToggle}>
        <td>{tag(r.status)}</td>
        <td className="camp" title={r.campaign}><span className="car">{open ? "▾" : "▸"}</span>{r.campaign}</td>
        <td>{fmtMoney(r.spend)}</td>
        <td>{fmtInt(r.impressions)}</td>
        <td>{fmtPct(r.ctr)}</td>
        <td>฿{r.cpc.toFixed(2)}</td>
      </tr>
      {open &&
        Object.entries(r.days)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([dt, v]) => {
            const ctr = v.impr ? v.clicks / v.impr : 0, cpc = v.clicks ? v.spend / v.clicks : 0;
            return (
              <tr className="det" key={dt}>
                <td></td>
                <td className="day">{dt}</td>
                <td>{fmtMoney(v.spend)}</td>
                <td>{fmtInt(v.impr)}</td>
                <td>{fmtPct(ctr)}</td>
                <td>฿{cpc.toFixed(2)}</td>
              </tr>
            );
          })}
    </>
  );
}
