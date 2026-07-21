// Windsor dashboard server: proxy + on-disk data store + Pull job.
// - Serves index.html (static)
// - /api/data       : serves stored (pulled) data, filtered by date  → หน้าเว็บอ่านจากตรงนี้ (เร็ว)
// - /api/pull        : เริ่ม job ดึงข้อมูลล่าสุดจาก Windsor มาเก็บใน DB (ไฟล์บน volume)
// - /api/pull/status : ความคืบหน้า + ETA ของ job ปัจจุบัน
// - /api/pull/history: ประวัติการดึงข้อมูล
// - /api/windsor     : proxy ตรงไป Windsor (เก็บไว้เผื่อ debug)
// - /api/apify, /api/img : ตามเดิม
// Windsor API key มาจาก env `Windsor_key` (ตั้งใน Railway) — ไม่ commit ลงไฟล์
const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// โฟลเดอร์เก็บข้อมูล — บน Railway ให้ตั้ง env DATA_DIR ไปที่ mount ของ Volume (เช่น /data)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

// อนุญาตเฉพาะ connector ที่รู้จัก (กัน SSRF/พิมพ์ผิด)
const ALLOWED_CONNECTORS = new Set(["all", "facebook", "facebook_organic", "instagram", "tiktok", "tiktok_organic", "twitter"]);

// connector ที่ Pull job จะดึงมาเก็บ + ชุด field (ไล่ระดับ ถ้า connector ไม่รองรับชุดใหญ่ค่อยถอย)
const PULL_SOURCES = [
  { key: "all", windsor: "all", tiers: [
    "source,account_name,account_id,campaign,campaign_status,objective,clicks,spend,impressions,reach,date",
    "source,account_name,account_id,campaign,spend,impressions,reach,clicks,date",
  ]},
  { key: "facebook", windsor: "facebook", tiers: [
    // NB: permalink_url ไม่ valid สำหรับ facebook connector → ใช้ object_story_id แปลงเป็นลิงก์โพสต์แทน
    "source,account_name,account_id,campaign,adset_name,ad_name,spend,impressions,reach,clicks,date,thumbnail_url,object_story_id,effective_object_story_id",
    "source,account_name,account_id,campaign,adset_name,ad_name,spend,impressions,reach,clicks,date,thumbnail_url",
    "source,account_name,account_id,campaign,adset_name,ad_name,spend,impressions,reach,clicks,date",
  ]},
  { key: "tiktok", windsor: "tiktok", tiers: [
    "source,account_name,account_id,campaign,adset_name,ad_name,spend,impressions,reach,clicks,date",
  ]},
  { key: "facebook_organic", windsor: "facebook_organic", tiers: [
    "date,post_id,permalink_url,message,post_impressions,post_impressions_organic,post_impressions_paid,post_impressions_unique,post_impressions_organic_unique,post_impressions_paid_unique,post_reactions_like_total,post_reactions_love_total,post_reactions_haha_total,post_reactions_wow_total,post_reactions_sorry_total,post_reactions_anger_total,post_clicks",
    "date,post_id,permalink_url,message,post_impressions,post_impressions_unique,post_impressions_organic_unique,post_impressions_paid_unique",
    "post_id,permalink_url,message",
  ]},
];
const DATASET_KEYS = PULL_SOURCES.map(s => s.key);
function datasetForConnector(connector) {
  if (connector === "facebook_organic") return "facebook_organic";
  if (connector === "facebook" || connector === "instagram") return "facebook";
  if (connector === "tiktok" || connector === "tiktok_organic") return "tiktok";
  return "all";
}

// ---------- in-memory store (โหลดจากดิสก์ตอนบูต) ----------
const store = {};
DATASET_KEYS.forEach(k => store[k] = []);
let meta = { lastPull: null };
let history = [];

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8")); }
  catch (e) { return fallback; }
}
function writeJSON(file, data) {
  try { fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data)); }
  catch (e) { console.error("write fail", file, e.message); }
}
function loadStore() {
  DATASET_KEYS.forEach(k => store[k] = readJSON(k + ".json", []));
  meta = readJSON("meta.json", { lastPull: null });
  history = readJSON("history.json", []);
}
loadStore();

