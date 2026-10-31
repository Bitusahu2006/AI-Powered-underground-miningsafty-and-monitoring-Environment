import { Fragment, useEffect, useRef, useState } from "react";
import { Circle, MapContainer, Marker, Polygon, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api, fmtAge, fmtTime, usePoll } from "../api";
import { StatusBadge } from "./Status";

const COLORS = { NORMAL: "#4cc2a5", WARNING: "#f0b43c", HIGH: "#ee5d4f", OFFLINE: "#6b7b8d" };
const MINE_BOUNDARY = [[22.6552, 86.3478], [22.6554, 86.3549], [22.6500, 86.3552], [22.6497, 86.3480]];
const RESTRICTED_ZONE = [[22.65355, 86.35275], [22.65365, 86.35405], [22.65255, 86.35435], [22.6519, 86.35325], [22.65245, 86.35245]];
const SAFE_ZONE = [[22.65155, 86.34845], [22.65215, 86.34845], [22.65215, 86.3492], [22.65155, 86.3492]];
const ZONE_LABELS = [
  {
    position: [22.65505, 86.35135],
    className: "boundary",
    text: "DEMO MINE BOUNDARY",
    width: 150,
  },
  {
    position: [22.6528, 86.35325],
    className: "restricted",
    text: "NO ENTRY · DEMO",
    width: 130,
  },
  {
    position: [22.65185, 86.3488],
    className: "safe",
    text: "DESIGNATED ZONE · DEMO",
    width: 170,
  },
].map(({ position, className, text, width }) => ({
  position,
  icon: L.divIcon({
    className: "gis-zone-marker",
    html: `<span class="gis-zone-label ${className}">${text}</span>`,
    iconSize: [width, 24],
    iconAnchor: [width / 2, 12],
  }),
}));

// Cache icons so markers are not rebuilt on every 3 s refresh.
const iconCache = new Map();
function pinIcon(status, score, selected) {
  const key = `${status}|${score}|${selected}`;
  if (!iconCache.has(key)) {
    iconCache.set(
      key,
      L.divIcon({
        className: "gis-marker",
        html: `<div class="gis-pin ${status.toLowerCase()} ${selected ? "sel" : ""}"><span>${score ?? "–"}</span></div>`,
        iconSize: [46, 46],
        iconAnchor: [23, 23],
        popupAnchor: [0, -26],
      })
    );
  }
  return iconCache.get(key);
}

function stationStatus(s) {
  const r = s.latest;
  return !r || !r.online ? "OFFLINE" : r.status;
}

