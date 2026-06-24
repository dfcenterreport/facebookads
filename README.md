# Windsor Media Dashboard

Dashboard แสดงผลข้อมูลโฆษณา (Facebook / TikTok / Twitter) จาก [Windsor.ai](https://windsor.ai)
ดึงข้อมูลสดผ่าน Windsor connector API — ทำงานฝั่ง browser ล้วน ไม่ต้องมี backend

## การใช้งาน
เปิดไฟล์ [`index.html`](index.html) ในเบราว์เซอร์ได้เลย หรือ deploy เป็นเว็บ static
(รองรับ Railway / GitHub Pages — มีไฟล์ `Staticfile` สำหรับ Railpack static provider)

เปิดครั้งแรกจะมีช่องให้กรอก Windsor API key เก็บไว้ใน localStorage ของเบราว์เซอร์

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
