# Windsor Media Dashboard

Dashboard แสดงผลข้อมูลโฆษณา (Facebook / TikTok / Twitter) จาก [Windsor.ai](https://windsor.ai)

## สแต็ก (v2 — restructure)
- **Vite + React** — โค้ดหน้าเว็บแยกเป็น component อยู่ใน `src/`
- **Tailwind CSS v4** (`@tailwindcss/vite`) + **shadcn/ui** (สไตล์ new-york, ตั้งค่าไว้ใน `components.json`)
  - สี CI (เหลือง/เทา/ขาว) ถูก map เข้า Tailwind theme แล้ว (`bg-primary` = เหลือง CI ฯลฯ)
  - CSS เดิมทั้งหมดยังอยู่ใน `src/index.css` เพื่อให้หน้าตาเหมือนเดิม 100% — ค่อยๆ ทยอยแปลงเป็น utility/component ได้
- **Express** (`server.js`) — proxy `/api/windsor`, `/api/apify`, `/api/img` + เสิร์ฟไฟล์ build จาก `dist/`
- **Chart.js** — bundle ผ่าน npm (ไม่โหลดจาก CDN แล้ว)

## โครงสร้างโปรเจกต์
```
├─ index.html              ← entry ของ Vite
├─ vite.config.mjs         ← alias @ → src, dev proxy /api → :3000
├─ components.json         ← config ของ shadcn/ui (npx shadcn@latest add <component>)
├─ server.js               ← Express proxy + เสิร์ฟ dist/
└─ src/
   ├─ main.jsx / App.jsx   ← root + top nav + สลับแท็บ
   ├─ index.css            ← Tailwind + design tokens + สไตล์เดิม
   ├─ lib/
   │  ├─ windsor.js        ← wfetch / ensureKey / ค่าคงที่ field / Apify
   │  ├─ format.js         ← ตัว format ตัวเลข/วันที่
   │  ├─ benchmark.js      ← กติกา parse ชื่อแคมเปญ (Brand/Objective/Material)
   │  └─ utils.js          ← cn() ของ shadcn
   ├─ components/          ← ChartCanvas, Pills, DateRange, MultiSelect, KpiCard, RecoList
   │  └─ ui/               ← shadcn components (button, card, input, badge)
   └─ views/
      ├─ Landing.jsx       ← เลือก Ad Account
      ├─ Dashboard.jsx     ← KPI + trend + ตารางแคมเปญ
      ├─ CreativeReport.jsx← Biddable Creative Monitor + drawer + AI reco
      ├─ Benchmark.jsx     ← FB/TT Cost per & Result Rate + Google embed
      └─ ActiveAccounts.jsx← สถานะบัญชี + weekly/quarterly trend
```

## รันบนเครื่อง (dev)
ต้องมี Node.js >= 20

```bash
npm install
npm run dev        # vite dev server (hot reload) — proxy /api ไปที่ :3000
node server.js     # (อีก terminal) Express proxy — ต้องตั้ง env Windsor_key
```

## Build + รันแบบ production
```bash
npm run build      # ได้ dist/
npm start          # node server.js — เสิร์ฟ dist/ + /api proxy
```

## การ deploy (Railway)
Railway (Nixpacks) จะรัน `npm install` → `npm run build` → `npm start` ให้อัตโนมัติ
ตั้ง environment variables:

| ตัวแปร | ค่า | หมายเหตุ |
|--------|-----|----------|
| `Windsor_key` | API key ของ Windsor | ใช้ฝั่ง server เท่านั้น (ไม่ commit) |
| `Apify_key` | (ถ้าใช้) | สำหรับ engagement scraping ใน Creative Report |
| `DATA_DIR` | `/data` | ใช้เฉพาะถ้าเปิดระบบ Pull Data (endpoint ยังอยู่ใน server.js) |

## ฟีเจอร์
- Landing เลือก Ad Account + ยอด Spend 7 วัน
- Dashboard: KPI cards (Spend / Reach / Impressions / Clicks / CPM / CPC / CTR / Frequency) + กราฟแนวโน้ม + ตารางแคมเปญกดดูรายวันได้
- Creative Report: รวมครีเอทีฟตามโพสต์ + drawer "Performance for your post" (Page Insights + Apify) + AI Recommendation
- Ad Benchmark: Cost per Result / Result Rate แยกตามแบรนด์ (FB + TikTok, heatmap ต่อคอลัมน์) + Google Looker Studio embed
- Active Ad account: สถานะบัญชี + Weekly Spend Trend + Quarterly Budget Comparison

## ⚠️ หมายเหตุด้านความปลอดภัย
Windsor API key ไม่ได้ฝังในไฟล์ — โหมด production ใช้ key จาก env ฝั่ง server เท่านั้น
(เปิดไฟล์แบบ file:// เท่านั้นที่จะถามเก็บ key ใน localStorage)
