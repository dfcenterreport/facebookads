# Windsor Media Dashboard

Dashboard แสดงผลข้อมูลโฆษณา (Facebook / TikTok / Twitter) จาก [Windsor.ai](https://windsor.ai)
ดึงข้อมูลสดผ่าน Windsor connector API — ทำงานฝั่ง browser ล้วน ไม่ต้องมี backend

## การใช้งาน
เปิดไฟล์ [`windsor-dashboard.html`](windsor-dashboard.html) ในเบราว์เซอร์ได้เลย

## ฟีเจอร์
- KPI cards: Spend, Impressions, Reach, Clicks, CPM, CPC, CTR
- กราฟแนวโน้มรายวัน (Spend + Impressions)
- สัดส่วน Spend ตาม source
- เปรียบเทียบรายสัปดาห์ (Week-over-Week)
- ตาราง performance รายแคมเปญ (จัดเรียงได้)
- ตัวกรองช่วงเวลา + เปิด/ปิด source

## ⚠️ หมายเหตุด้านความปลอดภัย
Windsor API key ฝังอยู่ในไฟล์ HTML (ฝั่ง client) — repo นี้เป็น public จึงเปิดเผย key
แนะนำให้ใช้ key ที่จำกัดสิทธิ์ และ regenerate เป็นระยะใน Windsor.ai
