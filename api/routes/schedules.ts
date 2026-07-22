// API: schedules — อ่าน/บันทึกตารางดึงอัตโนมัติ
import { Router } from "express";
import { getSchedules, setSchedules } from "../services/scheduler";

const router = Router();

router.get("/schedules", (_req, res) => res.json({ schedules: getSchedules() }));

router.post("/schedules", (req, res) => {
  const list = req.body && req.body.schedules;
  if (!Array.isArray(list)) return res.status(400).json({ error: "schedules ต้องเป็น array" });
  const schedules = setSchedules(list);
  res.json({ ok: true, schedules });
});

export default router;
