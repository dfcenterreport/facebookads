// API: apify proxy — ดึง engagement ของโพสต์ (reactions/shares/comments) จาก post URL
import { Router } from "express";

const router = Router();

router.get("/apify", async (req, res) => {
  const key = process.env.Apify_key || process.env.APIFY_KEY || "";
  if (!key) return res.status(400).json({ error: "missing Apify key (env Apify_key)" });
  const url = req.query.url as string | undefined;
  if (!url) return res.status(400).json({ error: "missing post url" });
  const actor = String(req.query.actor || process.env.Apify_actor || "scrapyspider/facebook-post-scraper").replace("/", "~");
  const urlField = process.env.Apify_url_field || "urls";
  const input: Record<string, string[]> = {}; input[urlField] = [url];
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

export default router;
