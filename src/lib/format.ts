/* ---------------- ตัวช่วย format / วันที่ / รวมยอด ---------------- */
export const fmtInt = (n) => Math.round(n).toLocaleString("en-US");
export const fmtMoney = (n) => "฿" + Math.round(n).toLocaleString("en-US");
export const fmtPct = (n) => (n * 100).toFixed(2) + "%";
export const fmtK = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "K" : fmtInt(n));
export const norm = (s) => (s && s.trim() ? s : "other");
export const acctOf = (r) => r.account_name || "(ไม่ระบุบัญชี)";

export function addDays(ds, n) {
  const d = new Date(ds + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weekStart(ds) {
  const d = new Date(ds + "T00:00:00Z");
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

export function sumOf(rows) {
  return rows.reduce(
    (a, r) => { a.spend += r.spend; a.impr += r.impressions; a.reach += r.reach; a.clicks += r.clicks; return a; },
    { spend: 0, impr: 0, reach: 0, clicks: 0 }
  );
}

export function deriv(s) {
  return {
    ...s,
    cpm: s.impr ? (s.spend / s.impr) * 1000 : 0,
    cpc: s.clicks ? s.spend / s.clicks : 0,
    ctr: s.impr ? s.clicks / s.impr : 0,
    freq: s.reach ? s.impr / s.reach : 0,
  };
}

// id = "{pageid}_{postid}" → เอาส่วน postid ท้ายสุด (page id อาจต่างกัน)
export const postSuffix = (s) => {
  const p = String(s || "").split("_");
  return p.length >= 2 ? p[p.length - 1] : (String(s || "").match(/(\d{6,})\/?$/) || [])[1] || "";
};
