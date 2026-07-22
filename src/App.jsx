import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { doLogout } from "@/lib/auth";
import LoginGate from "@/components/LoginGate.jsx";
import Landing from "@/views/Landing.jsx";
import Dashboard from "@/views/Dashboard.jsx";
import CreativeReport from "@/views/CreativeReport.jsx";
import Benchmark from "@/views/Benchmark.jsx";
import ActiveAccounts from "@/views/ActiveAccounts.jsx";

const TABS = [
  { key: "app", label: "Dashboard" },
  { key: "biddable", label: "Creative Report" },
  { key: "benchmark", label: "Ad Benchmark" },
  { key: "activeacct", label: "Active Ad account" },
];

export default function App() {
  return <LoginGate>{(session) => <Shell session={session} />}</LoginGate>;
}

function Shell({ session }) {
  const [tab, setTab] = useState("app");
  const [inDashboard, setInDashboard] = useState(false);
  const [account, setAccount] = useState("__all__");
  // side view จะ mount ครั้งแรกเมื่อถูกเปิด แล้วคง state ไว้ตอนสลับแท็บ (เหมือน show/hide เดิม)
  const [visited, setVisited] = useState({ app: true });

  useEffect(() => {
    setVisited((v) => (v[tab] ? v : { ...v, [tab]: true }));
  }, [tab]);

  const show = (k) => ({ display: tab === k ? "block" : "none" });

  return (
    <>
      <nav className="topnav">
        <div className="topnav-brand">📊 Windsor Media</div>
        <div className="topnav-right">
          <div className="topnav-tabs">
            {TABS.map((t) => (
              <div
                key={t.key}
                className={cn("topnav-tab", tab === t.key && "active")}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </div>
            ))}
          </div>
          <div className="user-box">
            {session.photo ? (
              <img className="user-avatar" src={session.photo} alt="" />
            ) : (
              <div className="user-avatar ph">👤</div>
            )}
            <div className="user-meta">
              <span className="user-name">{session.name || "—"}</span>
              <span className="user-role">{session.role || session.position || ""}</span>
            </div>
            <button
              className="logout-btn"
              title="ออกจากระบบ"
              onClick={() => { if (confirm("ออกจากระบบ?")) doLogout(); }}
            >
              🚪
            </button>
          </div>
        </div>
      </nav>

      {/* Landing คง mount ไว้เสมอ (เก็บรายชื่อ account) — ซ่อนเมื่อเข้า dashboard */}
      <div style={{ display: tab === "app" && !inDashboard ? "block" : "none" }}>
        <Landing
          onSelect={(a) => {
            setAccount(a);
            setInDashboard(true);
          }}
        />
      </div>
      {inDashboard && (
        <div style={show("app")}>
          <Dashboard account={account} setAccount={setAccount} onBack={() => setInDashboard(false)} />
        </div>
      )}

      {visited.biddable && (
        <div style={show("biddable")}>
          <CreativeReport />
        </div>
      )}
      {visited.benchmark && (
        <div style={show("benchmark")}>
          <Benchmark active={tab === "benchmark"} />
        </div>
      )}
      {visited.activeacct && (
        <div style={show("activeacct")}>
          <ActiveAccounts />
        </div>
      )}
    </>
  );
}
