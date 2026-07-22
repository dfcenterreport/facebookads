// ตัวช่วยเรื่องวันที่/ช่วงเดือน + เวลาโซนไทย (Asia/Bangkok)

export function todayStr(): string { return new Date().toISOString().slice(0, 10); }

export interface DateRange { from: string; to: string; }

export function monthChunks(fromYear: number, fromMonth0?: number): DateRange[] {
  const chunks: DateRange[] = [];
  const now = new Date();
  const endY = now.getUTCFullYear(), endM = now.getUTCMonth();
  const today = todayStr();
  let y = fromYear, m = fromMonth0 || 0;
  while (y < endY || (y === endY && m <= endM)) {
    const mm = String(m + 1).padStart(2, "0");
    const from = `${y}-${mm}-01`;
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    let to = `${y}-${mm}-${String(lastDay).padStart(2, "0")}`;
    if (to > today) to = today;
    chunks.push({ from, to });
    m++; if (m > 11) { m = 0; y++; }
  }
  return chunks;
}

export function presetRange(preset: string): DateRange | null {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const back = (n: number) => { const x = new Date(now); x.setUTCDate(x.getUTCDate() - n); return x.toISOString().slice(0, 10); };
  if (preset === "last_7d") return { from: back(7), to: back(1) };
  if (preset === "last_14d") return { from: back(14), to: back(1) };
  if (preset === "last_30d") return { from: back(30), to: back(1) };
  if (preset === "this_month") {
    const f = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
    return { from: f, to: today };
  }
  if (preset === "last_month") {
    const y = now.getUTCFullYear(), m = now.getUTCMonth();
    const pm = m === 0 ? 11 : m - 1, py = m === 0 ? y - 1 : y;
    const mm = String(pm + 1).padStart(2, "0");
    const ld = new Date(Date.UTC(py, pm + 1, 0)).getUTCDate();
    return { from: `${py}-${mm}-01`, to: `${py}-${mm}-${String(ld).padStart(2, "0")}` };
  }
  return null;
}

// incremental: ดึงเฉพาะ "เดือนก่อน + เดือนปัจจุบัน" แล้ว merge ทับช่วงนั้น (ข้อมูลเก่ากว่านั้นคงไว้) → เร็ว
export function incrementalStart(): { year: number; month0: number; dateStr: string } {
  const now = new Date();
  let y = now.getUTCFullYear(), m = now.getUTCMonth() - 1;   // เดือนก่อน
  if (m < 0) { m = 11; y -= 1; }
  return { year: y, month0: m, dateStr: `${y}-${String(m + 1).padStart(2, "0")}-01` };
}

// เวลาปัจจุบันโซนไทย (Asia/Bangkok)
export function bangkokParts(): { date: string; hm: string; dow: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short",
  });
  const p: Record<string, string> = {};
  fmt.formatToParts(new Date()).forEach((x) => (p[x.type] = x.value));
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { date: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}`, dow: dowMap[p.weekday] };
}

export function bkStamp(): string { const t = bangkokParts(); return `${t.date} ${t.hm}`; }
