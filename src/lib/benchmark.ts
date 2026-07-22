/* ============================================================
   AD BENCHMARK — parse ชื่อแคมเปญ → Brand / Objective / Material
   ============================================================ */

// base field ที่ชัวร์ + ชุด result เสริม (best-effort, ไล่ fallback ถ้า Windsor ปฏิเสธ field)
// ไม่ใส่ date → Windsor รวมยอดต่อแคมเปญให้เลย (แถวน้อยลงมาก เร็วขึ้น ไม่ timeout)
export const BENCH_BASE = "account_name,campaign,spend,impressions,reach,clicks";
export const BENCH_OPT_TIERS = [
  "cost_per_action_type_video_view,cost_per_thruplay_video_view,cost_per_action_type_page_engagement,outbound_clicks_outbound_click,actions_omni_add_to_cart,actions_omni_purchase,actions_omni_view_content,actions_onsite_conversion_messaging_conversation_started_7d",
  "cost_per_action_type_video_view,cost_per_thruplay_video_view,cost_per_action_type_page_engagement,outbound_clicks_outbound_click",
  "video_views,post_engagement",
  "",
];

// ---- TikTok: ดึงจาก connector "tiktok" (field ชุดพื้นฐาน + fallback) ----
export const TT_TIERS = [
  "campaign,campaign_name,spend,impressions,reach,clicks,play_duration_2s,play_duration_6s,focused_view_15s",
  "campaign,spend,impressions,reach,clicks,play_duration_2s,play_duration_6s,focused_view_15s",
  "campaign,campaign_name,spend,impressions,reach,clicks",
  "campaign,spend,impressions,reach,clicks",
  "campaign_name,spend,impressions,clicks",
];

// ---- Google (Looker Studio) — ฝังรายงานจริงผ่าน iframe (ไม่มีใน Windsor) ----
export const G_REPORT = "e741bfa5-b095-4ccf-afe2-48dc1e4c3263";
export const G_PAGE = { gcost: "p_p30t714wwd", gresult: "p_106vbf0sxd" };
export const gEmbedUrl = (pg) => `https://datastudio.google.com/embed/reporting/${G_REPORT}/page/${pg}`;
export const gOpenUrl = (pg) => `https://lookerstudio.google.com/reporting/${G_REPORT}/page/${pg}`;

// ---- Brand: parse Project Name แล้ว normalize ให้ชื่อตรงกัน ----
// เพิ่ม/แก้แบรนด์ได้ที่นี่ (แบบเดียวกับ CASE WHEN REGEXP_MATCH ของ Looker) — ตัวแรกที่ match ชนะ
const BRAND_RULES = [
  // conflict-prone / multi-word ก่อน
  [/squid\s?brand|squidbrand|plara\s?paradise/i, "SquidBrand"],
  [/bangchak|\bbgm\b/i, "Bangchak"],
  [/108\s*(?:shop|detergent)/i, "108 Shop Detergent"],
  [/pro[-\s]?detergent/i, "Pro Detergent"],
  [/suesat/i, "Suesat Detergent"],
  [/freshy/i, "Freshy"],
  [/fresh\s*(?:&|and)?\s*soft/i, "Fresh & Soft"],
  [/free\s*(?:&|and)?\s*free/i, "Free & Free"],
  [/hi[-\s]?herb/i, "Hi-Herb"],
  [/hi[-\s]?class/i, "HiClass"],
  [/smart\s?heart/i, "Smartheart gold"],
  [/mont\s?fle/i, "Mont Fleur"],
  [/asia\s?drug/i, "Asia Drug"],
  [/honest/i, "Honest Society"],
  [/crying\s?thaiger|thaiger/i, "Crying Thaiger"],
  [/good\s?age/i, "GoodAge"],
  [/i[-\s]?kids/i, "I-Kids Pops"],
  [/i[-\s]?snack/i, "ISnack"],
  [/de\s?paris/i, "De Paris"],
  [/lipon/i, "Lipon F"],
  // ที่เหลือ (ชื่อเฉพาะ)
  [/systema/i, "Systema"], [/\bmama\b/i, "Mama"], [/puriku/i, "Puriku"], [/falles/i, "Falles"],
  [/essence/i, "Essence"], [/farm\s?house/i, "Farmhouse"], [/\bsalz\b/i, "SALZ"],
  [/shokubutsu/i, "Shokubutsu"], [/kirei/i, "Kirei"], [/kodomo/i, "Kodomo"], [/\bpao\b/i, "PAO"],
  [/hajiko/i, "Hajiko"], [/navavej/i, "Navavej"], [/mikku/i, "Mikku"], [/deedo/i, "Deedo"],
  [/hiclass/i, "HiClass"], [/monchou/i, "Monchou"], [/\btomi\b/i, "Tomi"], [/zilk/i, "Zilk"],
  [/\bzact\b/i, "Zact"], [/kewpie/i, "Kewpie"], [/hashi/i, "Hashi"], [/richesse/i, "Richesse"],
  [/\blso\b/i, "LSO"], [/\blms\b/i, "LMS"], [/freshy/i, "Freshy"], [/neobun/i, "Neobun"],
  [/\bmuay\b/i, "Muay"], [/mewbio/i, "Mewbio"], [/dutch\s?mil/i, "Dutchmill"], [/bissin/i, "Bissin"],
  [/pulzar/i, "Pulzar"],
];

