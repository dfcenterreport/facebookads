/** รายการ AI Recommendation (ใช้ทั้ง Creative Report และ Benchmark) */
export function RecoItem({ level, ic, title, detail }) {
  return (
    <div className={`reco reco-${level}`}>
      <div className="reco-ic">{ic}</div>
      <div className="reco-tx">
        <div className="reco-t">{title}</div>
        <div className="reco-d">{detail}</div>
      </div>
    </div>
  );
}

export default function RecoList({ heading, sub, recos, count, style }) {
  return (
    <div className="ai-reco" style={style}>
      <div className="ai-reco-head">
        <span className="ai-badge">✨ AI</span>
        <h3>{heading}</h3>
        {count != null && <span className="ai-count">{count} ข้อเสนอ</span>}
      </div>
      <div className="ai-reco-sub">{sub}</div>
      <div className="ai-reco-list">
        {recos.map((r, i) => (
          <RecoItem key={i} {...r} />
        ))}
      </div>
    </div>
  );
}
