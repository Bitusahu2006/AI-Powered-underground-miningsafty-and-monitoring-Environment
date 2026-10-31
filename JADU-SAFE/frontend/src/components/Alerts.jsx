import { useState } from "react";
import { api, fmtTime, usePoll } from "../api";
import { StatusBadge } from "./Status";

export default function Alerts() {
  const [severity, setSeverity] = useState("");
  const [showAck, setShowAck] = useState(false);
  const qs = `?limit=200${severity ? `&severity=${severity}` : ""}${showAck ? "" : "&acknowledged=false"}`;
  const { data, reload } = usePoll(() => api(`/api/alerts${qs}`), 3000, [qs]);

  const ack = async (id) => {
    await api(`/api/alerts/${id}/ack`, { method: "POST" });
    reload();
  };

  const alerts = data?.alerts || [];
  return (
    <div className="stack">
      <div className="toolbar">
        <label>Severity{" "}
          <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="">All</option>
            <option value="WARNING">Warning</option>
            <option value="HIGH">High</option>
          </select>
        </label>
        <label className="check"><input type="checkbox" checked={showAck} onChange={(e) => setShowAck(e.target.checked)} /> Include acknowledged</label>
        <span className="muted small">{alerts.length} shown</span>
      </div>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr><th>Alert</th><th>Severity</th><th>Station</th><th>Parameter</th><th>Value</th><th>Time</th><th>Status</th></tr>
          </thead>
          <tbody>
            {alerts.length === 0 && <tr><td colSpan="7" className="muted">No alerts match this filter.</td></tr>}
            {alerts.map((a) => (
              <tr key={a.alert_id}>
                <td>{a.alert_id}</td>
                <td><StatusBadge status={a.severity} /></td>
                <td>{a.station_id}</td>
                <td>{a.parameter}</td>
                <td>{a.value}</td>
                <td>{fmtTime(a.timestamp)}</td>
                <td>{a.acknowledged ? <span className="muted">Acknowledged</span> : <button className="btn" onClick={() => ack(a.alert_id)}>Acknowledge</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
