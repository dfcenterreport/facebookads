import { cn } from "@/lib/utils";

/** เปอร์เซ็นต์เทียบช่วงก่อนหน้า (▲/▼) */
export function Trend({ cur, prev, naText = "ไม่มีข้อมูลก่อนหน้า", vsText = "vs ช่วงก่อน" }) {
  if (!prev || !isFinite(cur / prev)) {
    return (<><span className="trend flat">—</span><span className="vs">{naText}</span></>);
  }
  const pct = ((cur - prev) / prev) * 100, up = pct >= 0;
  return (
    <>
      <span className={cn("trend", up ? "up" : "down")}>{up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%</span>
      <span className="vs">{vsText}</span>
    </>
  );
}

export default function KpiCard({ label, value, cur, prev, primary, na, compactNoTrend, className, ...rest }) {
  return (
    <div className={cn("kpi", primary && "primary", na && "na", className)} {...rest}>
      <div className="klabel">{label}</div>
      <div className="kval">{value}</div>
      {!compactNoTrend && (
        <div className="ktrend">
          {na
            ? (<><span className="trend flat">—</span><span className="vs">ไม่มีข้อมูล conversion</span></>)
            : <Trend cur={cur} prev={prev} />}
        </div>
      )}
    </div>
  );
}
