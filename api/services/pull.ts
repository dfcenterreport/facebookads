// Pull job (singleton) — ดึงข้อมูลจาก Windsor มาเก็บลงดิสก์ พร้อม progress/ETA + กู้คืนเมื่อ server restart
import path from "path";
import fs from "fs";
import { PULL_SOURCES, windsorKey, DATA_DIR } from "../config";
import { windsorFetch } from "../lib/windsor";
import { monthChunks, incrementalStart } from "../lib/dates";
import { store, writeJSON, readJSON, setMeta, historyPush } from "../store";
import { updateSchedule } from "./scheduler";
import type { Job, Origin, PullMode, Row, RunningMarker } from "../types";

let job: Job = {
  status: "idle", percent: 0, etaSec: null, done: 0, total: 0, currentLabel: "",
  startedAt: null, finishedAt: null, fromYear: null, error: null, rows: 0, origin: null, mode: null,
};

export function jobPublic(): Job {
  return { status: job.status, percent: job.percent, etaSec: job.etaSec, done: job.done, total: job.total,
    currentLabel: job.currentLabel, startedAt: job.startedAt, finishedAt: job.finishedAt, fromYear: job.fromYear,
    error: job.error, rows: job.rows, origin: job.origin, mode: job.mode };
}

export function jobStatus(): Job["status"] { return job.status; }

// marker บนดิสก์: มีไฟล์นี้ = มี pull กำลังรันอยู่ ถ้า process ตายกลางคัน (server restart) ไฟล์จะค้าง → ใช้ตรวจว่าถูกขัดจังหวะ
const RUNNING_FILE = "running.json";
function writeRunning(info: RunningMarker): void { writeJSON(RUNNING_FILE, info); }
function clearRunning(): void { try { fs.unlinkSync(path.join(DATA_DIR, RUNNING_FILE)); } catch { /* ignore */ } }

export async function runPull(fromYear: number, origin?: Origin, mode?: string): Promise<void> {
  if (job.status === "running") return;
  const org: Origin = origin || { type: "manual" };
  const runMode: PullMode = mode === "incremental" ? "incremental" : "full";
  let months, rangeStart: string | null = null;
  if (runMode === "incremental") {
    const inc = incrementalStart();
    months = monthChunks(inc.year, inc.month0);   // เดือนก่อน → ปัจจุบัน
    rangeStart = inc.dateStr;
  } else {
    months = monthChunks(fromYear, 0);            // ทั้งปี fromYear → ปัจจุบัน
  }
  job = { status: "running", percent: 0, etaSec: null, done: 0, total: PULL_SOURCES.length * months.length,
    currentLabel: "เริ่มต้น…", startedAt: Date.now(), finishedAt: null, fromYear, error: null, rows: 0, origin: org, mode: runMode };
  writeRunning({ startedAt: job.startedAt, fromYear, origin: org, mode: runMode, resumeCount: org.resumeCount || 0 });
  if (org.type === "schedule" && org.id) updateSchedule(org.id, { lastStatus: "running" });
  let totalRows = 0;
  try {
    for (const src of PULL_SOURCES) {
      const rows: Row[] = [];
      for (const ch of months) {
        job.currentLabel = `${src.key} · ${ch.from.slice(0, 7)}${runMode === "incremental" ? " (อัปเดต)" : ""}`;
        let got: Row[] | null = null;
        for (const fields of src.tiers) {
          try { got = await windsorFetch(src.windsor, `date_from=${ch.from}&date_to=${ch.to}&fields=${fields}`); break; }
          catch { got = null; /* ลอง tier ถัดไป */ }
        }
        if (got && got.length) rows.push(...got);
        job.done++;
        const elapsed = (Date.now() - (job.startedAt as number)) / 1000;
        job.percent = Math.round(job.done / job.total * 100);
        job.etaSec = job.done > 0 ? Math.round(elapsed / job.done * (job.total - job.done)) : null;
      }
      const prevData = store[src.key] || [];
      if (rows.length === 0 && prevData.length > 0) {
        // ได้ 0 แถว แต่ของเดิมมีข้อมูล → น่าจะ error ชั่วคราว ไม่แตะข้อมูลเดิม (กันข้อมูลหายเหมือนเคส facebook)
        console.log(`[pull] ${src.key}: ได้ 0 แถว (เดิมมี ${prevData.length}) → คงข้อมูลเดิมไว้`);
        totalRows += prevData.length;
        continue;
      }
      let finalRows: Row[];
      if (runMode === "incremental") {
        // เก็บข้อมูลเดิมที่เก่ากว่า rangeStart ไว้ + เอาข้อมูลใหม่มาแทนช่วง [rangeStart → ปัจจุบัน]
        const kept = prevData.filter((r) => !r.date || r.date < (rangeStart as string));
        finalRows = kept.concat(rows);
      } else {
        finalRows = rows;
      }
      store[src.key] = finalRows;
      writeJSON(src.key + ".json", finalRows);
      totalRows += finalRows.length;
    }
    job.status = "done"; job.finishedAt = Date.now(); job.percent = 100; job.etaSec = 0; job.rows = totalRows; job.currentLabel = "เสร็จสิ้น";
    const durationSec = Math.round((job.finishedAt - (job.startedAt as number)) / 1000);
    setMeta({ lastPull: { at: job.finishedAt, fromYear, rows: totalRows, durationSec, mode: runMode } });
    historyPush({ at: job.finishedAt, fromYear, rows: totalRows, durationSec, status: "done", origin: org.type, mode: runMode });
    if (org.type === "schedule" && org.id) updateSchedule(org.id, { lastStatus: "done" });
    clearRunning();
  } catch (e: any) {
    job.status = "error"; job.error = String(e?.message || e); job.finishedAt = Date.now();
    historyPush({ at: Date.now(), fromYear, rows: totalRows, durationSec: Math.round((Date.now() - (job.startedAt as number)) / 1000), status: "error", error: job.error, origin: org.type, mode: runMode });
    if (org.type === "schedule" && org.id) updateSchedule(org.id, { lastStatus: "error" });
    clearRunning();
  }
}

// กู้คืนเมื่อ server กลับมา: ถ้ามี marker ค้าง = pull รอบก่อนถูกขัดจังหวะ (server restart กลางคัน)
export function recoverInterrupted(): void {
  const r = readJSON<RunningMarker | null>(RUNNING_FILE, null);
  if (!r) return;
  const durationSec = r.startedAt ? Math.round((Date.now() - r.startedAt) / 1000) : 0;
  historyPush({ at: Date.now(), fromYear: r.fromYear, rows: 0, durationSec, status: "interrupted",
    error: "server restart กลางคัน", origin: (r.origin && r.origin.type) || "manual" });
  if (r.origin && r.origin.type === "schedule" && r.origin.id) updateSchedule(r.origin.id, { lastStatus: "interrupted" });
  clearRunning();
  const resumeCount = (r.resumeCount || 0) + 1;
  if (resumeCount <= 3) {
    console.log("[recover] ดึงรอบก่อนถูกขัดจังหวะ → เริ่มใหม่อัตโนมัติ (ครั้งที่", resumeCount + ")");
    setTimeout(() => runPull(r.fromYear as number, { ...(r.origin || { type: "manual" }), resumeCount }, r.mode), 4000);
  } else {
    console.log("[recover] ยกเลิก auto-resume (พยายามเกิน 3 ครั้ง)");
  }
}
