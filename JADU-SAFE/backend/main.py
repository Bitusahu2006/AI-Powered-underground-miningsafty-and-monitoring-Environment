"""JADU-SAFE FastAPI backend  (simulation / demonstration only).

Wokwi ESP32 / Python simulators  ->  POST /api/sensors  ->  SQLite  ->  React dashboard
"""
from datetime import datetime, timezone
import random
import threading
import time
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import db
from config import API_KEY, OFFLINE_AFTER_SECONDS, PARAMETERS, STATIONS
from risk_engine import detect_anomalies, evaluate

app = FastAPI(title="JADU-SAFE API", version="0.1.0",
              description="Simulated underground-mine environmental monitoring. Demo thresholds only.")

# Dev setting: allow any origin so the Vite dev server / tunnel demo works. Restrict for production.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

scenario_state = {"name": "reset", "started_at": None}
scenario_lock = threading.Lock()


def scenario_record(station_id: str, scenario: str, tick: int) -> dict:
    values = {
        "radon_bqm3": 220, "gamma_usvh": 0.55, "pm25": 38, "pm10": 70,
        "ph": 7.0, "tds": 320, "airflow_ms": 2.2, "temperature": 33, "humidity": 72,
    }
    progress = min(1.0, tick / 15)
    if scenario == "vent_failure":
        values.update(airflow_ms=max(0.1, 2.2 - 1.8 * progress),
                      radon_bqm3=220 + 900 * progress, temperature=33 + 12 * progress)
    elif scenario == "dust_spike":
        values.update(pm25=38 + 110 * progress, pm10=70 + 210 * progress)
    elif scenario == "water_contamination":
        values.update(tds=320 + 850 * progress, ph=7.0 - 2.5 * progress)
    elif scenario == "sensor_fault":
        values.update(pm25=42, pm10=20 if tick % 2 else 42)
    if station_id == "JADU-STATION-03":
        values["temperature"] -= 3
        values["humidity"] -= 10
    return {"station_id": station_id, **{k: round(v + random.uniform(-0.5, 0.5), 2) for k, v in values.items()}}


def scenario_loop():
    tick = 0
    while True:
        time.sleep(3)
        with scenario_lock:
            name = scenario_state["name"]
        if name == "reset":
            tick = 0
            continue
        tick += 1
        for station_id in ("JADU-STATION-02", "JADU-STATION-03"):
            data = scenario_record(station_id, name, tick)
            record = {**data, "received_at": now_iso()}
            history = db.recent_readings(station_id, 60)
            result = evaluate(record)
            record.update(status=result["status"], risk_score=result["risk_score"],
                          parameters=result["parameters"], warnings=result["warnings"],
                          anomalies=detect_anomalies(record, history))
            db.insert_reading(record)


@app.on_event("startup")
def startup():
    db.init_db()
    threading.Thread(target=scenario_loop, daemon=True).start()


def require_key(x_api_key: Optional[str] = Header(default=None)):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key")


class SensorData(BaseModel):
    station_id: str
    radon_bqm3: float = Field(ge=0, le=100000)
    gamma_usvh: float = Field(ge=0, le=1000)
    pm25: float = Field(ge=0, le=2000)
    pm10: float = Field(ge=0, le=5000)
    ph: float = Field(ge=0, le=14)
    tds: float = Field(ge=0, le=20000)
    airflow_ms: float = Field(ge=0, le=50)
    temperature: float = Field(ge=-40, le=100)
    humidity: float = Field(ge=0, le=100)
    timestamp: Optional[str] = None


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def with_online(record: Optional[dict]):
    if not record:
        return None
    age = (datetime.now(timezone.utc) - datetime.fromisoformat(record["received_at"])).total_seconds()
    return {**record, "age_seconds": round(age), "online": age <= OFFLINE_AFTER_SECONDS}


@app.get("/")
def home():
    return {"message": "JADU-SAFE Backend Running", "note": "Simulated data and demonstration thresholds only"}


@app.get("/api/config")
def config():
    return {"parameters": PARAMETERS, "stations": STATIONS, "offline_after_seconds": OFFLINE_AFTER_SECONDS}


@app.post("/api/sensors", dependencies=[Depends(require_key)])
def receive_sensor_data(data: SensorData):
    if data.station_id not in STATIONS:
        raise HTTPException(status_code=404, detail=f"Unknown station_id. Known: {list(STATIONS)}")
    record = data.model_dump()
    record["received_at"] = now_iso()

    history = db.recent_readings(data.station_id, 60)
    result = evaluate(record)
    record.update(status=result["status"], risk_score=result["risk_score"],
                  parameters=result["parameters"], warnings=result["warnings"],
                  anomalies=detect_anomalies(record, history))
    db.insert_reading(record)

    new_alerts = []
    for w in result["warnings"]:
        if not db.active_alert_exists(data.station_id, w["parameter"], w["severity"]):
            aid = db.insert_alert(data.station_id, w["parameter"], w["value"], w["severity"],
                                  w["message"], record["received_at"])
            new_alerts.append(aid)
    return {"success": True, "status": record["status"], "risk_score": record["risk_score"],
            "new_alerts": new_alerts, "anomalies": record["anomalies"]}


