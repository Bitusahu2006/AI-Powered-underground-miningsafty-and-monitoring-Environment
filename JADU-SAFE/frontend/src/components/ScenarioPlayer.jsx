import { api, usePoll } from "../api";
const scenarios = [["vent_failure", "Ventilation failure"], ["dust_spike", "Dust spike"], ["water_contamination", "Water contamination"], ["sensor_fault", "Sensor fault"], ["reset", "Reset"]];
export default function ScenarioPlayer() {
  const { data } = usePoll(() => api("/api/sensors/latest"), 3000);
  async function run(name) { await api(`/api/scenario/${name}`, { method: "POST" }); }
  return <section className="panel"><h2>Scenario player</h2><p className="muted small">Server-side scripted data for Stations 02 and 03.</p>
    <div className="scenario-buttons">{scenarios.map(([id, label]) => <button className="btn" key={id} onClick={() => run(id)}>{label}</button>)}</div>
    <div className="muted small">Latest: {(data?.stations || []).map((s) => `${s.station_id} ${s.latest?.status || "offline"}`).join(" · ")}</div>
  </section>;
}
