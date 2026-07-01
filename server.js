// Tiny proxy + static server for the Windsor dashboard.
// - Serves index.html (static)
// - /api/windsor proxies to Windsor (same-origin → no browser CORS issue)
//   API key comes from the request header (x-windsor-key, from the browser's
//   localStorage) or from the WINDSOR_API_KEY env var. It is never committed.
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
// อนุญาตเฉพาะ connector ที่รู้จัก (กัน SSRF/พิมพ์ผิด) — ค่าเริ่มต้น "all"
const ALLOWED_CONNECTORS = new Set(["all", "facebook", "facebook_organic", "instagram", "tiktok", "tiktok_organic", "twitter"]);

app.get("/api/windsor", async (req, res) => {
  const key = req.header("x-windsor-key") || process.env.WINDSOR_API_KEY || "";
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

app.use(express.static(__dirname));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.listen(PORT, () => console.log("Windsor dashboard listening on :" + PORT));
