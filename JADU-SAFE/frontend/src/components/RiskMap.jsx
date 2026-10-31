import "leaflet/dist/leaflet.css";
import { Fragment, useMemo, useState } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { api, fmtAge, usePoll } from "../api";

const colors = { NORMAL: "#4cc2a5", WARNING: "#f0b43c", HIGH: "#ee5d4f", OFFLINE: "#6b7b8d" };
function icon(status) {
  return L.divIcon({ className: "map-pin", html: `<span style="background:${colors[status] || colors.OFFLINE}"></span>` });
}

function MapActions({ stations, selected }) {
  const map = useMap();
  const visible = stations.filter((s) => !selected || s.station_id === selected);
  const focus = () => {
    if (visible.length === 1) map.flyTo([visible[0].lat, visible[0].lng], 16, { duration: 0.6 });
    else if (visible.length) map.fitBounds(visible.map((s) => [s.lat, s.lng]), { padding: [40, 40], maxZoom: 16 });
  };
  return <button className="map-control btn" onClick={focus}>Recenter map</button>;
}

export default function RiskMap() {
  const { data } = usePoll(() => api("/api/sensors/latest"), 3000);
  const [selected, setSelected] = useState("");
  const [filter, setFilter] = useState("ALL");
  const stations = data?.stations || [];
  const enriched = useMemo(() => stations.map((s) => {
    const r = s.latest;
    return { ...s, reading: r, status: !r || !r.online ? "OFFLINE" : r.status };
  }), [stations]);
  const visible = enriched.filter((s) => filter === "ALL" || s.status === filter);
  const selectedStation = enriched.find((s) => s.station_id === selected);
  return <section className="panel map-panel">
    <div className="map-heading">
      <div><h2>GIS risk map <span className="muted small">fictional station coordinates</span></h2>
        <p className="muted small">Click a marker or station card to inspect live conditions.</p></div>
      <div className="map-toolbar">
        <label className="small">Show{" "}
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="ALL">All stations</option><option value="NORMAL">Normal</option>
            <option value="WARNING">Warning</option><option value="HIGH">High</option><option value="OFFLINE">Offline</option>
          </select>
        </label>
      </div>
    </div>
    <div className="map-layout">
      <div className="station-map-list">
        {visible.map((s) => <button key={s.station_id} className={`map-station ${selected === s.station_id ? "selected" : ""}`}
          onClick={() => setSelected(s.station_id)}>
          <span className="map-status-dot" style={{ background: colors[s.status] }} />
          <span><strong>{s.name}</strong><small>{s.status} · Risk {s.reading?.risk_score ?? "-"}</small></span>
        </button>)}
        {!visible.length && <p className="muted small">No stations match this filter.</p>}
      </div>
      <div className="map-wrap">
      <MapContainer center={[22.6528, 86.351]} zoom={15} className="risk-map">
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapActions stations={visible} selected={selected} />
      {visible.map((s) => {
        const r = s.reading;
        return <Fragment key={s.station_id}><Circle center={[s.lat, s.lng]} radius={s.status === "HIGH" ? 170 : s.status === "WARNING" ? 110 : 70}
          pathOptions={{ color: colors[s.status], fillColor: colors[s.status], fillOpacity: 0.12, weight: 1 }} />
          <Marker position={[s.lat, s.lng]} icon={icon(s.status)} eventHandlers={{ click: () => setSelected(s.station_id) }}>
          <Popup><strong>{s.name}</strong><br />{s.station_id}<br />Status: {s.status}<br />
            Risk score: {r?.risk_score ?? "-"}<br />Last update: {r ? fmtAge(r.age_seconds) : "-"}<br />
            Active alerts: {s.active_alerts}<br />{r ? `PM2.5 ${r.pm25} · Radon ${r.radon_bqm3}` : "No readings yet"}
          </Popup>
        </Marker></Fragment>;
      })}
      </MapContainer>
      <div className="map-legend">{Object.entries(colors).map(([name, color]) => <span key={name}><i style={{ background: color }} />{name[0] + name.slice(1).toLowerCase()}</span>)}</div>
      </div>
    </div>
    {selectedStation && <div className="map-detail panel">
      <div><strong>{selectedStation.name}</strong><div className="muted small">{selectedStation.station_id} · {selectedStation.source}</div></div>
      <div className="map-detail-metrics"><span><b>{selectedStation.reading?.risk_score ?? "-"}</b><small>Risk score</small></span>
        <span><b>{selectedStation.active_alerts}</b><small>Active alerts</small></span><span><b>{selectedStation.reading ? fmtAge(selectedStation.reading.age_seconds) : "-"}</b><small>Last update</small></span></div>
    </div>}
  </section>;
}
