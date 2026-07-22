/* ============================================================
   LOGIN GATE — Wazzup / Fareast Fameline (skill: wazzup-authentication)
   จำกัดสิทธิ์เฉพาะ role "Windsor Admin"
   ============================================================ */
import { USE_PROXY } from "./windsor";

const AUTH_KEY = "wz_session";
const AUTH_BASE = "https://api.fareastfamelineddb.com";
export const REQUIRED_ROLE = /windsor\s*admin/i; // ต้องมี role นี้ถึงเข้าระบบได้

export function authGet() {
  try {
    const s = JSON.parse(sessionStorage.getItem(AUTH_KEY));
    if (!s || !s.access_token) return null;
    if (s.expiration && new Date(s.expiration).getTime() < Date.now()) {
      sessionStorage.removeItem(AUTH_KEY);
      return null;
    }
    return s;
  } catch (e) {
    return null;
  }
}

export function authSet(s) {
  try { sessionStorage.setItem(AUTH_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}

export function authClear() {
  try { sessionStorage.removeItem(AUTH_KEY); } catch (e) { /* ignore */ }
}

async function authFetchProfile(token) {
  const ep = USE_PROXY ? "/api/auth/profile" : `${AUTH_BASE}/api/User/Profile`;
  const res = await fetch(ep, { headers: { Authorization: "Bearer " + token } });
  if (res.status === 401) throw Object.assign(new Error("session expired"), { code: 401 });
  if (!res.ok) throw new Error("ตรวจสอบสิทธิ์ไม่สำเร็จ");
  return await res.json();
}

// รองรับ userRole ทั้งแบบ string / array ของ string / array ของ object / nested
function extractRoles(d) {
  const p = (d && d.profile) || {};
  let raw = (d && (d.userRole || d.roles)) || p.userRole || p.roles || [];
  if (typeof raw === "string") raw = [raw];
  if (!Array.isArray(raw)) raw = [raw];
  return raw
    .map((x) => (x == null ? "" : typeof x === "string" ? x : x.name || x.roleName || x.role || x.title || x.userRole || String(x)))
    .filter(Boolean);
}

function profileParts(d, fallback) {
  const p = (d && d.profile) || {};
  const roles = extractRoles(d);
  let photo = p.profileURL || fallback.photo || "";
  if (!photo && p.wazzupPhotoBase64) {
    const b = p.wazzupPhotoBase64;
    photo = b.startsWith("data:") ? b : "data:image/" + String(p.wazzupPhotoFileType || "png").replace(/^\./, "") + ";base64," + b;
  }
  return { roles, photo, name: p.empEngName || p.empThaiName || fallback.name };
}

export async function authLogin(user, pass) {
  const ep = USE_PROXY ? "/api/auth/login" : `${AUTH_BASE}/api/User/Authentication`;
  const res = await fetch(ep, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authenticationName: user, authenticationPassword: pass }),
  });
  if (res.status === 401) throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  if (!res.ok) throw new Error("เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่");
  let d;
  try { d = await res.json(); } catch (e) { throw new Error("เข้าสู่ระบบไม่สำเร็จ"); }
  if (!d || !d.access_token) throw new Error("เข้าสู่ระบบไม่สำเร็จ");
  const base = {
    access_token: d.access_token, expiration: d.expiration || null,
    name: d.empEngName || d.empThaiName || user,
    position: d.positionName || "", dept: d.departmentName || "", photo: d.profileURL || "",
  };
  // ตรวจ role ก่อนให้เข้า
  const prof = await authFetchProfile(d.access_token);
  const { roles, photo, name } = profileParts(prof, base);
  if (!roles.some((r) => REQUIRED_ROLE.test(r)))
    throw new Error("บัญชีนี้ไม่มีสิทธิ์เข้าระบบ (ต้องมี role Windsor Admin) · role ที่พบ: " + (roles.length ? roles.join(" | ") : "(ไม่มี role)"));
  const session = { ...base, role: roles.join(", "), photo, name, verified: true }; // เก็บ session เฉพาะเมื่อมีสิทธิ์
  authSet(session);
  return session;
}

export function doLogout() {
  authClear();
  location.reload();
}
