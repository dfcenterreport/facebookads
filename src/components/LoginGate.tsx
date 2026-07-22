import { useEffect, useState } from "react";
import { authGet, authClear, authLogin } from "@/lib/auth";

/**
 * บังคับ login ด้วยบัญชี Wazzup / Fareast Fameline ก่อนเข้าแอป
 * children เป็น render-prop: (session, logout) => JSX
 */
export default function LoginGate({ children, onLogout }) {
  const [session, setSession] = useState(() => {
    const s = authGet();
    return s && s.verified ? s : null;
  });
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // session เก่า/ไม่ผ่าน role → บังคับ login ใหม่
  useEffect(() => {
    const s = authGet();
    if (s && !s.verified) authClear();
  }, []);

  if (session) return children(session);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const s = await authLogin(user.trim(), pass);
      setPass(""); // ไม่เก็บรหัสผ่าน
      setSession(s);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-view" style={{ display: "flex" }}>
      <div className="login-card">
        <div className="login-brand">📊 Windsor Media</div>
        <div className="login-sub">เข้าสู่ระบบด้วยบัญชี Wazzup / Fareast Fameline</div>
        <form onSubmit={submit} autoComplete="on">
          <label>
            Username
            <input autoComplete="username" required value={user} onChange={(e) => setUser(e.target.value)} />
          </label>
          <label>
            Password
            <input type="password" autoComplete="current-password" required value={pass} onChange={(e) => setPass(e.target.value)} />
          </label>
          {err && <div className="login-err">{err}</div>}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
          </button>
        </form>
        <div className="login-foot">เฉพาะพนักงานที่มีสิทธิ์เข้าถึงเท่านั้น</div>
      </div>
    </div>
  );
}
