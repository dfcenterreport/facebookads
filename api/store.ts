// เก็บ/อ่านข้อมูลบนดิสก์ (ไฟล์ JSON บน volume) + in-memory store ที่โหลดตอนบูต
import path from "path";
import fs from "fs";
import { DATA_DIR, DATASET_KEYS } from "./config";
import type { Row, Meta, HistoryEntry } from "./types";

export function readJSON<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8")) as T; }
  catch { return fallback; }
}

export function writeJSON(file: string, data: unknown): void {
  try { fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data)); }
  catch (e: any) { console.error("write fail", file, e?.message); }
}

// ---------- in-memory store (โหลดจากดิสก์ตอนบูต) ----------
export const store: Record<string, Row[]> = {};
DATASET_KEYS.forEach((k) => (store[k] = []));

let meta: Meta = { lastPull: null };
let history: HistoryEntry[] = [];

export function loadStore(): void {
  DATASET_KEYS.forEach((k) => (store[k] = readJSON<Row[]>(k + ".json", [])));
  meta = readJSON<Meta>("meta.json", { lastPull: null });
  history = readJSON<HistoryEntry[]>("history.json", []);
}

export function getMeta(): Meta { return meta; }
export function setMeta(m: Meta): void { meta = m; writeJSON("meta.json", meta); }

export function getHistory(): HistoryEntry[] { return history; }
export function historyPush(entry: HistoryEntry): void {
  history.unshift(entry);
  history = history.slice(0, 50);
  writeJSON("history.json", history);
}

loadStore();
