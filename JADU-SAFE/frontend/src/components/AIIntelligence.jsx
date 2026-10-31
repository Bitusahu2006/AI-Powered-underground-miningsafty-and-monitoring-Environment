import { useState } from "react";
import { api, fmtAge, usePoll } from "../api";

export default function AIIntelligence() {
  const [station, setStation] = useState("JADU-STATION-01");
  const { data: latest, error: stationError } = usePoll(() => api("/api/sensors/latest"), 10000);
  const { data, error } = usePoll(
    () => api(`/api/ai/status?station_id=${encodeURIComponent(station)}`),
    5000,
    [station],
  );
  const selected = latest?.stations?.find((item) => item.station_id === station);
  const anomalies = data?.anomalies || [];
  const faults = data?.sensor_faults || [];
  const forecasts = data?.forecasts || [];
  const status = data?.threshold_status || "OFFLINE";

  return (
    <div className="stack ai-page">
      <section className="ai-heading">
        <div>
          <h2>AI intelligence</h2>
          <p className="muted small">Statistical anomaly, trend, and sensor-health insights from recent readings.</p>
        </div>
        <label>Station{" "}
          <select value={station} onChange={(event) => setStation(event.target.value)}>
            {(latest?.stations || []).map((item) => (
              <option key={item.station_id} value={item.station_id}>{item.name}</option>
            ))}
            {!latest?.stations?.length && <option value={station}>{station}</option>}
          </select>
        </label>
      </section>

      {(error || stationError) && <div className="callout ai-error">Unable to load intelligence: {error || stationError}</div>}

      <div className="summary ai-summary">
        <div className={`summary-item ${status.toLowerCase()}`}>
          <div className="num"><span className={`badge ${status.toLowerCase()}`}>{status}</span></div>
          <div className="lbl">Threshold status</div>
        </div>
        <div className={anomalies.length ? "summary-item warning" : "summary-item"}>
          <div className="num">{anomalies.length}</div><div className="lbl">Statistical anomalies</div>
        </div>
        <div className={faults.length ? "summary-item high" : "summary-item"}>
          <div className="num">{faults.length}</div><div className="lbl">Probable sensor faults</div>
        </div>
        <div className={forecasts.length ? "summary-item warning" : "summary-item"}>
          <div className="num">{forecasts.length}</div><div className="lbl">Threshold forecasts</div>
        </div>
      </div>

      <section className="panel ai-status-panel">
        <div className="ai-section-heading">
          <div><h2>Station assessment</h2><span className="muted small">{selected?.name || station}</span></div>
          <span className={`badge ${selected?.latest?.online ? status.toLowerCase() : "offline"}`}>
            {selected?.latest?.online ? `Online · ${fmtAge(selected.latest.age_seconds)}` : "Offline"}
          </span>
        </div>
        <p className="muted small">Threshold status and statistical anomaly detection are separate signals. All readings and limits are for demonstration only.</p>
        {anomalies.length ? (
          <div className="ai-insight-list">{anomalies.map((item) => (
            <article className="ai-insight warning" key={item.parameter}>
              <strong>{item.label} · z-score {item.z_score}</strong><span>{item.explanation}</span>
            </article>
          ))}</div>
        ) : <p className="muted">{data ? "No statistical anomaly detected in the latest analysis." : "Loading station analysis…"}</p>}
      </section>

      <div className="ai-grid">
        <section className="panel">
          <h2>Trend forecast</h2>
          <p className="muted small">Linear estimate from recent sensor readings; not a safety prediction.</p>
          {forecasts.length ? <div className="ai-insight-list">{forecasts.map((item) => (
            <article className="ai-insight warning" key={item.parameter}>
              <strong>{item.label}</strong>
              <span>May reach demonstration threshold {item.threshold} in approximately {item.minutes} min.</span>
            </article>
          ))}</div> : <p className="muted">{data ? "No upward trend toward a demonstration threshold." : "Waiting for analysis…"}</p>}
        </section>
        <section className="panel">
          <h2>Probable sensor faults</h2>
          <p className="muted small">Heuristic checks for flat-lined, inconsistent, or abruptly changing readings.</p>
          {faults.length ? <div className="ai-insight-list">{faults.map((item, index) => (
            <article className="ai-insight danger" key={`${item.parameter}-${index}`}>
              <strong>{item.parameter}</strong><span>{item.reason}</span>
            </article>
          ))}</div> : <p className="muted">{data ? "No probable sensor fault detected." : "Waiting for analysis…"}</p>}
        </section>
      </div>
      <p className="muted small ai-footnote">{data?.note || "Anomaly detection and forecasts are statistical demonstrations using synthetic data."}</p>
    </div>
  );
}
