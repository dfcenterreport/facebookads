import { useEffect, useMemo, useRef, useState } from "react";
import { wfetch, ensureKey, storyToUrl, fetchApify, apGet, BID_BASE, BID_OPT_TIERS, ORG_TIERS } from "@/lib/windsor";
import { acctOf, postSuffix, fmtInt, fmtMoney, fmtPct, fmtK } from "@/lib/format";
import { cn } from "@/lib/utils";
import Pills from "@/components/Pills.jsx";
import KpiCard from "@/components/KpiCard.jsx";
import RecoList from "@/components/RecoList.jsx";
import ChartCanvas, { yellowGradient } from "@/components/ChartCanvas.jsx";

const PRESETS = [
  { value: "last_7d", label: "7 วัน" },
  { value: "last_14d", label: "14 วัน" },
  { value: "last_30d", label: "30 วัน" },
  { value: "this_month", label: "เดือนนี้" },
  { value: "last_month", label: "เดือนก่อน" },
];

/* รวมตาม "โพสต์เดียวกัน" (post id จาก storyId) → ครีเอทีฟที่ยิงหลายแคมเปญ/adset แต่โพสต์เดียวกัน = การ์ดเดียว
   spend/impressions/clicks = รวม (sum) ; reach = unique → ใช้ max ไม่ sum */
function buildCreatives(data) {
  const m = {};
  data.forEach((r) => {
    const pid = postSuffix(r.storyId);
    const k = pid ? "post:" + pid : "ad:" + r.ad + "|" + r.adset;
    if (!m[k]) m[k] = { key: k, ad: r.ad, adset: r.adset, thumb: "", link: "", storyId: r.storyId || "", spend: 0, impressions: 0, reach: 0, clicks: 0, days: {}, campaigns: new Set(), adsets: new Set() };
    const c = m[k];
    c.spend += r.spend; c.impressions += r.impressions; c.clicks += r.clicks;
    c.reach = Math.max(c.reach, r.reach); // reach = unique → max
    if (r.campaign) c.campaigns.add(r.campaign);
    if (r.adset) c.adsets.add(r.adset);
    if (!c.thumb && r.thumb) c.thumb = r.thumb;
    if (!c.link && r.link) c.link = r.link;
    if (!c.storyId && r.storyId) c.storyId = r.storyId;
    const d = c.days[r.date] || (c.days[r.date] = { spend: 0, impr: 0, reach: 0, clicks: 0 });
    d.spend += r.spend; d.impr += r.impressions; d.clicks += r.clicks; d.reach = Math.max(d.reach, r.reach);
  });
  return Object.values(m).sort((a, b) => b.spend - a.spend);
}

const creKey = (c) => c.key || c.ad + "||" + c.adset;

/* จับคู่ creative (ad) ↔ โพสต์จริง (organic) ด้วย post id จริงเท่านั้น */
function computeOrgMatches(orgPosts, creatives) {
  const orgMatch = {};
  if (!orgPosts.length || !creatives.length) return orgMatch;
  const avail = orgPosts.slice();
  creatives.forEach((c) => {
    const cs = postSuffix(c.storyId);
    if (!cs) return;
    const hit = avail.find((p) => postSuffix(p.id) === cs);
    if (hit) {
      hit._by = "id";
      orgMatch[creKey(c)] = hit;
      const i = avail.indexOf(hit);
      if (i >= 0) avail.splice(i, 1);
    }
  });
  return orgMatch;
}

