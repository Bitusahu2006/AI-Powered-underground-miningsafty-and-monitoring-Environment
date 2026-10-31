import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, fmtAge, fmtTime, usePoll } from "../api";
import { RiskMeter, StatusBadge } from "./Status";

export default function Overview({ goTo }) {
  const { data: latest } = usePoll(() => api("/api/sensors/latest"), 3000);
  const { data: summary } = usePoll(() => api("/api/summary"), 3000);
  const { data: alerts } = usePoll(() => api("/api/alerts?acknowledged=false&limit=5"), 4000);
  const [selected, setSelected] = useState("JADU-STATION-01");
  const { data: hist } = usePoll(() => api(`/api/sensors/history?station_id=${selected}&limit=60`), 3000, [selected]);

  const c = summary?.status_counts || {};
  const cards = [
    ["Stations", summary?.total_stations ?? "-", ""],
    ["Normal", c.NORMAL ?? "-", "normal"],
    ["Warning", c.WARNING ?? "-", "warning"],
    ["High", c.HIGH ?? "-", "high"],
    ["Offline", c.OFFLINE ?? "-", "offline"],
    ["Active alerts", summary?.active_alerts ?? "-", summary?.active_alerts ? "warning" : ""],
  ];

  return (
    <div className="stack">
      <div className="summary">
        {cards.map(([label, value, tone]) => (
          <div key={label} className={`summary-item ${tone}`}>
            <div className="num">{value}</div>
            <div className="lbl">{label}</div>
          </div>
        ))}
      </div>

      <section>
        <h2>Stations</h2>
        <div className="stations">
          {(latest?.stations || []).map((s) => {
            const r = s.latest;
            const status = !r ? "OFFLINE" : r.online ? r.status : "OFFLINE";
            return (
              <button key={s.station_id} className={`station ${selected === s.station_id ? "selected" : ""}`}
                onClick={() => setSelected(s.station_id)}>
                <div className="station-head">
                  <div>
                    <div className="station-name">{s.name}</div>
                    <div className="muted small">{s.station_id} · {s.source}</div>
                  </div>
                  <StatusBadge status={status} />
                </div>
                <RiskMeter score={r?.online ? r.risk_score : null} status={status} />
                <div className="station-foot muted small">
                  <span>{r ? `Updated ${fmtAge(r.age_seconds)}` : "No data yet"}</span>
                  <span>{s.active_alerts} active alert{s.active_alerts === 1 ? "" : "s"}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="two-col">
        <section className="panel">
          <h2>Risk score trend <span className="muted small">{selected}</span></h2>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={(hist?.readings || []).map((r) => ({ t: fmtTime(r.received_at), risk: r.risk_score }))}>
                <defs>
                  <linearGradient id="rk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6fa8dc" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#6fa8dc" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#324255" strokeDasharray="3 3" />
                <XAxis dataKey="t" stroke="#93a3b5" tick={{ fontSize: 11 }} minTickGap={40} />
                <YAxis domain={[0, 100]} stroke="#93a3b5" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#1f2a37", border: "1px solid #324255" }} />
                <ReferenceLine y={40} stroke="#f0b43c" strokeDasharray="4 4" />
                <ReferenceLine y={75} stroke="#ee5d4f" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="risk" stroke="#6fa8dc" fill="url(#rk)" strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel">
          <h2>Unacknowledged alerts</h2>
          {(alerts?.alerts || []).length === 0 && <p className="muted">No active alerts. Turn a potentiometer past its threshold to create one.</p>}
          <ul className="alert-list">
            {(alerts?.alerts || []).map((a) => (
              <li key={a.alert_id}>
                <StatusBadge status={a.severity} />
                <div>
                  <div>{a.message}</div>
                  <div className="muted small">{a.station_id} · {fmtTime(a.timestamp)}</div>
                </div>
              </li>
            ))}
          </ul>
          <button className="link" onClick={() => goTo("alerts")}>Open all alerts</button>
        </section>
      </div>
    </div>
  );
}