@app.get("/api/sensors/latest")
def latest():
    active = db.count_active_alerts_by_station()
    out = []
    for sid, meta in STATIONS.items():
        rec = with_online(db.latest_reading(sid))
        out.append({"station_id": sid, **meta, "active_alerts": active.get(sid, 0), "latest": rec})
    return {"stations": out}


@app.get("/api/sensors/history")
def history(station_id: str = "JADU-STATION-01", limit: int = Query(100, ge=1, le=1000)):
    if station_id not in STATIONS:
        raise HTTPException(status_code=404, detail="Unknown station_id")
    rows = db.recent_readings(station_id, limit)
    slim = [{"received_at": r["received_at"], "status": r["status"], "risk_score": r["risk_score"],
             **{k: r[k] for k in PARAMETERS}} for r in rows]
    return {"station_id": station_id, "count": len(slim), "readings": slim}


@app.get("/api/alerts")
def alerts(severity: Optional[str] = None, acknowledged: Optional[bool] = None,
           station_id: Optional[str] = None, limit: int = Query(100, ge=1, le=500)):
    return {"alerts": db.list_alerts(severity, acknowledged, station_id, limit)}


@app.post("/api/alerts/{alert_id}/ack", dependencies=[Depends(require_key)])
def ack(alert_id: str):
    if not db.acknowledge(alert_id):
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True, "alert_id": alert_id}


@app.get("/api/stations")
def stations():
    return {"stations": [{"station_id": k, **v} for k, v in STATIONS.items()]}


@app.get("/api/summary")
def summary():
    counts = {"NORMAL": 0, "WARNING": 0, "HIGH": 0, "OFFLINE": 0}
    for sid in STATIONS:
        rec = with_online(db.latest_reading(sid))
        if not rec or not rec["online"]:
            counts["OFFLINE"] += 1
        else:
            counts[rec["status"]] += 1
    active = sum(db.count_active_alerts_by_station().values())
    return {"total_stations": len(STATIONS), "status_counts": counts, "active_alerts": active}


@app.get("/api/ai/status")
def ai_status(station_id: str = "JADU-STATION-02"):
    if station_id not in STATIONS:
        raise HTTPException(status_code=404, detail="Unknown station_id")
    rows = db.recent_readings(station_id, 60)
    current = rows[-1] if rows else None
    anomalies = current.get("anomalies", []) if current else []
    faults = []
    if len(rows) >= 3:
        for key in PARAMETERS:
            values = [r[key] for r in rows[-5:] if key in r]
            if len(values) >= 3 and max(values) - min(values) < max(abs(values[-1]) * 0.001, 0.01):
                faults.append({"parameter": key, "reason": "Value has flat-lined across recent readings"})
        for previous, latest_row in zip(rows[-10:-1], rows[-9:]):
            for key in PARAMETERS:
                if key in previous and key in latest_row and abs(latest_row[key] - previous[key]) > max(abs(previous[key]) * 3, 10):
                    faults.append({"parameter": key, "reason": "Impossible jump compared with the previous reading"})
        if current and current.get("pm10", 0) < current.get("pm25", 0):
            faults.append({"parameter": "pm10", "reason": "PM10 cannot be lower than PM2.5 in this simulation"})
    forecasts = []
    if len(rows) >= 5:
        for key, meta in PARAMETERS.items():
            values = [r[key] for r in rows[-20:] if key in r]
            if len(values) < 5:
                continue
            slope = (values[-1] - values[0]) / (len(values) - 1)
            targets = ([meta["warn"], meta["high"]] if meta["kind"] == "high" else
                       [meta["warn"]] if meta["kind"] == "low" else [meta["warn_min"], meta["high_min"]])
            for target in targets:
                if slope > 0 and target > values[-1]:
                    forecasts.append({"parameter": key, "label": meta["label"], "threshold": target,
                                       "minutes": round((target - values[-1]) / slope * 3 / 60, 1)})
                    break
    return {"station_id": station_id, "threshold_status": current.get("status") if current else "OFFLINE",
            "anomalies": anomalies, "sensor_faults": faults, "forecasts": forecasts,
            "note": "Forecasts and anomaly detection are demonstrations using synthetic data."}


@app.post("/api/scenario/{name}", dependencies=[Depends(require_key)])
def set_scenario(name: str):
    allowed = {"vent_failure", "dust_spike", "water_contamination", "sensor_fault", "reset"}
    if name not in allowed:
        raise HTTPException(status_code=400, detail=f"Unknown scenario. Choose from {sorted(allowed)}")
    with scenario_lock:
        scenario_state["name"] = name
        scenario_state["started_at"] = now_iso()
    return {"success": True, "scenario": name, "stations": ["JADU-STATION-02", "JADU-STATION-03"]}