/* ===== AI Recommendation (rule-based) — วิเคราะห์ KPI/creative แล้วสร้างคำแนะนำ ===== */
function bidRecommendations(t, list) {
  const recos = [];
  const push = (level, ic, title, detail) => recos.push({ level, ic, title, detail });
  const short = (s) => { s = String(s == null ? "" : s); return s.length > 44 ? s.slice(0, 42) + "…" : s; };
  const ctr = t.impr ? t.clicks / t.impr : 0;
  const freq = t.reach ? t.impr / t.reach : 0;
  const cpm = t.impr ? (t.spend / t.impr) * 1000 : 0;

  // 1) CTR เทียบเกณฑ์อุตสาหกรรม (~0.9%)
  if (t.impr > 0) {
    if (ctr < 0.005) push("bad", "🎯", `CTR ต่ำ (${fmtPct(ctr)})`, `ต่ำกว่าค่าเฉลี่ยทั่วไป (~0.9%) มาก — ครีเอทีฟ/ข้อความอาจไม่ดึงดูด ลองเปลี่ยน hook รูปหรือพาดหัว และทบทวน targeting`);
    else if (ctr < 0.009) push("warn", "🎯", `CTR ค่อนข้างต่ำ (${fmtPct(ctr)})`, `ยังต่ำกว่าค่าเฉลี่ยอุตสาหกรรม (~0.9%) — ลองทดสอบครีเอทีฟใหม่เพื่อดันอัตราคลิก`);
    else push("good", "🎯", `CTR อยู่ในเกณฑ์ดี (${fmtPct(ctr)})`, `สูงกว่าค่าเฉลี่ยทั่วไป — ครีเอทีฟทำงานได้ดี พิจารณาเพิ่มงบให้ตัวที่เด่น`);
  }

  // 2) Frequency / ad fatigue
  if (freq >= 5) push("bad", "🔁", `Frequency สูงมาก (${freq.toFixed(2)})`, `ผู้ชมเห็นซ้ำเฉลี่ย ${freq.toFixed(1)} ครั้ง เสี่ยง ad fatigue สูง — ควรเปลี่ยนครีเอทีฟหรือขยายกลุ่มเป้าหมาย`);
  else if (freq >= 3.5) push("warn", "🔁", `Frequency เริ่มสูง (${freq.toFixed(2)})`, `เข้าเขตเสี่ยงเห็นซ้ำ (>3.5) เริ่มมีสัญญาณ fatigue — เตรียมครีเอทีฟใหม่หมุนเวียนไว้`);

  // 3) วิเคราะห์รายครีเอทีฟ
  const wm = list.map((c) => ({ c, ctr: c.impressions ? c.clicks / c.impressions : 0, cpm: c.impressions ? (c.spend / c.impressions) * 1000 : 0, spend: c.spend })).filter((x) => x.spend > 0);
  if (wm.length >= 2) {
    const sig = wm.filter((x) => x.spend >= t.spend * 0.03);
    const pool = sig.length ? sig : wm;
    const best = [...pool].sort((a, b) => b.ctr - a.ctr)[0];
    const worst = [...pool].sort((a, b) => a.ctr - b.ctr)[0];
    if (best && ctr > 0 && best.ctr > ctr * 1.15)
      push("good", "🏆", `ครีเอทีฟเด่น: ${short(best.c.ad)}`, `CTR ${fmtPct(best.ctr)} สูงกว่าค่าเฉลี่ยรวม — พิจารณาเพิ่มงบ/ขยายผลตัวนี้`);
    if (worst && worst !== best && worst.spend >= t.spend * 0.05 && ctr > 0 && worst.ctr < ctr * 0.6)
      push("bad", "🛑", `ครีเอทีฟฉุดภาพรวม: ${short(worst.c.ad)}`, `ใช้งบ ${fmtMoney(worst.spend)} แต่ CTR แค่ ${fmtPct(worst.ctr)} (ต่ำกว่าค่าเฉลี่ยมาก) — พิจารณาหยุดหรือปรับใหม่`);
    const hi = [...pool].sort((a, b) => b.cpm - a.cpm)[0];
    if (hi && cpm > 0 && hi.cpm > cpm * 1.5 && hi.spend >= t.spend * 0.05)
      push("warn", "💸", `CPM สูงผิดปกติ: ${short(hi.c.ad)}`, `CPM ฿${hi.cpm.toFixed(1)} สูงกว่าค่าเฉลี่ยรวม (฿${cpm.toFixed(1)}) ~${Math.round((hi.cpm / cpm) * 100 - 100)}% — ต้นทุนการเข้าถึงแพงกว่าปกติ`);
  }

  // 4) การกระจุกตัวของงบ
  if (wm.length >= 3 && t.spend > 0) {
    const sorted = [...wm].sort((a, b) => b.spend - a.spend);
    const share = sorted[0].spend / t.spend;
    if (share > 0.6)
      push("info", "📊", "งบกระจุกตัวในครีเอทีฟเดียว", `${short(sorted[0].c.ad)} กินงบ ${Math.round(share * 100)}% ของทั้งหมด — หากตัวนี้พลาดจะกระทบภาพรวม ควรกระจายความเสี่ยง`);
  }

  if (!recos.length) push("good", "✅", "ภาพรวมอยู่ในเกณฑ์ดี", "ไม่พบสัญญาณผิดปกติที่ต้องดำเนินการเร่งด่วนในช่วงที่เลือก");
  return recos;
}

