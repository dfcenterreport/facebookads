// API: field test — ตรวจว่า field ไหน valid + มีค่าจริง (ช่วง 30 วันล่าสุด)
import { Router } from "express";
import { ALLOWED_CONNECTORS, FIELDTEST_DEFAULTS } from "../config";
import { windsorFetch } from "../lib/windsor";
import { todayStr } from "../lib/dates";

const router = Router();

router.get("/fieldtest", async (req, res) => {
  const connectorQ = String(req.query.connector || "");
  const connector = ALLOWED_CONNECTORS.has(connectorQ) ? connectorQ : "facebook";
  const cands = String(req.query.fields || "").split(",").map((s) => s.trim()).filter(Boolean);
  const list = cands.length ? cands : (FIELDTEST_DEFAULTS[connector] || FIELDTEST_DEFAULTS.facebook);
  const to = todayStr();
  const from = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const out: Record<string, string> = {};
  for (const f of list) {
    try {
      const rows = await windsorFetch(connector, `date_from=${from}&date_to=${to}&fields=account_name,${f}`);
      const has = rows.some((r) => r[f] != null && r[f] !== "" && +r[f] > 0);
      out[f] = rows.length ? (has ? "OK (มีค่า)" : "OK (ว่าง/0)") : "OK (0 rows)";
    } catch (e: any) { out[f] = "ERROR: " + String(e?.message).slice(0, 100); }
  }
  res.json({ connector, from, to, result: out });
});

export default router;
