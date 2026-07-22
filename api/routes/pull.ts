// API: pull — เริ่ม job ดึงข้อมูล / ดูสถานะ / ประวัติ
import { Router } from "express";
import { windsorKey } from "../config";
import { jobPublic, jobStatus, runPull } from "../services/pull";
import { getHistory, getMeta } from "../store";

const router = Router();

router.post("/pull", (req, res) => {
  if (!windsorKey()) return res.status(400).json({ error: "ไม่มี Windsor API key ฝั่ง server (env Windsor_key)" });
  if (jobStatus() === "running") return res.status(409).json({ error: "กำลังดึงข้อมูลอยู่แล้ว", status: jobPublic() });
  const raw = req.query.fromYear || (req.body && req.body.fromYear) || "2025";
  let fromYear = parseInt(raw as string, 10);
  if (!fromYear || fromYear < 2015 || fromYear > new Date().getUTCFullYear()) fromYear = 2025;
  const mode = (req.query.mode || (req.body && req.body.mode)) === "incremental" ? "incremental" : "full";
  runPull(fromYear, { type: "manual" }, mode); // fire-and-forget
  res.json({ ok: true, status: jobPublic() });
});

router.get("/pull/status", (_req, res) => res.json(jobPublic()));
router.get("/pull/history", (_req, res) => res.json({ history: getHistory(), lastPull: getMeta().lastPull }));

export default router;
