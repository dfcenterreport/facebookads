/* ============================================================
   Windsor API — proxy ผ่าน server (Railway) หรือยิงตรง (file://)
   ============================================================ */
// เปิดผ่านเซิร์ฟเวอร์ (Railway) → ใช้ proxy /api/windsor (same-origin ไม่ติด CORS)
// เปิด dev server (vite) → /api ถูก proxy ไปที่ node server.js (พอร์ต 3000)
export const USE_PROXY = location.protocol === "http:" || location.protocol === "https:";
const ENDPOINT = USE_PROXY ? "/api/windsor" : "https://connectors.windsor.ai/all";

const KEY_STORE = "windsor_api_key";
let API_KEY = localStorage.getItem(KEY_STORE) || "";

export function ensureKey(force) {
  // รันผ่าน server: key อยู่ที่ env `Windsor_key` ฝั่ง server → ไม่ต้องกรอก
  if (USE_PROXY && !force) return true;
  if (!API_KEY || force) {
    const k = prompt("กรอก Windsor API key:", API_KEY || "");
    if (k && k.trim()) { API_KEY = k.trim(); localStorage.setItem(KEY_STORE, API_KEY); return true; }
    return USE_PROXY || !!API_KEY;
  }
  return true;
}

export function wfetch(params, connector, timeoutMs) {
  // timeout กันค้าง: default 45 วิ (benchmark ช่วงยาวส่ง timeoutMs มากกว่านี้ได้)
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs || 45000);
  let p;
  if (USE_PROXY) {
    // รันผ่าน server (Railway): ใช้ key จาก env `Windsor_key` ฝั่ง server เท่านั้น
    // ไม่ส่ง key จาก browser เพื่อไม่ให้ key เก่า/ผิดใน localStorage ไปทับ
    const q = connector ? `connector=${connector}&${params}` : params;
    p = fetch(`${ENDPOINT}?${q}`, { signal: ctrl.signal });
  } else {
    const base = connector ? `https://connectors.windsor.ai/${connector}` : ENDPOINT;
    p = fetch(`${base}?api_key=${API_KEY}&${params}`, { signal: ctrl.signal });
  }
  return p.finally(() => clearTimeout(t));
}

export const FIELDS = "source,account_name,account_id,campaign,campaign_status,objective,clicks,spend,impressions,reach,date";
export const PREV_FIELDS = "source,account_name,spend,impressions,reach,clicks";
export const BID_BASE = "source,account_name,account_id,campaign,adset_name,ad_name,spend,impressions,reach,clicks,date";
// ไล่ระดับ field เสริม (thumbnail + ลิงก์โพสต์) — ลองชุดครบสุดก่อน ถ้า connector ไม่รองรับค่อยถอย
export const BID_OPT_TIERS = [
  "thumbnail_url,object_story_id,effective_object_story_id,permalink_url",
  "thumbnail_url,effective_object_story_id",
  "thumbnail_url,object_story_id",
  "thumbnail_url",
  "",
];

// object_story_id = "{pageid}_{postid}" → แปลงเป็น URL โพสต์จริง
export function storyToUrl(s) {
  if (!s) return "";
  s = String(s);
  if (/^https?:/i.test(s)) return s;
  const p = s.split("_");
  return p.length >= 2 ? `https://www.facebook.com/${p[0]}/posts/${p[1]}` : "";
}

// Facebook Page Insights (connector=facebook_organic) — ข้อมูลโพสต์จริง: permalink, reactions, organic/paid
// ไล่ระดับ: ครบสุด → เหลือแค่ permalink+message (ชุดเล็กสุดมักผ่านเสมอ ทำให้ได้ลิงก์แน่นอน)
export const ORG_TIERS = [
  "date,post_id,permalink_url,message,post_impressions,post_impressions_organic,post_impressions_paid,post_impressions_unique,post_impressions_organic_unique,post_impressions_paid_unique,post_reactions_like_total,post_reactions_love_total,post_reactions_haha_total,post_reactions_wow_total,post_reactions_sorry_total,post_reactions_anger_total,post_clicks",
  "date,post_id,permalink_url,message,post_impressions,post_impressions_unique,post_impressions_organic_unique,post_impressions_paid_unique",
  "post_id,permalink_url,message",
];

export const SRC_COLORS = { facebook: "#4267B2", tiktok: "#0ea5b5", twitter: "#1DA1F2", other: "#969A9E" };

/* ---- Apify — ดึง engagement ของโพสต์ (reactions/shares/comments) ผ่าน server proxy ---- */
export async function fetchApify(url) {
  if (!USE_PROXY) return null; // เรียกได้เฉพาะผ่าน server (key อยู่ที่ server)
  try {
    const res = await fetch(`/api/apify?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const j = await res.json();
    const items = Array.isArray(j) ? j : (j.items || j.data || []);
    return items[0] || null;
  } catch (e) {
    return null;
  }
}

// อ่านค่าจาก item ของ Apify แบบเผื่อชื่อ field หลายแบบ
export const apGet = (it, keys) => {
  for (const k of keys) {
    if (it && it[k] != null && it[k] !== "") return +it[k] || 0;
  }
  return null;
};
