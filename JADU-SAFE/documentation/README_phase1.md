# JADU-SAFE: Phase 1 foundation

**Wokwi ESP32 → FastAPI → SQLite → React dashboard**

A software simulation of underground-mine environmental monitoring. All readings are synthetic and all
thresholds are demonstration values, **not** official AERB/ICRP/occupational safety limits.

## What is included

| Folder | What it does |
|---|---|
| `backend/` | FastAPI app: receives readings, stores history (SQLite), risk score, alerts, simple anomaly check |
| `simulation/sensor_simulator.py` | Generates Station 02 and 03 data, with scenarios (ventilation failure, dust spike, water contamination) |
| `wokwi/` | ESP32 sketch + `diagram.json` for Station 01 (radon, gamma, PM2.5, PM10, pH, TDS, airflow, temp, humidity, RTC, LEDs) |
| `frontend/` | React + Vite dashboard: Overview, Live monitoring, Alerts |

## Quick start (Windows, VS Code terminal)

Requirements: Python 3.10+, Node.js 18+.

### 1. Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
Open http://127.0.0.1:8000/docs to test the API. Device key (header `X-API-Key`): `jadu-demo-key`
(change it in `backend/config.py` or with the `JADU_API_KEY` environment variable).

### 2. Frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173. If the backend is elsewhere, edit `frontend/.env`.

### 3. Stations 02 and 03 (new terminal)
```bash
cd simulation
python sensor_simulator.py
# demo scenarios:
python sensor_simulator.py --scenario vent_failure --after 20
python sensor_simulator.py --scenario dust_spike --after 20
python sensor_simulator.py --scenario water_contamination --after 20
```

### 4. Connect Wokwi (Station 01)
Wokwi cannot reach `127.0.0.1` on your laptop, so expose the backend with a temporary public HTTPS tunnel:
```bash
# Option A: Cloudflare quick tunnel (install cloudflared first)
cloudflared tunnel --url http://localhost:8000
# Option B: ngrok
ngrok http 8000
```
Copy the `https://....trycloudflare.com` (or ngrok) URL into `SERVER_URL` in `wokwi/sketch.ino`, then follow `wokwi/README.txt`.
Turn the radon potentiometer up: the LED changes, the reading reaches FastAPI, and the dashboard and alerts update within seconds.

**Test without Wokwi first:** in http://127.0.0.1:8000/docs use `POST /api/sensors` (click Authorize / add header `X-API-Key: jadu-demo-key`).

## API

| Endpoint | Purpose |
|---|---|
| `GET /` | Health check |
| `GET /api/config` | Parameters, units, thresholds, stations |
| `POST /api/sensors` | Receive a reading (needs `X-API-Key`) |
| `GET /api/sensors/latest` | Latest reading per station, with online/offline |
| `GET /api/sensors/history?station_id=&limit=` | History for charts |
| `GET /api/alerts?severity=&acknowledged=` | Alert list |
| `POST /api/alerts/{id}/ack` | Acknowledge an alert |
| `GET /api/summary` | Counts for the overview cards |

Example payload:
```json
{"station_id":"JADU-STATION-01","radon_bqm3":220,"gamma_usvh":0.4,"pm25":35,"pm10":60,"ph":7.1,
 "tds":280,"airflow_ms":2.4,"temperature":29.5,"humidity":65,"timestamp":"2026-10-31T10:30:00"}
```

## How the logic works
- **Threshold status:** each parameter is NORMAL / WARNING / HIGH using `backend/config.py` (edit freely).
- **Risk score 0-100:** driven by the worst parameter, nudged by how many are elevated.
- **Anomaly check:** z-score against the station's last 60 readings (needs 15+ readings). Shown separately from threshold status.
- **Alerts:** one alert per station + parameter + severity until acknowledged (no spam).
- **Offline:** a station with no reading for 20 s is shown as offline.
- **Edge logic:** the ESP32 sets its LEDs locally and buffers up to 15 readings if the network drops.

## Notes and limits
- PM10 on the ESP32 is derived from PM2.5 (x1.7) to save an ADC1 pin; the six pots use ADC1 pins so Wi-Fi does not interfere.
- Station coordinates are fictional placeholders.
- Next phases: GIS map, 3D twin, drone simulation, reports, closed-loop response, worker dose tracking, forecasting.
