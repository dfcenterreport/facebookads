// ชนิดข้อมูลกลางที่ใช้ร่วมกันทั้งฝั่ง server (Windsor dashboard)

// แถวข้อมูลจาก Windsor — field ไม่คงที่ (ขึ้นกับ connector/tier) → เก็บเป็น loose record
export type Row = Record<string, any>;

export type PullMode = "full" | "incremental";

export interface PullSource {
  key: string;
  windsor: string;
  tiers: string[];
}

export interface Origin {
  type: "manual" | "schedule";
  id?: string;
  resumeCount?: number;
}

export interface Job {
  status: "idle" | "running" | "done" | "error";
  percent: number;
  etaSec: number | null;
  done: number;
  total: number;
  currentLabel: string;
  startedAt: number | null;
  finishedAt: number | null;
  fromYear: number | null;
  error: string | null;
  rows: number;
  origin: Origin | null;
  mode: PullMode | null;
}

export interface LastPull {
  at: number;
  fromYear: number | null;
  rows: number;
  durationSec: number;
  mode: PullMode;
}

export interface Meta {
  lastPull: LastPull | null;
}

export interface HistoryEntry {
  at: number;
  fromYear: number | null;
  rows: number;
  durationSec: number;
  status: "done" | "error" | "interrupted";
  error?: string;
  origin?: string;
  mode?: PullMode;
}

export interface Schedule {
  id: string;
  time: string;
  days: number[];
  fromYear: number;
  mode: PullMode;
  enabled: boolean;
  lastTrigger: string | null;
  lastSuccess: string | null;
  lastStatus: string | null;
}

export interface RunningMarker {
  startedAt: number | null;
  fromYear: number | null;
  origin: Origin;
  mode: PullMode;
  resumeCount?: number;
}
