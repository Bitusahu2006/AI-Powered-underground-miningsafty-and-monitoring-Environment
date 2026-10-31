import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, fmtAge, fmtTime, usePoll } from "../api";
import { StatusBadge } from "./Status";

function thresholdLines(p) {
  if (!p) return [];
  if (p.kind === "range") {
    return [[p.warn_min, "#f0b43c"], [p.warn_max, "#f0b43c"], [p.high_min, "#ee5d4f"], [p.high_max, "#ee5d4f"]];
  }
  return [[p.warn, "#f0b43c"], [p.high, "#ee5d4f"]];
}

export default function LiveMonitoring() {
  const { data: cfg } = usePoll(() => api("/api/config"), 60000);
  const [station, setStation] = useState("JADU-STATION-01");
  const [param, setParam] = useState("radon_bqm3");
  const { data: latest, error } = usePoll(() => api("/api/sensors/latest"), 3000);
  const { data: hist } = usePoll(() => api(`/api/sensors/history?station_id=${station}&limit=80`), 3000, [station]);

  const params = cfg?.parameters || {};
  const st = (latest?.stations || []).find((s) => s.station_id === station);
  const rec = st?.latest;
  const p = params[param];

  return (
    <div className="stack">
      <div className="toolbar">
        <label>
          Station{" "}
          <select value={station} onChange={(e) => setStation(e.target.value)}>
            {(latest?.stations || []).map((s) => <option key={s.station_id} value={s.station_id}>{s.name} ({s.station_id})</option>)}
          </select>
        </label>
        <span className="muted small">
          {rec ? `Last reading ${fmtAge(rec.age_seconds)}${rec.online ? "" : " - station offline"}` : "Waiting for first reading"}
        </span>
        {error && <span className="badge high">Backend unreachable: {error}</span>}
      </div>

      {rec?.anomalies?.length > 0 && (
        <div className="callout">
          <strong>Unusual change detected.</strong>
          <ul>{rec.anomalies.map((a) => <li key={a.parameter}>{a.explanation}</li>)}</ul>
        </div>
      )}

      <div className="sensor-grid">
        {Object.entries(params).map(([key, meta]) => {
          const item = rec?.parameters?.[key];
          return (
            <button key={key} className={`sensor ${item?.status?.toLowerCase() || "offline"} ${param === key ? "selected" : ""}`}
              onClick={() => setParam(key)}>
              <div className="muted small">{meta.label}</div>
              <div className="sensor-value">
                {item ? item.value : "-"} <span className="unit">{meta.unit}</span>
              </div>
              <StatusBadge status={item?.status} />
            </button>
          );
        })}
      </div>

      <section className="panel">
        <h2>{p?.label || "Reading"} history <span className="muted small">dashed lines are demonstration thresholds</span></h2>
        <div className="chart-box tall">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={(hist?.readings || []).map((r) => ({ t: fmtTime(r.received_at), v: r[param] }))}>
              <CartesianGrid stroke="#324255" strokeDasharray="3 3" />
              <XAxis dataKey="t" stroke="#93a3b5" tick={{ fontSize: 11 }} minTickGap={40} />
              <YAxis stroke="#93a3b5" tick={{ fontSize: 11 }} domain={["auto", "auto"]} unit={p ? ` ${p.unit}` : ""} width={80} />
              <Tooltip contentStyle={{ background: "#1f2a37", border: "1px solid #324255" }} />
              {thresholdLines(p).map(([y, color], i) => <ReferenceLine key={i} y={y} stroke={color} strokeDasharray="5 5" ifOverflow="extendDomain" />)}
              <Line type="monotone" dataKey="v" stroke="#6fa8dc" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