export function normalizeBrand(full) {
  const s = String(full || "");
  for (const [re, name] of BRAND_RULES) { if (re.test(s)) return name; }
  return "None"; // หาไม่เจอ → None
}

// Objective ตรวจด้วย keyword (ทนต่อชื่อหลายรูปแบบ) — ตัวแรกที่ match ชนะ
const OBJ_RULES = [
  [/thruplay/i, "Video Thruplay"],
  [/video\s*views?/i, "Video Views"],
  [/\breach\b/i, "Reach"],
  [/engagement/i, "Engagement"],
  [/\btraffic\b/i, "Traffic"],
  [/\bcpas\b/i, "CPAS"],
  [/conversion|\bsales\b/i, "Conversions"],
  [/page\s*like/i, "Page Like"],
  [/lead/i, "Lead Gen"],
  [/message/i, "Message"],
  [/app\s*install/i, "App Installs"],
  [/awareness/i, "Awareness"],
  [/event\s*response/i, "Event responses"],
];
export function detectObjective(str) {
  for (const [re, o] of OBJ_RULES) { if (re.test(str)) return o; }
  return "(ไม่ระบุ)";
}

// TikTok objective — controlled list (map จากส่วนที่ 2 ของชื่อ) ; ตัวแรกที่ match ชนะ
const TT_OBJ_RULES = [
  [/video\s*views?\s*6\s*s|views?\s*6\s*s/i, "Video Views 6s"],
  [/video\s*views?/i, "Video Views"],
  [/profile\s*visit/i, "Profile Visit"],
  [/product\s*sale/i, "Product Sale"],
  [/conversion/i, "Conversions"],
  [/\btraffic\b/i, "Traffic"],
  [/follow/i, "Follow"],
  [/r\s*&\s*f|reach\s*&\s*freq/i, "R&F"],
  [/top\s*view/i, "Top View"],
  [/top\s*feed/i, "Top Feed"],
  [/\breach\b/i, "Reach"],
];
export function detectObjectiveTT(str) {
  for (const [re, o] of TT_OBJ_RULES) { if (re.test(str)) return o; }
  return "Unknown";
}

