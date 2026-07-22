import { useState, useEffect } from "react";

/** ช่วงวันที่ custom + ปุ่ม "ใช้" (validate แบบเดียวกับของเดิม) */
export default function DateRange({ from = "", to = "", onApply }) {
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  useEffect(() => setF(from), [from]);
  useEffect(() => setT(to), [to]);
  const apply = () => {
    if (!f || !t) { alert("กรุณาเลือกทั้งวันเริ่มต้นและวันสิ้นสุด"); return; }
    if (f > t) { alert("วันเริ่มต้นต้องไม่เกินวันสิ้นสุด"); return; }
    onApply(f, t);
  };
  return (
    <div className="range">
      <input type="date" value={f} title="วันเริ่มต้น" onChange={(e) => setF(e.target.value)} />
      <span className="rdash">–</span>
      <input type="date" value={t} title="วันสิ้นสุด" onChange={(e) => setT(e.target.value)} />
      <button onClick={apply}>ใช้</button>
    </div>
  );
}
