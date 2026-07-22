import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** multi-select filter (Objective / Brand / Material) — selected=[] หมายถึงทั้งหมด */
export default function MultiSelect({ options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  // ปิด panel เมื่อคลิกนอกกล่อง
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);

  const toggle = (v) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  const summary = selected.length === 0 ? "— ทั้งหมด —" : selected.length === 1 ? selected[0] : `${selected.length} รายการ`;
  const list = options.filter((v) => v.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className={cn("ms", open && "open")} ref={ref}>
      <button type="button" className="ms-btn" onClick={() => setOpen((o) => !o)}>
        {summary} <span className="ms-caret">▾</span>
      </button>
      <div className="ms-panel">
        <input className="ms-search" placeholder="ค้นหา…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="ms-opt ms-all">
          <input type="checkbox" checked={selected.length === 0} onChange={() => onChange([])} />
          <span>— ทั้งหมด —</span>
        </label>
        <div className="ms-list">
          {list.map((v) => (
            <label key={v} className="ms-opt">
              <input type="checkbox" checked={selected.includes(v)} onChange={() => toggle(v)} />
              <span>{v}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
