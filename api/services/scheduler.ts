// ตั้งเวลาดึงอัตโนมัติ (scheduler ฝั่ง server → รันแม้ไม่เปิดเว็บ)
// schedule: { id, time, days[], fromYear, enabled,
//   lastTrigger (ยิงล่าสุดเมื่อ), lastSuccess (สำเร็จล่าสุดเมื่อ), lastStatus (running/done/error/interrupted/skipped) }
import { readJSON, writeJSON } from "../store";
import { bangkokParts, bkStamp } from "../lib/dates";
import { runPull, jobStatus } from "./pull";
import type { Schedule } from "../types";

let schedules: Schedule[] = readJSON<any[]>("schedules.json", []);

function saveSchedules(): void { writeJSON("schedules.json", schedules); }

export function normalizeSchedule(s: any): Schedule {
  const days = Array.isArray(s.days) ? [...new Set(s.days.map(Number).filter((d: number) => d >= 0 && d <= 6))] as number[] : [];
  return {
    id: s.id || ("s" + Math.random().toString(36).slice(2, 9)),
    time: /^\d{2}:\d{2}$/.test(s.time) ? s.time : "08:00",
    days: days.length === 7 ? [] : days,     // ครบ 7 วัน = ทุกวัน (เก็บเป็น [])
    fromYear: parseInt(s.fromYear, 10) || 2025,
    mode: s.mode === "full" ? "full" : "incremental",   // ค่าเริ่มต้น = incremental (เร็ว)
    enabled: !!s.enabled,
    // migrate: ของเก่ามี lastRun (บันทึกตอน "เริ่ม" ไม่ใช่ "สำเร็จ") → ย้ายไป lastTrigger, ไม่นับว่าสำเร็จ
    lastTrigger: s.lastTrigger || s.lastRun || null,
    lastSuccess: s.lastSuccess || null,
    lastStatus: s.lastStatus || null,
  };
}

schedules = schedules.map(normalizeSchedule);

export function getSchedules(): Schedule[] { return schedules; }

export function setSchedules(list: any[]): Schedule[] {
  // รักษาสถานะเดิม (lastSuccess/lastStatus) ของ schedule ที่ id ตรงกัน
  const prev: Record<string, Schedule> = {};
  schedules.forEach((s) => (prev[s.id] = s));
  schedules = list.map((s) => {
    const n = normalizeSchedule(s), old = prev[n.id];
    if (old) { n.lastTrigger = old.lastTrigger; n.lastSuccess = old.lastSuccess; n.lastStatus = old.lastStatus; }
    return n;
  });
  saveSchedules();
  return schedules;
}

export function updateSchedule(id: string, patch: Partial<Schedule>): void {
  const s = schedules.find((x) => x.id === id);
  if (s) {
    Object.assign(s, patch);
    // set lastTrigger/lastSuccess อัตโนมัติตามสถานะ (เดิม runPull ส่ง bkStamp มาเอง)
    if (patch.lastStatus === "running") s.lastTrigger = bkStamp();
    if (patch.lastStatus === "done") s.lastSuccess = bkStamp();
    saveSchedules();
  }
}

// เช็คทุก 30 วิ — ถ้าถึงเวลาที่ตั้งไว้ & เปิดอยู่ → รัน pull (ยิงครั้งเดียวต่อ 1 นาที)
export function startScheduler(): void {
  setInterval(() => {
    const t = bangkokParts();
    const stamp = `${t.date} ${t.hm}`;
    for (const s of schedules) {
      if (!s.enabled || s.time !== t.hm) continue;
      if (s.days && s.days.length && !s.days.includes(t.dow)) continue;
      if (s.lastTrigger === stamp) continue;          // ยิงไปแล้วในนาทีนี้
      if (jobStatus() === "running") {
        s.lastTrigger = stamp; s.lastStatus = "skipped"; saveSchedules();
        console.log("[schedule] ข้าม (กำลังดึงอยู่)", s.time); continue;
      }
      console.log("[schedule] เริ่มดึงอัตโนมัติ", s.time, "fromYear", s.fromYear, "mode", s.mode);
      runPull(s.fromYear, { type: "schedule", id: s.id }, s.mode);   // updateSchedule จะ set lastTrigger/lastStatus เอง
    }
  }, 30000);
}
