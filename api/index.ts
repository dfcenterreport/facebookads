// Windsor dashboard server (entry): proxy + on-disk data store + Pull job + scheduler
// - Serves ไฟล์ build ของ Vite (dist/)
// - /api/data        : serves stored (pulled) data, filtered by date  → หน้าเว็บอ่านจากตรงนี้ (เร็ว)
// - /api/pull        : เริ่ม job ดึงข้อมูลล่าสุดจาก Windsor มาเก็บใน DB (ไฟล์บน volume)
// - /api/pull/status : ความคืบหน้า + ETA ของ job ปัจจุบัน
// - /api/pull/history: ประวัติการดึงข้อมูล
// - /api/schedules   : ตั้งเวลาดึงอัตโนมัติ
// - /api/windsor     : proxy ตรงไป Windsor (เก็บไว้เผื่อ debug)
// - /api/fieldtest, /api/apify, /api/img, /api/auth/* : ตามเดิม
// Windsor API key มาจาก env `Windsor_key` (ตั้งใน Railway) — ไม่ commit ลงไฟล์
import express from "express";
import path from "path";
import { PORT, DATA_DIR, DIST_DIR } from "./config";
import api from "./routes";
import { recoverInterrupted } from "./services/pull";
import { startScheduler } from "./services/scheduler";

const app = express();
app.use(express.json());

// mount API ทั้งหมดใต้ /api
app.use("/api", api);

// กู้คืน pull ที่ค้าง + เริ่ม scheduler
recoverInterrupted();
startScheduler();

// serve ไฟล์ build ของ Vite (dist/) — ตอน dev ใช้ `npm run dev` (vite จะ proxy /api มาที่ server นี้)
app.use(express.static(DIST_DIR));
app.get("*", (_req, res) => res.sendFile(path.join(DIST_DIR, "index.html")));

app.listen(PORT, () => console.log("Windsor dashboard listening on :" + PORT + " · DATA_DIR=" + DATA_DIR));
