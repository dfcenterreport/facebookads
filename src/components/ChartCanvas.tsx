import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

/**
 * Chart.js wrapper — `config` ต้อง memoized (useMemo) ฝั่งผู้เรียก
 * เปลี่ยน config เมื่อไร chart เดิมถูก destroy แล้วสร้างใหม่ (พฤติกรรมเดียวกับโค้ดเดิม)
 */
export default function ChartCanvas({ config, className }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !config) return;
    chartRef.current = new Chart(canvasRef.current, config);
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [config]);

  return <canvas ref={canvasRef} className={className} />;
}

// gradient เหลืองใต้เส้น (ใช้ร่วมกันหลายกราฟ)
export const yellowGradient = (ctx) => {
  const g = ctx.createLinearGradient(0, 0, 0, 300);
  g.addColorStop(0, "rgba(253,210,5,.45)");
  g.addColorStop(1, "rgba(253,210,5,0)");
  return g;
};
