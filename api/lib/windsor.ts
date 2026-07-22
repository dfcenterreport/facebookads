// Windsor fetch (ฝั่ง server ใช้ key จาก env)
import { windsorKey } from "../config";
import type { Row } from "../types";

export async function windsorFetch(connector: string, params: string): Promise<Row[]> {
  const url = `https://connectors.windsor.ai/${connector}?${params}&api_key=${encodeURIComponent(windsorKey())}`;
  const r = await fetch(url);
  const text = await r.text();
  if (!r.ok) throw new Error(`Windsor HTTP ${r.status}: ${text.slice(0, 180)}`);
  let j: any;
  try { j = JSON.parse(text); } catch { throw new Error("Windsor: bad JSON"); }
  // Windsor คืน error เป็น HTTP 200 + {error:...} (เช่น field ไม่ valid) → ต้อง throw เพื่อให้ fallback ไป tier ถัดไป
  if (j && j.error) throw new Error(`Windsor: ${String(j.error).slice(0, 180)}`);
  return j.data || [];
}
