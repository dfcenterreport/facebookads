// API: windsor proxy (เก็บไว้เผื่อ debug) — ยิงตรงไป Windsor ด้วย key ฝั่ง server
import { Router } from "express";
import { ALLOWED_CONNECTORS, windsorKey } from "../config";

const router = Router();

router.get("/windsor", async (req, res) => {
  const key = req.header("x-windsor-key") || windsorKey();
  if (!key) return res.status(400).json({ error: "missing Windsor API key" });
  const params = new URLSearchParams(req.query as Record<string, string>);
  const connectorRaw = params.get("connector") || "";
  const connector = ALLOWED_CONNECTORS.has(connectorRaw) ? connectorRaw : "all";
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

export default router;
