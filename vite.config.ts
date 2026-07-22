import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Vite รัน config ด้วย cwd = root ของโปรเจกต์เสมอ → ใช้ process.cwd() แทน __dirname/import.meta.url
// (เลี่ยงปัญหา ESM/CJS เพราะ backend compile เป็น CommonJS จึงไม่ตั้ง "type":"module" ที่ root)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(process.cwd(), "src") },
  },
  server: {
    // dev: ยิง /api ไปที่ Express (npm run dev:server) ที่พอร์ต 3000
    proxy: { "/api": "http://localhost:3000" },
  },
  build: { outDir: "dist" },
});
