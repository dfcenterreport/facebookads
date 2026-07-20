# Windsor Media Dashboard

Dashboard แสดงผลข้อมูลโฆษณา (Facebook / TikTok / Twitter) จาก [Windsor.ai](https://windsor.ai)

## รูปแบบการดึงข้อมูล (Pull Data → ฐานข้อมูล)
เว็บ **ไม่ได้ยิง Windsor ตอนเปิดอีกต่อไป** — จะอ่านจากฐานข้อมูลที่ดึงเก็บไว้ (โหลดเร็วขึ้น)

1. เข้าเมนู **⚙️ Setting → ⤓ Pull Data** (มุมบนขวา)
2. เลือกปีที่จะเริ่มดึง (ค่าเริ่มต้น = **2025**) แล้วกด **เริ่มดึงข้อมูล**
3. ระหว่างดึงจะมี **progress bar + ประมาณเวลาที่เหลือ (ETA)** และมี **ประวัติการดึง** แสดงด้านล่าง

Pull job จะดึง connector `all`, `facebook`, `tiktok`, `facebook_organic` แบบเดือนต่อเดือน
ตั้งแต่ 1 ม.ค. ของปีที่เลือกจนถึงวันนี้ แล้วเก็บเป็นไฟล์ใน `DATA_DIR`

## การ deploy (Railway)
ต้องรันเป็น **Node server** (`node server.js`) — ไม่ใช่ static เพราะต้องมีฐานข้อมูล
ตั้ง environment variables:

| ตัวแปร | ค่า | หมายเหตุ |
|--------|-----|----------|
| `Windsor_key` | API key ของ Windsor | ใช้ตอน Pull Data (ไม่ commit) |
| `DATA_DIR` | `/data` | path ของ **Railway Volume** (ให้ข้อมูลอยู่ถาวรข้าม redeploy) |
| `Apify_key` | (ถ้าใช้) | สำหรับ engagement scraping ใน Creative Report |

**สำคัญ:** ต้องเพิ่ม **Volume** ใน Railway แล้ว mount ไว้ที่ `/data` (ให้ตรงกับ `DATA_DIR`)
มิฉะนั้นข้อมูลที่ Pull ไว้จะหายทุกครั้งที่ redeploy → ต้องกด Pull ใหม่

รันในเครื่อง: `npm install && node server.js` ( default `DATA_DIR=./data`)

## ฟีเจอร์
- KPI cards: Spend, Impressions, Reach, Clicks, CPM, CPC, CTR
- กราฟแนวโน้มรายวัน (Spend + Impressions)
- สัดส่วน Spend ตาม source
- เปรียบเทียบรายสัปดาห์ (Week-over-Week)
- ตาราง performance รายแคมเปญ (จัดเรียงได้)
- ตัวกรองช่วงเวลา + เปิด/ปิด source

## ⚠️ หมายเหตุด้านความปลอดภัย
Windsor API key ไม่ได้ฝังในไฟล์ — ผู้ใช้กรอกเองตอนเปิด แล้วเก็บใน localStorage ของเบราว์เซอร์
แนะนำให้ใช้ key ที่จำกัดสิทธิ์ และ regenerate เป็นระยะใน Windsor.ai
