export function StatusBadge({ status }) {
  const s = (status || "OFFLINE").toLowerCase();
  const label = { normal: "Normal", warning: "Warning", high: "High", offline: "Offline" }[s] || status;
  return <span className={`badge ${s}`}>{label}</span>;
}

/** The signature element: a risk score with a segmented bar (0-100). */
export function RiskMeter({ score, status }) {
  const s = (status || "offline").toLowerCase();
  const segments = 20;
  const lit = Math.round(((score ?? 0) / 100) * segments);
  return (
    <div className="risk">
      <div className={`risk-score ${s}`}>{score ?? "-"}</div>
      <div className="risk-bar" aria-label={`Risk score ${score ?? "unknown"} out of 100`}>
        {Array.from({ length: segments }, (_, i) => (
          <span key={i} className={i < lit ? `on ${s}` : ""} />
        ))}
      </div>
    </div>
  );
}