export default function CreativeReport() {
  const [preset, setPreset] = useState("last_30d");
  const [account, setAccount] = useState("__all__");
  const [campaign, setCampaign] = useState("");
  const [raw, setRaw] = useState([]);
  const [noImg, setNoImg] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orgPosts, setOrgPosts] = useState([]);
  const [selKey, setSelKey] = useState(null);
  const [reload, setReload] = useState(0);
  const [debug, setDebug] = useState(null); // {title, blocks:[{name,text}]}
  const apifyCache = useRef({}); // url -> item | null(fail) | "loading"
  const [apVer, setApVer] = useState(0);
  const autoRef = useRef(true); // ครั้งแรก: เลือกบัญชี Pao อัตโนมัติถ้ามี

  /* ---- โหลดข้อมูล ads (connector facebook ตรงๆ — field เฉพาะ FB ครบ) ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ensureKey(false)) { setError("ยังไม่มี API key"); setLoading(false); return; }
      setLoading(true); setError(""); setSelKey(null);
      try {
        let data = null, opt = "", lastStatus = 0, lastBody = "";
        for (const o of BID_OPT_TIERS) {
          const f = BID_BASE + (o ? "," + o : "");
          const res = await wfetch(`date_preset=${preset}&fields=${f}`, "facebook");
          if (res.ok) { data = (await res.json()).data || []; opt = o; break; }
          lastStatus = res.status; lastBody = (await res.text()).slice(0, 200);
          // ถ้าเป็นปัญหา key/สิทธิ์ (ไม่ใช่ field) ไม่ต้องลอง tier ต่อ
          if ([400, 401, 403].includes(lastStatus) && /key|auth|token|unauthor|permission/i.test(lastBody)) break;
        }
        if (data === null) throw new Error(`Windsor ปฏิเสธทุกชุด field (HTTP ${lastStatus}: ${lastBody || "—"})`);
        if (cancelled) return;
        setNoImg(!/thumbnail_url/.test(opt));
        const rows = data.map((r) => ({
          account: acctOf(r), campaign: r.campaign || "(ไม่ระบุแคมเปญ)",
          adset: r.adset_name || "(ไม่ระบุ adset)", ad: r.ad_name || "(ไม่ระบุ ad)",
          thumb: r.thumbnail_url || "", storyId: r.object_story_id || r.effective_object_story_id || "",
          link: r.permalink_url || storyToUrl(r.object_story_id || r.effective_object_story_id), date: r.date,
          spend: +r.spend || 0, impressions: +r.impressions || 0, reach: +r.reach || 0, clicks: +r.clicks || 0,
        }));
        setRaw(rows);
        if (autoRef.current) {
          const pacc = [...new Set(rows.map((r) => r.account))].find((a) => /pao/i.test(a));
          if (pacc) setAccount(pacc);
          autoRef.current = false;
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e.name === "AbortError" ? "หมดเวลา (timeout 45s) — Windsor ตอบช้า/ไม่ตอบ อาจเพราะ field เยอะเกินหรือ server มีปัญหา" : e.message;
          setError(`❌ ดึงข้อมูลไม่สำเร็จ: ${msg}`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [preset, reload]);

  /* ---- ดึงข้อมูลโพสต์จริงจาก Page Insights (ไม่บล็อกจอหลัก) ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let i = 0; i < ORG_TIERS.length; i++) {
        try {
          const res = await wfetch(`date_preset=${preset}&fields=${ORG_TIERS[i]}`, "facebook_organic");
          if (!res.ok) continue;
          const rows = (await res.json()).data || [];
          const m = {};
          rows.forEach((r) => {
            const id = r.post_id || r.permalink_url || r.message;
            if (!id) return;
            if (!m[id]) m[id] = { id, permalink: r.permalink_url || "", message: r.message || "", impr: 0, imprOrg: 0, imprPaid: 0, reach: 0, reachOrg: 0, reachPaid: 0, like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0, clicks: 0 };
            const p = m[id];
            // lifetime metric = ค่าสะสม → ใช้ max ของแต่ละวันแทนยอดรวม
            const mx = (k, v) => { p[k] = Math.max(p[k], +v || 0); };
            mx("impr", r.post_impressions); mx("imprOrg", r.post_impressions_organic); mx("imprPaid", r.post_impressions_paid);
            mx("reach", r.post_impressions_unique); mx("reachOrg", r.post_impressions_organic_unique); mx("reachPaid", r.post_impressions_paid_unique);
            mx("like", r.post_reactions_like_total); mx("love", r.post_reactions_love_total); mx("haha", r.post_reactions_haha_total);
            mx("wow", r.post_reactions_wow_total); mx("sad", r.post_reactions_sorry_total); mx("angry", r.post_reactions_anger_total);
            mx("clicks", r.post_clicks);
            if (!p.permalink && r.permalink_url) p.permalink = r.permalink_url;
            if (!p.message && r.message) p.message = r.message;
          });
          if (!cancelled) setOrgPosts(Object.values(m));
          return;
        } catch (e) { /* ลองชุดถัดไป */ }
      }
      if (!cancelled) setOrgPosts([]);
    })();
    return () => { cancelled = true; };
  }, [preset, reload]);

  const data = useMemo(
    () => raw.filter((r) => (account === "__all__" || r.account === account) && (!campaign || r.campaign === campaign)),
    [raw, account, campaign]
  );
  const dates = useMemo(() => [...new Set(data.map((r) => r.date))].sort(), [data]);
  const creatives = useMemo(() => buildCreatives(data), [data]);
  const orgMatch = useMemo(() => computeOrgMatches(orgPosts, creatives), [orgPosts, creatives]);
  const matchOrgPost = (c) => orgMatch[creKey(c)] || null;

  const accounts = useMemo(() => [...new Set(raw.map((r) => r.account))].sort((a, b) => a.localeCompare(b)), [raw]);
  const campaigns = useMemo(() => {
    const rows = raw.filter((r) => account === "__all__" || r.account === account);
    const spendBy = {};
    rows.forEach((r) => (spendBy[r.campaign] = (spendBy[r.campaign] || 0) + r.spend));
    return Object.keys(spendBy).sort((a, b) => spendBy[b] - spendBy[a]).map((c) => ({ name: c, spend: spendBy[c] }));
  }, [raw, account]);

  const t = creatives.reduce((a, c) => { a.spend += c.spend; a.impr += c.impressions; a.reach += c.reach; a.clicks += c.clicks; return a; }, { spend: 0, impr: 0, reach: 0, clicks: 0 });
  const cpm = t.impr ? (t.spend / t.impr) * 1000 : 0, cpc = t.clicks ? t.spend / t.clicks : 0, ctr = t.impr ? t.clicks / t.impr : 0, freq = t.reach ? t.impr / t.reach : 0;
  const recos = useMemo(() => bidRecommendations(t, creatives), [creatives]); // eslint-disable-line react-hooks/exhaustive-deps

  const chartConfig = useMemo(() => {
    if (!dates.length) return null;
    const by = {};
    dates.forEach((d) => (by[d] = { spend: 0, reach: 0 }));
    data.forEach((r) => { if (by[r.date]) { by[r.date].spend += r.spend; by[r.date].reach += r.reach; } });
    return {
      data: {
        labels: dates,
        datasets: [
          { type: "line", label: "Spend (฿)", data: dates.map((d) => by[d].spend), yAxisID: "y", borderColor: "#ebc300", backgroundColor: (c) => yellowGradient(c.chart.ctx), fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2.5 },
          { type: "line", label: "Reach", data: dates.map((d) => by[d].reach), yAxisID: "y1", borderColor: "#969A9E", backgroundColor: "#969A9E", tension: 0.4, pointRadius: 0, borderWidth: 1.5, borderDash: [4, 3] },
        ],
      },
      options: {
        responsive: true, interaction: { mode: "index", intersect: false },
        plugins: { legend: { labels: { color: "#6b7178", usePointStyle: true, boxWidth: 8 } } },
        scales: {
          x: { ticks: { color: "#969A9E", font: { family: "JetBrains Mono", size: 10 }, maxTicksLimit: 10 }, grid: { display: false } },
          y: { position: "left", ticks: { color: "#ebc300", font: { family: "JetBrains Mono", size: 10 } }, grid: { color: "#E2E4E6" } },
          y1: { position: "right", ticks: { color: "#969A9E", font: { family: "JetBrains Mono", size: 10 } }, grid: { drawOnChartArea: false } },
        },
      },
    };
  }, [data, dates]);

  /* ---- drawer + Apify ---- */
  const sel = creatives.find((c) => creKey(c) === selKey) || null;
  const selLink = sel ? (matchOrgPost(sel) && matchOrgPost(sel).permalink) || sel.link || "" : "";

  useEffect(() => {
    if (!selLink) return;
    if (apifyCache.current[selLink] === undefined) {
      apifyCache.current[selLink] = "loading";
      setApVer((v) => v + 1);
      fetchApify(selLink).then((it) => {
        apifyCache.current[selLink] = it;
        setApVer((v) => v + 1);
      });
    }
  }, [selLink]);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") setSelKey(null); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  /* ---- debug helpers (🔧 / 🧪) ---- */
  const runDebug = async () => {
    setDebug({ title: "🔧 debug — ตรวจข้อมูล facebook_organic", blocks: [{ name: "creatives ปัจจุบัน (join key)", text: creatives.map((c) => `${c.ad} → storyId="${c.storyId || "(ว่าง)"}"`).join("\n") || "(เลือกแคมเปญก่อน)" }], loading: true });
    const tries = [
      ["ADS object_story_id", "source,campaign,ad_name,object_story_id", ""],
      ["ADS effective_object_story_id", "source,campaign,ad_name,effective_object_story_id", ""],
      ["ADS instagram_permalink_url", "source,campaign,ad_name,instagram_permalink_url", ""],
      ["ADS post_id", "source,campaign,ad_name,post_id", ""],
      ["ORGANIC min", "post_id,permalink_url,message", "facebook_organic"],
    ];
    const blocks = [{ name: "creatives ปัจจุบัน (join key)", text: creatives.map((c) => `${c.ad} → storyId="${c.storyId || "(ว่าง)"}"`).join("\n") || "(เลือกแคมเปญก่อน)" }];
    for (const [name, f, conn] of tries) {
      try {
        const res = await wfetch(`date_preset=${preset}&fields=${f}`, conn || undefined);
        const txt = await res.text();
        blocks.push({ name: `${name} → HTTP ${res.status}`, text: txt.slice(0, 1200) });
      } catch (e) {
        blocks.push({ name: `${name} → ERROR`, text: e.message });
      }
    }
    setDebug({ title: "🔧 debug — ตรวจข้อมูล facebook_organic", blocks, loading: false });
  };

  const runApifyDebug = async () => {
    let url = "";
    for (const c of creatives) {
      const p = matchOrgPost(c);
      if (p && p.permalink) { url = p.permalink; break; }
      if (c.link) { url = c.link; break; }
    }
    if (!url && orgPosts.length) url = orgPosts.find((p) => p.permalink)?.permalink || "";
    const blocks = [{ name: "post URL ที่ทดสอบ", text: url || "(ไม่พบลิงก์ — เลือกแคมเปญที่ match โพสต์ได้ก่อน)" }];
    setDebug({ title: "🧪 Apify debug", blocks, loading: true });
    if (url) {
      try {
        const res = await fetch(`/api/apify?url=${encodeURIComponent(url)}`);
        const txt = await res.text();
        let item = null;
        try { const j = JSON.parse(txt); item = Array.isArray(j) ? j[0] : (j.data && j.data[0]) || j; } catch (e) { /* raw */ }
        if (item && typeof item === "object") {
          const lines = Object.keys(item).map((k) => {
            const v = item[k];
            const tp = Array.isArray(v) ? `array(${v.length})` : typeof v;
            const pv = Array.isArray(v) ? `[${v.length} items]` : v && typeof v === "object" ? "{…}" : String(v).slice(0, 60);
            const hot = /like|react|comment|share|love|haha|wow|angry|sad/i.test(k) ? " ★" : "";
            return `${k}${hot}  (${tp})  ${pv}`;
          });
          blocks.push({ name: `/api/apify → HTTP ${res.status} · field ทั้งหมดของโพสต์ (★ = เกี่ยวกับ like/comment/share)`, text: lines.join("\n") });
        } else {
          blocks.push({ name: `/api/apify → HTTP ${res.status}`, text: txt.slice(0, 2500) });
        }
      } catch (e) {
        blocks.push({ name: "ERROR", text: e.message });
      }
    }
    setDebug({ title: "🧪 Apify debug", blocks, loading: false });
  };

  const kpi = (l, v) => <KpiCard key={l} label={l} value={v} compactNoTrend />;

  return (
    <section>
      <div className="bid-head">
        <div>
          <h1>💸 Biddable <span className="accent">Creative Monitor</span></h1>
          <div className="sub">
            {dates.length
              ? `${dates[0]} → ${dates[dates.length - 1]} · ${account === "__all__" ? "ทุกบัญชี" : account}${campaign ? " · " + campaign : ""}`
              : "เลือกบัญชี + แคมเปญ เพื่อดูต้นทุนและ creative แต่ละตัว"}
          </div>
        </div>
        <div className="controls">
          <select value={account} onChange={(e) => { setAccount(e.target.value); setCampaign(""); }}>
            <option value="__all__">ทุก Ad Account ({accounts.length})</option>
            {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select id="bidCampaign" value={campaign} onChange={(e) => setCampaign(e.target.value)}>
            <option value="">— ทุกแคมเปญ ({campaigns.length}) —</option>
            {campaigns.map((c) => <option key={c.name} value={c.name}>{c.name} · {fmtMoney(c.spend)}</option>)}
          </select>
          <Pills options={PRESETS} value={preset} onChange={setPreset} />
          <button className="btn-primary" onClick={() => setReload((n) => n + 1)}>↻ รีเฟรช</button>
          <button title="ตรวจข้อมูล facebook_organic" onClick={runDebug}>🔧</button>
          <button title="ทดสอบ Apify (reactions/share/comment)" onClick={runApifyDebug}>🧪</button>
        </div>
      </div>

      {debug && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head">
            <h3>{debug.title}{debug.loading ? " ⏳" : ""}</h3>
            <button onClick={() => setDebug(null)}>ปิด</button>
          </div>
          {debug.blocks.map((b, i) => (
            <div key={i} style={{ marginTop: 10 }}>
              <b style={{ fontSize: 13 }}>{b.name}</b>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, maxHeight: 200, overflow: "auto", background: "var(--well)", padding: 8, borderRadius: 4, marginTop: 4 }}>{b.text}</pre>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="loading">กำลังดึงข้อมูลจาก Windsor…</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : !dates.length ? (
        <div className="loading">ไม่มีข้อมูลในช่วง/บัญชีที่เลือก</div>
      ) : (
        <div className="bid-split">
          <div className="panel">
            <div className="panel-head"><h3>Spend & Reach รายวัน</h3></div>
            <div className="psub">แนวโน้มต้นทุนและการเข้าถึงของ{campaign ? "แคมเปญ" : "บัญชี"}ที่เลือก</div>
            {chartConfig && <ChartCanvas config={chartConfig} />}
            <div className="kpis compact">
              {kpi("Spend", fmtMoney(t.spend))}{kpi("Reach", fmtK(t.reach))}{kpi("Impressions", fmtK(t.impr))}
              {kpi("Clicks", fmtK(t.clicks))}{kpi("CPM", "฿" + cpm.toFixed(2))}{kpi("CPC", "฿" + cpc.toFixed(2))}
              {kpi("CTR", fmtPct(ctr))}{kpi("Frequency", freq.toFixed(2))}
            </div>
            <RecoList
              heading="AI Recommendation"
              sub="วิเคราะห์อัตโนมัติจากข้อมูลช่วงที่เลือก · อ้างอิงเกณฑ์เบื้องต้นของ Facebook Ads"
              recos={recos}
              count={recos.length}
            />
          </div>
          <div className="panel">
            <div className="panel-head">
              <h3>🎨 Creative Breakdown</h3>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>{creatives.length} creatives</span>
            </div>
            <div className="psub">รวมครีเอทีฟที่ Link Post เดียวกันเป็นชิ้นเดียว (reach = unique/max ไม่ sum) · คลิกเพื่อดูรายวัน{noImg ? " · (ไม่มี thumbnail)" : ""}</div>
            {creatives.length ? (
              <div className="cre-grid">
                {creatives.map((c) => (
                  <CreCard key={creKey(c)} c={c} selected={selKey === creKey(c)} onClick={() => setSelKey(creKey(c))} />
                ))}
              </div>
            ) : (
              <div className="bc-none">ไม่พบ creative</div>
            )}
          </div>
        </div>
      )}

      {/* drawer + overlay */}
      <div className={cn("cre-overlay", sel && "open")} onClick={() => setSelKey(null)} />
      <aside className={cn("cre-drawer", sel && "open")} role="dialog" aria-modal="true" aria-label="รายละเอียด creative">
        <button className="cre-drawer-close" onClick={() => setSelKey(null)} title="ปิด" aria-label="ปิด">✕</button>
        {sel && (
          <CreativeDetail
            c={sel}
            post={matchOrgPost(sel)}
            link={selLink}
            account={account}
            campaign={campaign}
            apifyCache={apifyCache.current}
            apVer={apVer}
          />
        )}
      </aside>
    </section>
  );
}

function CreCard({ c, selected, onClick }) {
  const cpm = c.impressions ? (c.spend / c.impressions) * 1000 : 0;
  const ctr = c.impressions ? c.clicks / c.impressions : 0;
  const [imgFail, setImgFail] = useState(false);
  return (
    <div className={cn("cre-card", selected && "sel")} onClick={onClick}>
      {c.thumb && !imgFail ? (
        <img className="cre-thumb" src={c.thumb} alt="" loading="lazy" onError={() => setImgFail(true)} />
      ) : (
        <div className="cre-thumb ph">🖼</div>
      )}
      <div className="cre-body">
        <div className="cre-name" title={c.ad}>{c.ad}</div>
        <div className="cre-adset" title={c.adset}>
          {c.adsets && c.adsets.size > 1 ? `รวม ${c.adsets.size} adsets · ${c.campaigns.size} แคมเปญ` : c.adset}
        </div>
        <div className="brk-metrics">
          <span className="mk">Spend</span><span className="mv">{fmtMoney(c.spend)}</span>
          <span className="mk">Reach</span><span className="mv">{fmtK(c.reach)}</span>
          <span className="mk">CPM</span><span className="mv">฿{cpm.toFixed(1)}</span>
          <span className="mk">CTR</span><span className="mv">{fmtPct(ctr)}</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ v, l, na }) {
  return (
    <div className={cn("pp-stat", na && "na")}>
      <b>{na ? "—" : v}</b>
      <span>{l}</span>
    </div>
  );
}

function CreativeDetail({ c, post, link, account, campaign, apifyCache, apVer }) {
  const [imgFail, setImgFail] = useState(false);
  const days = Object.entries(c.days).sort((a, b) => a[0].localeCompare(b[0]));
  const first = days.length ? days[0][0] : "—", last = days.length ? days[days.length - 1][0] : "—";
  const totReach = c.reach, totImpr = c.impressions, clicks = c.clicks, spend = c.spend;
  const cpm = totImpr ? (spend / totImpr) * 1000 : 0, ctr = totImpr ? clicks / totImpr : 0;
  const num = (v) => fmtInt(v);

  const ap = link && apifyCache[link] && apifyCache[link] !== "loading" ? apifyCache[link] : null;
  const apLoading = link && apifyCache[link] === "loading";
  // ค่าแต่ละช่อง: Apify → Windsor → —
  const rv = (apKeys, winVal) => {
    if (apLoading) return { v: "…", na: false };
    const a = apGet(ap, apKeys);
    if (a != null) return { v: num(a), na: false };
    if (winVal != null) return { v: num(winVal), na: false };
    return { v: "", na: true };
  };
  const RE = {
    like: rv(["likes", "reactionLikeCount", "reactionsCount"], post ? post.like : null),
    love: rv(["reactionLoveCount", "loveCount"], post ? post.love : null),
    haha: rv(["reactionHahaCount", "hahaCount"], post ? post.haha : null),
    wow: rv(["reactionWowCount", "wowCount"], post ? post.wow : null),
    sad: rv(["reactionSadCount", "sadCount"], post ? post.sad : null),
    angry: rv(["reactionAngryCount", "angryCount"], post ? post.angry : null),
    share: rv(["shares", "shareCount", "sharesCount"], null),
    comment: rv(["comments", "commentCount", "commentsCount"], null),
  };

  // ถ้า match โพสต์ organic ได้ → ใช้ค่าจริง (organic/paid split); ไม่งั้น fallback เป็นค่า ads (paid≈total)
  const R = post
    ? { tr: post.reach || totReach, or: null, pr: null, ti: post.impr || totImpr, oi: post.imprOrg, pi: post.imprPaid }
    : { tr: totReach, or: null, pr: totReach, ti: totImpr, oi: null, pi: totImpr };

  const imgEl = c.thumb && !imgFail ? (
    <img className="pp-img" src={c.thumb} alt="" onError={() => setImgFail(true)} />
  ) : (
    <div className="pp-img ph">🖼</div>
  );

  return (
    <div className="cre-detail">
      <div className="post-perf">
        <div className="pp-left">
          <div className="pp-page">{account === "__all__" ? campaign || c.adset : account}</div>
          <div className="pp-msg">{(post && post.message) || c.ad}</div>
          {link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" title="เปิดโพสต์จริงบน Facebook">{imgEl}</a>
          ) : (
            imgEl
          )}
        </div>
        <div className="pp-right">
          <h3>Performance for your post</h3>
          <div className="pp-meta">
            <div className="k">Page name:</div><div className="v">{account === "__all__" ? "—" : account}</div>
            <div className="k">Link Post:</div>
            <div className="v">{link ? <a href={link} target="_blank" rel="noopener noreferrer">{link}</a> : "—"}</div>
            <div className="k">Campaign:</div><div className="v">{campaign || "—"}</div>
            <div className="k">Ad / Creative:</div><div className="v">{c.ad}</div>
            <div className="k">Type:</div><div className="v">{c.thumb ? "Photo" : "—"}</div>
            <div className="k">Date range:</div><div className="v">{first} → {last} · {days.length} วัน</div>
          </div>

          <div className="pp-sec">Reach &amp; Impressions</div>
          <div className="pp-box">
            <Stat v={num(R.tr)} l="Lifetime Post Total reach" />
            <Stat v={R.or == null ? "" : num(R.or)} l="Lifetime Post Organic reach" na={R.or == null} />
            <Stat v={num(R.pr)} l="Lifetime Post Paid reach" />
            <Stat v={num(R.ti)} l="Lifetime Post Total impression" />
            <Stat v={R.oi == null ? "" : num(R.oi)} l="Lifetime Post Organic impression" na={R.oi == null} />
            <Stat v={num(R.pi)} l="Lifetime Post Paid impression" />
          </div>

          <div className="pp-sec">Reactions</div>
          <div className="pp-box">
            <Stat v={RE.like.v} l="Like" na={RE.like.na} />
            <Stat v={RE.love.v} l="Love" na={RE.love.na} />
            <Stat v={RE.haha.v} l="Haha" na={RE.haha.na} />
            <Stat v={RE.wow.v} l="Wow" na={RE.wow.na} />
            <Stat v={RE.sad.v} l="Sad" na={RE.sad.na} />
            <Stat v={RE.angry.v} l="Angry" na={RE.angry.na} />
          </div>
          <div className="pp-note">
            {apLoading
              ? "⏳ กำลังดึง reactions / share / comment จาก Apify…"
              : ap
                ? "✓ reactions / share / comment จาก Apify · reach/impression จาก Page Insights"
                : link
                  ? "Apify ยังไม่มีข้อมูล/ปิดอยู่ — reactions ใช้ค่า Page Insights, Share/Comment ว่าง"
                  : post
                    ? `✓ จับคู่โพสต์จริง ${post._by === "id" ? "(ตรงด้วย post id)" : "(ประมาณจากยอด impressions)"} แต่ไม่มีลิงก์ให้ยิง Apify`
                    : "ยังจับคู่โพสต์จริงไม่ได้ · reach/impression ใช้ค่า ads แทน"}
          </div>

          <div className="pp-sec">Share Comments and Post Click</div>
          <div className="pp-box">
            <Stat v={RE.share.v} l="Share" na={RE.share.na} />
            <Stat v={RE.comment.v} l="Comment" na={RE.comment.na} />
            <Stat v={num(post && post.clicks ? post.clicks : clicks)} l="Post Click" />
          </div>

          <div className="pp-sec">Cost</div>
          <div className="pp-box">
            <Stat v={fmtMoney(spend)} l="Spend" />
            <Stat v={"฿" + cpm.toFixed(2)} l="CPM" />
            <Stat v={fmtPct(ctr)} l="CTR" />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 6 }}>
        <div className="pp-sec">รายวัน (Daily)</div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr><th>วันที่</th><th>Spend</th><th>Impr.</th><th>Reach</th><th>CTR</th><th>CPM</th><th>CPC</th></tr>
            </thead>
            <tbody>
              {days.map(([dt, v]) => {
                const dcpm = v.impr ? (v.spend / v.impr) * 1000 : 0;
                const dctr = v.impr ? v.clicks / v.impr : 0;
                const dcpc = v.clicks ? v.spend / v.clicks : 0;
                return (
                  <tr key={dt}>
                    <td className="camp">{dt}</td>
                    <td>{fmtMoney(v.spend)}</td>
                    <td>{fmtInt(v.impr)}</td>
                    <td>{fmtInt(v.reach)}</td>
                    <td>{fmtPct(dctr)}</td>
                    <td>฿{dcpm.toFixed(1)}</td>
                    <td>฿{dcpc.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