// ---------- Windsor fetch (ฝั่ง server ใช้ key จาก env) ----------
function windsorKey() { return process.env.Windsor_key || process.env.WINDSOR_API_KEY || ""; }
async function windsorFetch(connector, params) {
  const url = `https://connectors.windsor.ai/${connector}?${params}&api_key=${encodeURIComponent(windsorKey())}`;
  const r = await fetch(url);
  const text = await r.text();
  if (!r.ok) throw new Error(`Windsor HTTP ${r.status}: ${text.slice(0, 180)}`);
  let j; try { j = JSON.parse(text); } catch (e) { throw new Error("Windsor: bad JSON"); }
  // Windsor คืน error เป็น HTTP 200 + {error:...} (เช่น field ไม่ valid) → ต้อง throw เพื่อให้ fallback ไป tier ถัดไป
  if (j && j.error) throw new Error(`Windsor: ${String(j.error).slice(0, 180)}`);
  return j.data || [];
}

// ---------- date helpers ----------
function todayStr() { return new Date().toISOString().slice(0, 10); }
function monthChunks(fromYear, fromMonth0) {
  const chunks = [];
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
function presetRange(preset) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const back = n => { const x = new Date(now); x.setUTCDate(x.getUTCDate() - n); return x.toISOString().slice(0, 10); };
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

// ---------- Pull job (singleton) ----------
let job = { status: "idle", percent: 0, etaSec: null, done: 0, total: 0, currentLabel: "", startedAt: null, finishedAt: null, fromYear: null, error: null, rows: 0, origin: null, mode: null };
function jobPublic() {
  return { status: job.status, percent: job.percent, etaSec: job.etaSec, done: job.done, total: job.total,
    currentLabel: job.currentLabel, startedAt: job.startedAt, finishedAt: job.finishedAt, fromYear: job.fromYear, error: job.error, rows: job.rows, origin: job.origin, mode: job.mode };
}
// incremental: ดึงเฉพาะ "เดือนก่อน + เดือนปัจจุบัน" แล้ว merge ทับช่วงนั้น (ข้อมูลเก่ากว่านั้นคงไว้) → เร็ว
function incrementalStart() {
  const now = new Date();
  let y = now.getUTCFullYear(), m = now.getUTCMonth() - 1;   // เดือนก่อน
  if (m < 0) { m = 11; y -= 1; }
  return { year: y, month0: m, dateStr: `${y}-${String(m + 1).padStart(2, "0")}-01` };
}
// marker บนดิสก์: มีไฟล์นี้ = มี pull กำลังรันอยู่ ถ้า process ตายกลางคัน (server restart) ไฟล์จะค้าง → ใช้ตรวจว่าถูกขัดจังหวะ
const RUNNING_FILE = "running.json";
function writeRunning(info) { writeJSON(RUNNING_FILE, info); }
function clearRunning() { try { fs.unlinkSync(path.join(DATA_DIR, RUNNING_FILE)); } catch (e) {} }
function historyPush(entry) { history.unshift(entry); history = history.slice(0, 50); writeJSON("history.json", history); }

async function runPull(fromYear, origin, mode) {
  if (job.status === "running") return;
  origin = origin || { type: "manual" };
  mode = mode === "incremental" ? "incremental" : "full";
  let months, rangeStart = null;
  if (mode === "incremental") {
    const inc = incrementalStart();
    months = monthChunks(inc.year, inc.month0);   // เดือนก่อน → ปัจจุบัน
    rangeStart = inc.dateStr;
  } else {
    months = monthChunks(fromYear, 0);            // ทั้งปี fromYear → ปัจจุบัน
  }
  job = { status: "running", percent: 0, etaSec: null, done: 0, total: PULL_SOURCES.length * months.length,
    currentLabel: "เริ่มต้น…", startedAt: Date.now(), finishedAt: null, fromYear, error: null, rows: 0, origin, mode };
  writeRunning({ startedAt: job.startedAt, fromYear, origin, mode, resumeCount: origin.resumeCount || 0 });
  if (origin.type === "schedule") updateSchedule(origin.id, { lastStatus: "running", lastTrigger: bkStamp() });
  let totalRows = 0;
  try {
    for (const src of PULL_SOURCES) {
      const rows = [];
      for (const ch of months) {
        job.currentLabel = `${src.key} · ${ch.from.slice(0, 7)}${mode === "incremental" ? " (อัปเดต)" : ""}`;
        let got = null;
        for (const fields of src.tiers) {
          try { got = await windsorFetch(src.windsor, `date_from=${ch.from}&date_to=${ch.to}&fields=${fields}`); break; }
          catch (e) { got = null; /* ลอง tier ถัดไป */ }
        }
        if (got && got.length) rows.push(...got);
        job.done++;
        const elapsed = (Date.now() - job.startedAt) / 1000;
        job.percent = Math.round(job.done / job.total * 100);
        job.etaSec = job.done > 0 ? Math.round(elapsed / job.done * (job.total - job.done)) : null;
      }
      const prevData = store[src.key] || [];
      if (rows.length === 0 && prevData.length > 0) {
        // ได้ 0 แถว แต่ของเดิมมีข้อมูล → น่าจะ error ชั่วคราว ไม่แตะข้อมูลเดิม (กันข้อมูลหายเหมือนเคส facebook)
        console.log(`[pull] ${src.key}: ได้ 0 แถว (เดิมมี ${prevData.length}) → คงข้อมูลเดิมไว้`);
        totalRows += prevData.length;
        continue;
      }
      let finalRows;
      if (mode === "incremental") {
        // เก็บข้อมูลเดิมที่เก่ากว่า rangeStart ไว้ + เอาข้อมูลใหม่มาแทนช่วง [rangeStart → ปัจจุบัน]
        const kept = prevData.filter(r => !r.date || r.date < rangeStart);
        finalRows = kept.concat(rows);
      } else {
        finalRows = rows;
      }
      store[src.key] = finalRows;
      writeJSON(src.key + ".json", finalRows);
      totalRows += finalRows.length;
    }
    job.status = "done"; job.finishedAt = Date.now(); job.percent = 100; job.etaSec = 0; job.rows = totalRows; job.currentLabel = "เสร็จสิ้น";
    const durationSec = Math.round((job.finishedAt - job.startedAt) / 1000);
    meta = { lastPull: { at: job.finishedAt, fromYear, rows: totalRows, durationSec, mode } };
    writeJSON("meta.json", meta);
    historyPush({ at: job.finishedAt, fromYear, rows: totalRows, durationSec, status: "done", origin: origin.type, mode });
    if (origin.type === "schedule") updateSchedule(origin.id, { lastStatus: "done", lastSuccess: bkStamp() });
    clearRunning();
  } catch (e) {
    job.status = "error"; job.error = String(e.message || e); job.finishedAt = Date.now();
    historyPush({ at: Date.now(), fromYear, rows: totalRows, durationSec: Math.round((Date.now() - job.startedAt) / 1000), status: "error", error: job.error, origin: origin.type, mode });
    if (origin.type === "schedule") updateSchedule(origin.id, { lastStatus: "error" });
    clearRunning();
  }
}

// ---------- API: pull ----------
app.post("/api/pull", (req, res) => {
  if (!windsorKey()) return res.status(400).json({ error: "ไม่มี Windsor API key ฝั่ง server (env Windsor_key)" });
  if (job.status === "running") return res.status(409).json({ error: "กำลังดึงข้อมูลอยู่แล้ว", status: jobPublic() });
  const raw = req.query.fromYear || (req.body && req.body.fromYear) || "2025";
  let fromYear = parseInt(raw, 10);
  if (!fromYear || fromYear < 2015 || fromYear > new Date().getUTCFullYear()) fromYear = 2025;
  const mode = (req.query.mode || (req.body && req.body.mode)) === "incremental" ? "incremental" : "full";
  runPull(fromYear, { type: "manual" }, mode); // fire-and-forget
  res.json({ ok: true, status: jobPublic() });
});
app.get("/api/pull/status", (_req, res) => res.json(jobPublic()));
app.get("/api/pull/history", (_req, res) => res.json({ history, lastPull: meta.lastPull }));

// ---------- ตั้งเวลาดึงอัตโนมัติ (scheduler ฝั่ง server → รันแม้ไม่เปิดเว็บ) ----------
// schedule: { id, time, days[], fromYear, enabled,
//   lastTrigger (ยิงล่าสุดเมื่อ), lastSuccess (สำเร็จล่าสุดเมื่อ), lastStatus (running/done/error/interrupted/skipped) }
let schedules = readJSON("schedules.json", []);
function saveSchedules() { writeJSON("schedules.json", schedules); }
function normalizeSchedule(s) {
  const days = Array.isArray(s.days) ? [...new Set(s.days.map(Number).filter(d => d >= 0 && d <= 6))] : [];
  return {
    id: s.id || ("s" + Math.random().toString(36).slice(2, 9)),
    time: /^\d{2}:\d{2}$/.test(s.time) ? s.time : "08:00",
    days: days.length === 7 ? [] : days,     // ครบ 7 วัน = ทุกวัน (เก็บเป็น [])
    fromYear: parseInt(s.fromYear, 10) || 2025,
    mode: s.mode === "full" ? "full" : "incremental",   // ค่าเริ่มต้น = incremental (เร็ว)
    enabled: !!s.enabled,
    // migrate: ของเก่ามี lastRun (บันทึกตอน "เริ่ม" ไม่ใช่ "สำเร็จ") → ย้ายไป lastTrigger, ไม่นับว่าสำเร็จ
    lastTrigger: s.lastTrigger || s.lastRun || null,
    lastSuccess: s.lastSuccess || null,
    lastStatus: s.lastStatus || null,
  };
}
schedules = schedules.map(normalizeSchedule);
function updateSchedule(id, patch) {
  const s = schedules.find(x => x.id === id);
  if (s) { Object.assign(s, patch); saveSchedules(); }
}

app.get("/api/schedules", (_req, res) => res.json({ schedules }));
app.post("/api/schedules", (req, res) => {
  const list = (req.body && req.body.schedules);
  if (!Array.isArray(list)) return res.status(400).json({ error: "schedules ต้องเป็น array" });
  // รักษาสถานะเดิม (lastSuccess/lastStatus) ของ schedule ที่ id ตรงกัน
  const prev = {}; schedules.forEach(s => prev[s.id] = s);
  schedules = list.map(s => {
    const n = normalizeSchedule(s), old = prev[n.id];
    if (old) { n.lastTrigger = old.lastTrigger; n.lastSuccess = old.lastSuccess; n.lastStatus = old.lastStatus; }
    return n;
  });
  saveSchedules();
  res.json({ ok: true, schedules });
});

// เวลาปัจจุบันโซนไทย (Asia/Bangkok)
function bangkokParts() {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short",
  });
  const p = {}; fmt.formatToParts(new Date()).forEach(x => p[x.type] = x.value);
  const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { date: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}`, dow: dowMap[p.weekday] };
}
function bkStamp() { const t = bangkokParts(); return `${t.date} ${t.hm}`; }

// กู้คืนเมื่อ server กลับมา: ถ้ามี marker ค้าง = pull รอบก่อนถูกขัดจังหวะ (server restart กลางคัน)
function recoverInterrupted() {
  const r = readJSON(RUNNING_FILE, null);
  if (!r) return;
  const durationSec = r.startedAt ? Math.round((Date.now() - r.startedAt) / 1000) : 0;
  historyPush({ at: Date.now(), fromYear: r.fromYear, rows: 0, durationSec, status: "interrupted",
    error: "server restart กลางคัน", origin: (r.origin && r.origin.type) || "manual" });
  if (r.origin && r.origin.type === "schedule") updateSchedule(r.origin.id, { lastStatus: "interrupted" });
  clearRunning();
  const resumeCount = (r.resumeCount || 0) + 1;
  if (resumeCount <= 3) {
    console.log("[recover] ดึงรอบก่อนถูกขัดจังหวะ → เริ่มใหม่อัตโนมัติ (ครั้งที่", resumeCount + ")");
    setTimeout(() => runPull(r.fromYear, { ...(r.origin || { type: "manual" }), resumeCount }, r.mode), 4000);
  } else {
    console.log("[recover] ยกเลิก auto-resume (พยายามเกิน 3 ครั้ง)");
  }
}
recoverInterrupted();

// เช็คทุก 30 วิ — ถ้าถึงเวลาที่ตั้งไว้ & เปิดอยู่ → รัน pull (ยิงครั้งเดียวต่อ 1 นาที)
setInterval(() => {
  const t = bangkokParts();
  const stamp = `${t.date} ${t.hm}`;
  for (const s of schedules) {
    if (!s.enabled || s.time !== t.hm) continue;
    if (s.days && s.days.length && !s.days.includes(t.dow)) continue;
    if (s.lastTrigger === stamp) continue;          // ยิงไปแล้วในนาทีนี้
    if (job.status === "running") {
      s.lastTrigger = stamp; s.lastStatus = "skipped"; saveSchedules();
      console.log("[schedule] ข้าม (กำลังดึงอยู่)", s.time); continue;
    }
    console.log("[schedule] เริ่มดึงอัตโนมัติ", s.time, "fromYear", s.fromYear, "mode", s.mode);
    runPull(s.fromYear, { type: "schedule", id: s.id }, s.mode);   // runPull จะ set lastTrigger/lastStatus เอง
  }
}, 30000);

// ---------- API: data (หน้าเว็บอ่านจากตรงนี้) ----------
app.get("/api/data", (req, res) => {
  const connector = ALLOWED_CONNECTORS.has(req.query.connector) ? req.query.connector : "all";
  let rows = store[datasetForConnector(connector)] || [];
  let from = req.query.date_from, to = req.query.date_to;
  if (!from && req.query.date_preset) { const r = presetRange(req.query.date_preset); if (r) { from = r.from; to = r.to; } }
  if (from) rows = rows.filter(r => !r.date || r.date >= from);
  if (to) rows = rows.filter(r => !r.date || r.date <= to);
  res.json({ data: rows, pulled: !!meta.lastPull, lastPull: meta.lastPull });
});

// ---------- API: windsor proxy (เก็บไว้เผื่อ debug) ----------
app.get("/api/windsor", async (req, res) => {
  const key = req.header("x-windsor-key") || windsorKey();
  if (!key) return res.status(400).json({ error: "missing Windsor API key" });
  const params = new URLSearchParams(req.query);
  const connector = ALLOWED_CONNECTORS.has(params.get("connector")) ? params.get("connector") : "all";
  params.delete("connector");
  params.set("api_key", key);
  try {
    const r = await fetch(`https://connectors.windsor.ai/${connector}?${params.toString()}`);
    const body = await r.text();
    res.status(r.status).type("application/json").send(body);
  } catch (e) {
    res.status(502).json({ error: "proxy fetch failed: " + String(e) });
  }
});

