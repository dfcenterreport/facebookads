// API: data (หน้าเว็บอ่านจากตรงนี้) — serve ข้อมูลที่ pull มาแล้ว กรองตามวันที่
import { Router } from "express";
import { ALLOWED_CONNECTORS, datasetForConnector } from "../config";
import { presetRange } from "../lib/dates";
import { store, getMeta } from "../store";

const router = Router();

router.get("/data", (req, res) => {
  const connectorQ = String(req.query.connector || "");
  const connector = ALLOWED_CONNECTORS.has(connectorQ) ? connectorQ : "all";
  let rows = store[datasetForConnector(connector)] || [];
  let from = req.query.date_from as string | undefined;
  let to = req.query.date_to as string | undefined;
  if (!from && req.query.date_preset) {
    const r = presetRange(String(req.query.date_preset));
    if (r) { from = r.from; to = r.to; }
  }
  if (from) rows = rows.filter((r) => !r.date || r.date >= (from as string));
  if (to) rows = rows.filter((r) => !r.date || r.date <= (to as string));
  const meta = getMeta();
  res.json({ data: rows, pulled: !!meta.lastPull, lastPull: meta.lastPull });
});

export default router;
