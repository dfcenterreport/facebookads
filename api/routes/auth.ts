// API: auth proxy (Wazzup / Fareast Fameline identity) — เลี่ยง CORS
import { Router } from "express";
import { AUTH_BASE } from "../config";

const router = Router();

router.post("/auth/login", async (req, res) => {
  try {
    const r = await fetch(`${AUTH_BASE}/api/User/Authentication`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req.body || {}),
    });
    res.status(r.status).type("application/json").send(await r.text());
  } catch { res.status(502).json({ error: "auth proxy failed" }); }
});

router.get("/auth/profile", async (req, res) => {
  try {
    const r = await fetch(`${AUTH_BASE}/api/User/Profile`, { headers: { Authorization: req.header("authorization") || "" } });
    res.status(r.status).type("application/json").send(await r.text());
  } catch { res.status(502).json({ error: "profile proxy failed" }); }
});

export default router;
