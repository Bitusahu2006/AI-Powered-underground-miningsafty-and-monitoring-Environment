import { useMemo, useState } from "react";
import { api, fmtTime, usePoll } from "../api";
import { StatusBadge } from "./Status";

const PERIODS = [
  { hours: 1, label: "Last hour" },
  { hours: 6, label: "Last 6 hours" },
  { hours: 24, label: "Last 24 hours" },
  { hours: 168, label: "Last 7 days" },
];
const PARAMETERS = [
  ["radon_bqm3", "Radon (Bq/m³)"], ["gamma_usvh", "Gamma (µSv/h)"],
  ["pm25", "PM2.5 (µg/m³)"], ["pm10", "PM10 (µg/m³)"],
  ["ph", "Water pH"], ["tds", "TDS (ppm)"], ["airflow_ms", "Airflow (m/s)"],
  ["temperature", "Temperature (°C)"], ["humidity", "Humidity (%)"],
];

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(rows, stationName, periodLabel) {
  const headers = ["Station", "Received at", "Status", "Risk score", ...PARAMETERS.map(([, label]) => label)];
  const content = [
    headers.map(csvCell).join(","),
    ...rows.map(({ station_id, reading }) => [
      station_id, reading.received_at, reading.status, reading.risk_score,
      ...PARAMETERS.map(([key]) => reading[key]),
    ].map(csvCell).join(",")),
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `jadu-safe-${stationName.replace(/[^a-z0-9-]/gi, "-")}-${periodLabel.replace(/[^a-z0-9-]/gi, "-")}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Reports() {
  const [station, setStation] = useState("all");
  const [periodHours, setPeriodHours] = useState(24);
  const { data: latest, error: latestError } = usePoll(() => api("/api/sensors/latest"), 15000);
  const stationIds = (latest?.stations || []).map((item) => item.station_id);
  const stationKey = stationIds.join(",");
  const { data, error, reload } = usePoll(async () => {
    const ids = station === "all" ? stationIds : stationIds.includes(station) ? [station] : [];
    if (!ids.length) return [];
    return Promise.all(ids.map(async (stationId) => {
      const [history, alerts] = await Promise.all([
        api(`/api/sensors/history?station_id=${encodeURIComponent(stationId)}&limit=1000`),
        api(`/api/alerts?station_id=${encodeURIComponent(stationId)}&limit=500`),
      ]);
      return { stationId, readings: history.readings, alerts: alerts.alerts };
    }));
  }, 30000, [station, periodHours, stationKey]);

  const cutoff = Date.now() - periodHours * 60 * 60 * 1000;
  const reportRows = useMemo(() => (data || []).flatMap((item) =>
    item.readings
      .filter((reading) => new Date(reading.received_at).getTime() >= cutoff)
      .map((reading) => ({ station_id: item.stationId, reading })),
  ).sort((a, b) => new Date(a.reading.received_at) - new Date(b.reading.received_at)), [data, cutoff]);
  const reportAlerts = useMemo(() => (data || []).flatMap((item) =>
    item.alerts.filter((alert) => new Date(alert.timestamp).getTime() >= cutoff),
  ), [data, cutoff]);
  const selectedStations = latest?.stations?.filter((item) => station === "all" || item.station_id === station) || [];
  const averageRisk = reportRows.length
    ? Math.round(reportRows.reduce((total, item) => total + item.reading.risk_score, 0) / reportRows.length)
    : "-";
  const highReadings = reportRows.filter((item) => item.reading.status === "HIGH").length;
  const warningReadings = reportRows.filter((item) => item.reading.status === "WARNING").length;
  const periodLabel = PERIODS.find((item) => item.hours === periodHours)?.label || "Selected period";
  const loading = !data && !error;

  return (
    <div className="stack reports-page">
      <section className="report-heading">
        <div>
          <h2>Environmental reports</h2>
          <p className="muted small">Review station readings and alerts, then export CSV or print/save as PDF.</p>
        </div>
        <div className="report-actions">
          <button className="btn" onClick={() => downloadCsv(reportRows, station, periodLabel)} disabled={!reportRows.length}>Download CSV</button>
          <button className="btn report-print" onClick={() => window.print()}>Print / Save PDF</button>
          <button className="link" onClick={reload}>Refresh</button>
        </div>
      </section>

      <div className="toolbar report-filters">
        <label>Station{" "}
          <select value={station} onChange={(event) => setStation(event.target.value)}>
            <option value="all">All stations</option>
            {(latest?.stations || []).map((item) => <option key={item.station_id} value={item.station_id}>{item.name}</option>)}
          </select>
        </label>
        <label>Period{" "}
          <select value={periodHours} onChange={(event) => setPeriodHours(Number(event.target.value))}>
            {PERIODS.map((item) => <option key={item.hours} value={item.hours}>{item.label}</option>)}
          </select>
        </label>
        <span className="muted small">Generated {new Date().toLocaleString()}</span>
      </div>

      {(latestError || error) && <div className="callout report-error">Unable to load report data: {error || latestError}</div>}

      <div className="summary report-summary">
        <div className="summary-item"><div className="num">{loading ? "…" : reportRows.length}</div><div className="lbl">Readings in report</div></div>
        <div className="summary-item normal"><div className="num">{averageRisk}</div><div className="lbl">Average risk score</div></div>
        <div className="summary-item warning"><div className="num">{warningReadings}</div><div className="lbl">Warning readings</div></div>
        <div className="summary-item high"><div className="num">{highReadings}</div><div className="lbl">High readings</div></div>
        <div className="summary-item"><div className="num">{reportAlerts.length}</div><div className="lbl">Alerts in period</div></div>
      </div>

      <section className="panel report-stations">
        <h2>Station status</h2>
        <div className="stations">
          {selectedStations.map((item) => (
            <div className="station report-station" key={item.station_id}>
              <div className="station-head">
                <div><div className="station-name">{item.name}</div><div className="muted small">{item.station_id}</div></div>
                <StatusBadge status={item.latest?.online ? item.latest.status : "OFFLINE"} />
              </div>
              <div className="station-foot muted small">
                <span>{item.latest ? `Latest: ${fmtTime(item.latest.received_at)}` : "No readings yet"}</span>
                <span>{item.active_alerts} active alerts</span>
              </div>
            </div>
          ))}
          {!selectedStations.length && !latestError && <p className="muted">Loading stations…</p>}
        </div>
      </section>

      <section className="panel table-wrap">
        <div className="report-table-heading">
          <div><h2>Reading log</h2><p className="muted small">{periodLabel} · newest 100 readings shown</p></div>
          <span className="muted small">{reportRows.length} matching readings</span>
        </div>
        <p className="report-limit muted small">
          The backend supplies up to 1,000 recent readings and 500 recent alerts per station. If a station reports frequently, the selected period may contain more data than this report can retrieve.
        </p>
        <table>
          <thead><tr><th>Time</th><th>Station</th><th>Status</th><th>Risk</th><th>Radon</th><th>PM2.5</th><th>Airflow</th><th>Temperature</th></tr></thead>
          <tbody>
            {reportRows.slice(-100).reverse().map(({ station_id, reading }, index) => (
              <tr key={`${station_id}-${reading.received_at}-${index}`}>
                <td>{new Date(reading.received_at).toLocaleString()}</td><td>{station_id}</td>
                <td><StatusBadge status={reading.status} /></td><td>{reading.risk_score}</td>
                <td>{reading.radon_bqm3}</td><td>{reading.pm25}</td><td>{reading.airflow_ms}</td><td>{reading.temperature}</td>
              </tr>
            ))}
            {!loading && reportRows.length === 0 && <tr><td colSpan="8" className="muted">No sensor readings found for this station and period.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>Alerts in selected period</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Station</th><th>Severity</th><th>Parameter</th><th>Details</th><th>Acknowledged</th></tr></thead>
            <tbody>
              {reportAlerts.slice(0, 100).map((alert) => (
                <tr key={alert.alert_id}><td>{new Date(alert.timestamp).toLocaleString()}</td><td>{alert.station_id}</td>
                  <td><StatusBadge status={alert.severity} /></td><td>{alert.parameter}</td><td>{alert.message}</td>
                  <td>{alert.acknowledged ? "Yes" : "No"}</td></tr>
              ))}
              {!loading && reportAlerts.length === 0 && <tr><td colSpan="6" className="muted">No alerts found for this period.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <p className="muted small report-disclaimer">Synthetic readings and demonstration thresholds only. This report is not a certified mine-safety record.</p>
    </div>
  );
}
