// API: image proxy — ดึงรูป thumbnail (FB/IG CDN) มาแบบ same-origin เพื่อฝังใน PPT (เลี่ยง CORS)
import { Router } from "express";

const router = Router();

router.get("/img", async (req, res) => {
  const url = req.query.url as string | undefined;
  if (!url || !/^https:\/\//i.test(url)) return res.status(400).end();
  let host = "";
  try { host = new URL(url).hostname; } catch { return res.status(400).end(); }
  if (!/(fbcdn\.net|cdninstagram\.com|facebook\.com|akamaihd\.net|scontent)/i.test(host)) return res.status(403).end();
  try {
    const r = await fetch(url);
    const ct = r.headers.get("content-type") || "";
    if (!/^image\//i.test(ct)) return res.status(415).end();
    res.set("content-type", ct);
    res.set("cache-control", "public, max-age=86400");
    res.send(Buffer.from(await r.arrayBuffer()));
  } catch {
    res.status(502).end();
  }
});

export default router;
