import { useState } from "react";
import Alerts from "./components/Alerts.jsx";
import GisMap from "./components/GisMap.jsx";
import LiveMonitoring from "./components/LiveMonitoring.jsx";
import Overview from "./components/Overview.jsx";
import AIIntelligence from "./components/AIIntelligence.jsx";
import Reports from "./components/Reports.jsx";

const TABS = [
  ["overview", "Overview"],
  ["live", "Live monitoring"],
  ["alerts", "Alerts"],
  ["gis", "GIS risk map"],
  ["ai", "AI intelligence"],
  ["reports", "Reports"],
];

export default function App() {
  const [tab, setTab] = useState("overview");
  return (
    <div className="app">
      <header>
        <div>
          <h1>JADU-SAFE</h1>
          <div className="muted small">Underground mine environmental and worker-safety monitoring</div>
        </div>
        <div className="sim-note">Simulated data · demonstration thresholds, not official safety limits</div>
      </header>
      <nav>
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>
        ))}
        <a href="/smart_mining_drone.html" target="_blank" rel="noreferrer">Drone simulation ↗</a>
      </nav>
      <main>
        {tab === "overview" && <Overview goTo={setTab} />}
        {tab === "live" && <LiveMonitoring />}
        {tab === "alerts" && <Alerts />}
        {tab === "gis" && <GisMap goTo={setTab} />}
        {tab === "ai" && <AIIntelligence />}
        {tab === "reports" && <Reports />}
      </main>
    </div>
  );
}