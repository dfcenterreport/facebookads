// Config กลางของ server: path เก็บข้อมูล, connector ที่อนุญาต, ชุด field ของ Pull job, key จาก env
import path from "path";
import fs from "fs";
import type { PullSource } from "./types";

export const PORT = Number(process.env.PORT) || 3000;

// โฟลเดอร์เก็บข้อมูล — บน Railway ให้ตั้ง env DATA_DIR ไปที่ mount ของ Volume (เช่น /data)
export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

// serve ไฟล์ build ของ Vite — dist/ อยู่ที่ root ของโปรเจกต์ (โค้ด compile ไปอยู่ dist-server/)
export const DIST_DIR = path.join(__dirname, "..", "dist");

// อนุญาตเฉพาะ connector ที่รู้จัก (กัน SSRF/พิมพ์ผิด)
export const ALLOWED_CONNECTORS = new Set<string>([
  "all", "facebook", "facebook_organic", "instagram", "tiktok", "tiktok_organic", "twitter",
]);

// connector ที่ Pull job จะดึงมาเก็บ + ชุด field (ไล่ระดับ ถ้า connector ไม่รองรับชุดใหญ่ค่อยถอย)
export const PULL_SOURCES: PullSource[] = [
  { key: "all", windsor: "all", tiers: [
    "source,account_name,account_id,campaign,campaign_status,objective,clicks,spend,impressions,reach,date",
    "source,account_name,account_id,campaign,spend,impressions,reach,clicks,date",
  ]},
  { key: "facebook", windsor: "facebook", tiers: [
    // ใช้ field ที่ยืนยันแล้วว่า valid (cost_per_* + actions_omni_* + outbound) — ซอย tier ถ้าตัวเสี่ยงพัง ยังได้ metric หลัก
    "source,account_name,account_id,campaign,adset_name,ad_name,spend,impressions,reach,clicks,date,thumbnail_url,object_story_id,effective_object_story_id,cost_per_action_type_video_view,cost_per_thruplay_video_view,cost_per_action_type_page_engagement,outbound_clicks_outbound_click,actions_omni_add_to_cart,actions_omni_purchase,actions_omni_view_content,actions_onsite_conversion_messaging_conversation_started_7d",
    // core metric (CPV/Thruplay/CPE/Outbound) — ถ้า actions_omni_* พัง ยังได้ 4 ตัวนี้
    "source,account_name,account_id,campaign,adset_name,ad_name,spend,impressions,reach,clicks,date,thumbnail_url,object_story_id,effective_object_story_id,cost_per_action_type_video_view,cost_per_thruplay_video_view,cost_per_action_type_page_engagement,outbound_clicks_outbound_click",
    // CPV/Thruplay/CPE เท่านั้น (ถ้า outbound พัง)
    "source,account_name,account_id,campaign,adset_name,ad_name,spend,impressions,reach,clicks,date,thumbnail_url,object_story_id,effective_object_story_id,cost_per_action_type_video_view,cost_per_thruplay_video_view,cost_per_action_type_page_engagement",
    // ไม่มี metric (permalink_url ไม่ valid → ใช้ object_story_id แปลงลิงก์)
    "source,account_name,account_id,campaign,adset_name,ad_name,spend,impressions,reach,clicks,date,thumbnail_url,object_story_id,effective_object_story_id",
    "source,account_name,account_id,campaign,adset_name,ad_name,spend,impressions,reach,clicks,date,thumbnail_url",
    "source,account_name,account_id,campaign,adset_name,ad_name,spend,impressions,reach,clicks,date",
  ]},
  { key: "tiktok", windsor: "tiktok", tiers: [
    // ชุดใหญ่สุด: + play_duration (CPV/VR%) สำหรับ TikTok benchmark
    "source,account_name,account_id,campaign,adset_name,ad_name,spend,impressions,reach,clicks,date,play_duration_2s,play_duration_6s,focused_view_15s",
    "source,account_name,account_id,campaign,adset_name,ad_name,spend,impressions,reach,clicks,date",
  ]},
  { key: "facebook_organic", windsor: "facebook_organic", tiers: [
    "date,post_id,permalink_url,message,post_impressions,post_impressions_organic,post_impressions_paid,post_impressions_unique,post_impressions_organic_unique,post_impressions_paid_unique,post_reactions_like_total,post_reactions_love_total,post_reactions_haha_total,post_reactions_wow_total,post_reactions_sorry_total,post_reactions_anger_total,post_clicks",
    "date,post_id,permalink_url,message,post_impressions,post_impressions_unique,post_impressions_organic_unique,post_impressions_paid_unique",
    "post_id,permalink_url,message",
  ]},
];

export const DATASET_KEYS: string[] = PULL_SOURCES.map((s) => s.key);

export function datasetForConnector(connector: string): string {
  if (connector === "facebook_organic") return "facebook_organic";
  if (connector === "facebook" || connector === "instagram") return "facebook";
  if (connector === "tiktok" || connector === "tiktok_organic") return "tiktok";
  return "all";
}

// ---------- keys จาก env (ไม่ commit ลงไฟล์) ----------
export function windsorKey(): string { return process.env.Windsor_key || process.env.WINDSOR_API_KEY || ""; }

// auth proxy (Wazzup / Fareast Fameline identity)
export const AUTH_BASE = process.env.WAZZUP_BASE || "https://api.fareastfamelineddb.com";

// field test defaults
export const FIELDTEST_DEFAULTS: Record<string, string[]> = {
  facebook: ["video_views","video_view","video_thruplay_watched_actions","thruplays","post_engagement","page_engagement","outbound_clicks","outbound_clicks_outbound_click","inline_link_clicks","cost_per_action_type_video_view","cost_per_thruplay_video_view","cost_per_action_type_page_engagement","actions_omni_add_to_cart","actions_omni_purchase","actions_omni_view_content","actions_onsite_conversion_messaging_conversation_started_7d"],
  tiktok: ["play_duration_2s","play_duration_6s","focused_view_15s","video_views","video_watched_2s","video_watched_6s","video_views_p25","video_views_p100"],
};