// Apify proxy — ดึง engagement ของโพสต์ (reactions/shares/comments) จาก post URL
app.get("/api/apify", async (req, res) => {
  const key = process.env.Apify_key || process.env.APIFY_KEY || "";
  if (!key) return res.status(400).json({ error: "missing Apify key (env Apify_key)" });
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "missing post url" });
  const actor = (req.query.actor || process.env.Apify_actor || "scrapyspider/facebook-post-scraper").replace("/", "~");
  const urlField = process.env.Apify_url_field || "urls";
  const input = {}; input[urlField] = [url];
  try {
    const r = await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = await r.text();
    res.status(r.status).type("application/json").send(body);
  } catch (e) {
    res.status(502).json({ error: "apify fetch failed: " + String(e) });
  }
});

// Image proxy — ดึงรูป thumbnail (FB/IG CDN) มาแบบ same-origin เพื่อฝังใน PPT (เลี่ยง CORS)
app.get("/api/img", async (req, res) => {
  const url = req.query.url;
  if (!url || !/^https:\/\//i.test(url)) return res.status(400).end();
  let host = "";
  try { host = new URL(url).hostname; } catch (e) { return res.status(400).end(); }
  if (!/(fbcdn\.net|cdninstagram\.com|facebook\.com|akamaihd\.net|scontent)/i.test(host)) return res.status(403).end();
  try {
    const r = await fetch(url);
    const ct = r.headers.get("content-type") || "";
    if (!/^image\//i.test(ct)) return res.status(415).end();
    res.set("content-type", ct);
    res.set("cache-control", "public, max-age=86400");
    res.send(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    res.status(502).end();
  }
});

app.use(express.static(__dirname));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.listen(PORT, () => console.log("Windsor dashboard listening on :" + PORT + " · DATA_DIR=" + DATA_DIR));
