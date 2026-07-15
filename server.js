// Tiny proxy + static server for the Windsor dashboard.
// - Serves index.html (static)
// - /api/windsor proxies to Windsor (same-origin → no browser CORS issue)
//   API key comes from the `Windsor_key` env var (set in Railway), or from the
//   request header (x-windsor-key) as an override. It is never committed.
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
// อนุญาตเฉพาะ connector ที่รู้จัก (กัน SSRF/พิมพ์ผิด) — ค่าเริ่มต้น "all"
const ALLOWED_CONNECTORS = new Set(["all", "facebook", "facebook_organic", "instagram", "tiktok", "tiktok_organic", "twitter"]);

app.get("/api/windsor", async (req, res) => {
  const key = req.header("x-windsor-key") || process.env.Windsor_key || process.env.WINDSOR_API_KEY || "";
  if (!key) return res.status(400).json({ error: "missing Windsor API key" });

  const params = new URLSearchParams(req.query);
  const connector = ALLOWED_CONNECTORS.has(params.get("connector")) ? params.get("connector") : "all";
  params.delete("connector");            // ไม่ส่งต่อไป Windsor
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
// key จาก env Apify_key ; actor + ชื่อ input field ตั้งค่าได้ผ่าน env (ค่าเริ่มต้น = scrapyspider/facebook-post-scraper)
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

app.listen(PORT, () => console.log("Windsor dashboard listening on :" + PORT));