// Material type: ตรวจว่าชื่อ contain keyword ไหน → ชื่อมาตรฐาน (ตัวแรกที่ match ชนะ)
const MAT_RULES = [
  [/7\.5\s*(?:s|sec)/i, "VDO 7.5s"],
  [/\b6\s*(?:s|sec)\b/i, "VDO 6s"],
  [/\b10\s*(?:s|sec)\b/i, "VDO 10s"],
  [/\b15\s*(?:s|sec)\b/i, "VDO 15s"],
  [/\b30\s*(?:s|sec)\b/i, "VDO 30s"],
  [/\b45\s*(?:s|sec)\b/i, "VDO 45s"],
  [/(?:>|over|เกิน|มากกว่า)\s*3\s*min|3\s*\+\s*min/i, "VDO >3 Mins"],
  [/\b1\s*min/i, "VDO 1 Mins"],
  [/single\s*image/i, "Single Image"],
  [/photo\s*album/i, "Photo Album"],
  [/catalog/i, "Catalog Ads"],
  [/carousel/i, "Carousel"],
];
export function detectMaterial(str) {
  for (const [re, m] of MAT_RULES) { if (re.test(str)) return m; }
  return "(ไม่ระบุ)";
}

// TikTok material — controlled list (เฉพาะ VDO types) ; ไม่เจอ = Unknown
const TT_MAT_RULES = [
  [/\b6\s*(?:s|sec)\b/i, "VDO 6s"],
  [/\b15\s*(?:s|sec)\b/i, "VDO 15s"],
  [/\b30\s*(?:s|sec)\b/i, "VDO 30s"],
  [/\b45\s*(?:s|sec)\b/i, "VDO 45s"],
  [/(?:>|over|เกิน|มากกว่า)\s*3\s*min|3\s*\+\s*min/i, "VDO >3 Mins"],
  [/\b1\s*min/i, "VDO 1 Mins"],
];
export function detectMaterialTT(str) {
  for (const [re, m] of TT_MAT_RULES) { if (re.test(str)) return m; }
  return "Unknown";
}

export function parseCampaign(name) {
  const s = String(name || "");
  const core = s.split(" / ")[0];                               // ตัด "/ segment" ท้าย
  const afterCode = core.replace(/^[^\[]*\[[^\]]*\]\s*/, "");   // ตัด "Bid [code] " (ถ้ามี)
  const noTail = afterCode.replace(/\s*\[[^\]]*\]/g, "")        // ตัด [date]
    .replace(/\s*\([^)]*\)\s*$/, "")                            // ตัด (job) ท้าย
    .trim();
  const segs = noTail.split(" - ").map((x) => x.trim()).filter(Boolean);
  // objective: หา segment ที่ตรง keyword ก่อน, ไม่งั้นสแกนทั้งชื่อ
  let objective = "(ไม่ระบุ)", objIdx = -1;
  for (let i = 0; i < segs.length; i++) {
    const o = detectObjective(segs[i]);
    if (o !== "(ไม่ระบุ)") { objective = o; objIdx = i; break; }
  }
  if (objIdx < 0) objective = detectObjective(core);
  // material: ตรวจ contain keyword ตามลิสต์มาตรฐาน (ไม่ใช่ตามตำแหน่ง)
  const material = detectMaterial(noTail);
  return { brand: normalizeBrand(core), objective, material };
}

// TikTok/template-based: objective = ส่วนที่ 2 ตรงตามชื่อ (ไม่ใช่ keyword),
// material type = detect เฉพาะจาก Material Name (ส่วนที่ 3+) ; ไม่เจอ = Unknown
export function parseCampaignTT(name) {
  const core = String(name || "").split(" / ")[0];
  const afterCode = core.replace(/^[^\[]*\[[^\]]*\]\s*/, "");
  const noTail = afterCode.replace(/\s*\[[^\]]*\]/g, "").replace(/\s*\([^)]*\)\s*$/, "").trim();
  const segs = noTail.split(" - ").map((x) => x.trim()).filter(Boolean);
  const objective = detectObjectiveTT(segs[1] || "");
  const material = detectMaterialTT(segs.slice(2).join(" - "));
  return { brand: normalizeBrand(core), objective, material };
}

export function bnum(r, keys) {
  for (const k of keys) {
    const v = r[k];
    if (v != null && v !== "") return +v || 0;
  }
  return 0;
}

export function bstat(arr) {
  const a = arr.filter((x) => x > 0 && isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const sum = a.reduce((s, x) => s + x, 0), mid = Math.floor(a.length / 2);
  return { avg: sum / a.length, min: a[0], max: a[a.length - 1], med: a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2 };
}