/** Fits the map to all stations once, and flies to a station when it is selected from the list. */
function MapController({ stations, selected, markerRefs }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (!fitted.current && stations.length) {
      map.fitBounds(MINE_BOUNDARY, { padding: [24, 24], maxZoom: 16 });
      fitted.current = true;
    }
  }, [stations, map]);

  useEffect(() => {
    const s = stations.find((x) => x.station_id === selected);
    if (s) {
      map.flyTo([s.lat, s.lng], Math.max(map.getZoom(), 16), { duration: 0.8 });
      setTimeout(() => markerRefs.current[selected]?.openPopup(), 850);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return null;
}

export default function GisMap({ goTo }) {
  const { data: latest, error } = usePoll(() => api("/api/sensors/latest"), 3000);
  const { data: cfg } = usePoll(() => api("/api/config"), 60000);
  const [selected, setSelected] = useState(null);
  const markerRefs = useRef({});

  const stations = latest?.stations || [];
  const params = cfg?.parameters || {};
  const center = stations.length ? [stations[0].lat, stations[0].lng] : [22.652, 86.351];

  return (
    <div className="stack">
      <div className="toolbar">
        <span className="muted small">
          Station positions are fictional demonstration coordinates, not survey data. Colours and scores come from simulated readings.
        </span>
        {error && <span className="badge high">Backend unreachable: {error}</span>}
      </div>

      <div className="gis-layout">
        <div className="gis-map panel">
          <MapContainer
            center={center}
            zoom={16}
            minZoom={14}
            maxZoom={19}
            maxBounds={MINE_BOUNDARY}
            maxBoundsViscosity={1}
            scrollWheelZoom
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Polygon
              positions={MINE_BOUNDARY}
              pathOptions={{ color: "#e8eef5", fill: false, weight: 3, dashArray: "8 6" }}
            />
            <Polygon
              positions={RESTRICTED_ZONE}
              pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.38, weight: 2 }}
            >
              <Popup>
                <strong>Restricted area · demonstration</strong>
                <p>This illustrative no-entry zone is for the dashboard demo only and is not an official site boundary.</p>
              </Popup>
            </Polygon>
            <Polygon
              positions={SAFE_ZONE}
              pathOptions={{ color: "#38bdf8", fillColor: "#38bdf8", fillOpacity: 0.34, weight: 2 }}
            >
              <Popup>
                <strong>Designated safe zone · demonstration</strong>
                <p>Blue marks this illustrative area; live sensor status may change and must be checked separately.</p>
              </Popup>
            </Polygon>
            {ZONE_LABELS.map((zone) => (
              <Marker
                key={zone.icon.options.html}
                position={zone.position}
                icon={zone.icon}
                interactive={false}
                keyboard={false}
                zIndexOffset={1000}
              />
            ))}
            <MapController stations={stations} selected={selected} markerRefs={markerRefs} />
            {stations.map((s) => {
              const status = stationStatus(s);
              const r = s.latest;
              return (
                <Fragment key={s.station_id}>
                  <Circle
                    center={[s.lat, s.lng]}
                    radius={90}
                    pathOptions={{ color: COLORS[status], fillColor: COLORS[status], fillOpacity: 0.18, weight: 1.5 }}
                  />
                  <Marker
                    position={[s.lat, s.lng]}
                    icon={pinIcon(status, r?.online ? r.risk_score : null, selected === s.station_id)}
                    ref={(m) => { if (m) markerRefs.current[s.station_id] = m; }}
                    eventHandlers={{ click: () => setSelected(s.station_id) }}
                  >
                    <Popup minWidth={260} maxWidth={300}>
                      <div className="gis-popup">
                        <div className="gis-popup-head">
                          <div>
                            <div className="gis-popup-title">{s.name}</div>
                            <div className="gis-popup-sub">{s.station_id} · {s.source}</div>
                          </div>
                          <StatusBadge status={status} />
                        </div>
                        {r ? (
                          <>
                            <div className="gis-popup-meta">
                              <span>Risk score <strong>{r.risk_score}</strong></span>
                              <span>{s.active_alerts} active alert{s.active_alerts === 1 ? "" : "s"}</span>
                            </div>
                            <table className="gis-popup-table">
                              <tbody>
                                {Object.entries(params).map(([key, meta]) => {
                                  const item = r.parameters?.[key];
                                  return (
                                    <tr key={key}>
                                      <td>{meta.label}</td>
                                      <td className={`v ${item?.status?.toLowerCase() || ""}`}>
                                        {item ? item.value : "-"} <small>{meta.unit}</small>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            <div className="gis-popup-sub">
                              Last update {fmtTime(r.received_at)} ({fmtAge(r.age_seconds)})
                            </div>
                            {r.anomalies?.length > 0 && (
                              <div className="gis-popup-anom">Unusual: {r.anomalies.map((a) => a.label).join(", ")}</div>
                            )}
                            <button className="gis-popup-link" onClick={() => goTo("alerts")}>View alerts</button>
                          </>
                        ) : (
                          <div className="gis-popup-sub">No readings received yet.</div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                </Fragment>
              );
            })}
          </MapContainer>

          <div className="gis-legend">
            {Object.entries(COLORS).map(([k, c]) => (
              <span key={k}><i style={{ background: c }} />{k.charAt(0) + k.slice(1).toLowerCase()}</span>
            ))}
            <span><i className="gis-legend-boundary" />Mine boundary</span>
            <span><i className="gis-legend-restricted" />Restricted / no entry</span>
            <span><i className="gis-legend-safe" />Designated zone (blue)</span>
          </div>
        </div>

        <aside className="gis-side">
          <h2>Stations</h2>
          {stations.map((s) => {
            const status = stationStatus(s);
            return (
              <button key={s.station_id} className={`gis-item ${selected === s.station_id ? "selected" : ""}`}
                onClick={() => setSelected(s.station_id)}>
                <span className={`dot ${status.toLowerCase()}`} />
                <span className="gis-item-text">
                  <span className="gis-item-name">{s.name}</span>
                  <span className="muted small">
                    {s.latest ? `Risk ${s.latest.online ? s.latest.risk_score : "-"} · ${fmtAge(s.latest.age_seconds)}` : "No data yet"}
                  </span>
                </span>
                <StatusBadge status={status} />
              </button>
            );
          })}
          <p className="muted small">Click a station to zoom in and open its readings. Circles show a simulated zone of influence (about 90 m).</p>
          <div className="gis-zone-note">
            <strong>Map overlays are illustrative only.</strong>
            <span>Red means demo restricted/no-entry; blue marks a designated demo zone. They are not surveyed boundaries or real-time access clearances.</span>
          </div>
        </aside>
      </div>
    </div>
  );
}