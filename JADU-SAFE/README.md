# JADU-SAFE: Phase 1 foundation

**Wokwi ESP32 → FastAPI → MySQL → React dashboard**

A software simulation of underground-mine environmental monitoring. All readings are synthetic and all
thresholds are demonstration values, **not** official AERB/ICRP/occupational safety limits.

## What is included

| Folder | What it does |
|---|---|
| `backend/` | FastAPI app: receives readings, stores history (SQLite or MySQL), risk score, alerts, simple anomaly check |
| `simulation/sensor_simulator.py` | Generates synthetic data for Stations 01, 02, and 03, with scenarios (ventilation failure, dust spike, water contamination) |
| `wokwi/` | ESP32 sketch + `diagram.json` for Station 01 (radon, gamma, PM2.5, PM10, pH, TDS, airflow, temp, humidity, RTC, LEDs) |
| `frontend/` | React + Vite dashboard: Overview, Live monitoring, Alerts, and GIS risk map; links to the standalone drone dashboard |

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

### Optional MySQL storage

The backend defaults to SQLite for local development. To store all readings and alerts in MySQL,
create the database once:

```sql
CREATE DATABASE jadu_safe CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Set these variables before starting the backend:

```powershell
$env:JADU_DB_BACKEND = "mysql"
$env:MYSQL_HOST = "127.0.0.1"
$env:MYSQL_PORT = "3306"
$env:MYSQL_DATABASE = "jadu_safe"
$env:MYSQL_USER = "root"
$env:MYSQL_PASSWORD = "your-password"
```

The backend creates the `readings` and `alerts` tables automatically on startup. Keep the password
outside source control.

### 2. Frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173. If the backend is elsewhere, edit `frontend/.env`.

### 3. All stations (new terminal)
```bash
cd simulation
python sensor_simulator.py
# demo scenarios:
python sensor_simulator.py --scenario vent_failure --after 20
python sensor_simulator.py --scenario dust_spike --after 20
python sensor_simulator.py --scenario water_contamination --after 20
```

By default the Python simulator sends readings for all three stations. To use Wokwi instead for Station 01 while keeping Stations 02 and 03 simulated, add `--skip-station-01`.

### 4. Connect Wokwi (optional Station 01 source)
Wokwi cannot reach `127.0.0.1` on your laptop, so expose the backend with a temporary public HTTPS tunnel:
```bash
# Option A: Cloudflare quick tunnel (install cloudflared first)
cloudflared tunnel --url http://localhost:8001
# Option B: ngrok
ngrok http 8001
```
Copy the `https://....trycloudflare.com` (or ngrok) URL into `SERVER_URL` in `wokwi/sketch.ino`, then follow `wokwi/README.txt`.
Run the Python simulator with `--skip-station-01` to avoid duplicate Station 01 readings. Turn the radon potentiometer up: the LED changes, the reading reaches FastAPI, and the dashboard and alerts update within seconds.

### Phase 2 demo features

The dashboard now includes:
- **GIS risk map** using React Leaflet and OpenStreetMap with fictional station coordinates.
- **AI intelligence** showing threshold status separately from z-score anomalies, simple trend forecasts,
  and probable sensor faults for each station.
- **Reports** with station/period filters, reading and alert summaries, CSV download, and print-to-PDF support.
- **Drone simulation** opens the standalone `smart_mining_drone.html` dashboard in a separate browser tab.
- **Scenario player** buttons for ventilation failure, dust spike, water contamination, sensor fault,
  and reset. These scenarios run server-side for Stations 02 and 03, so no simulator terminal is needed.

The scenario API requires the device key:
```powershell
Invoke-WebRequest -Method Post -Headers @{"X-API-Key"="jadu-demo-key"} `
  http://127.0.0.1:8000/api/scenario/dust_spike
```

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
| `GET /api/ai/status?station_id=` | Threshold, anomaly, forecast, and sensor-fault status |
| `POST /api/scenario/{name}` | Start a server-side demo scenario (`vent_failure`, `dust_spike`, `water_contamination`, `sensor_fault`, `reset`) |

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
- Next phases: reports, closed-loop response, worker dose tracking, forecasting.
