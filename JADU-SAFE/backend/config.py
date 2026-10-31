"""JADU-SAFE configuration.

All thresholds are DEMONSTRATION thresholds for a software simulation.
They are NOT official AERB / ICRP / occupational safety limits.
"""
import os

# Device authentication: ESP32 and simulators send this in the X-API-Key header.
# Set to "" to disable. Change it before any public demo.
API_KEY = os.getenv("JADU_API_KEY", "jadu-demo-key")

DB_PATH = os.getenv("JADU_DB_PATH", "jadu_safe.db")

DB_BACKEND = os.getenv("JADU_DB_BACKEND", "sqlite").lower()
MYSQL_HOST = os.getenv("MYSQL_HOST", "127.0.0.1")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "jadu_safe")
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")

# A station is shown as OFFLINE if no reading arrived within this many seconds.
OFFLINE_AFTER_SECONDS = 20

# kind "high"  -> value above warn/high is bad
# kind "low"   -> value below warn/high is bad
# kind "range" -> value outside [warn_min, warn_max] is WARNING, outside [high_min, high_max] is HIGH
PARAMETERS = {
    "radon_bqm3":  {"label": "Radon-222",   "unit": "Bq/m³", "kind": "high",  "warn": 300,  "high": 1000},
    "gamma_usvh":  {"label": "Gamma dose rate", "unit": "µSv/h", "kind": "high", "warn": 1.0, "high": 2.5},
    "pm25":        {"label": "PM2.5",       "unit": "µg/m³", "kind": "high",  "warn": 60,   "high": 120},
    "pm10":        {"label": "PM10",        "unit": "µg/m³", "kind": "high",  "warn": 100,  "high": 250},
    "ph":          {"label": "Water pH",    "unit": "pH",    "kind": "range", "warn_min": 6.5, "warn_max": 8.5, "high_min": 5.5, "high_max": 9.5},
    "tds":         {"label": "Water TDS",   "unit": "ppm",   "kind": "high",  "warn": 600,  "high": 1000},
    "airflow_ms":  {"label": "Ventilation airflow", "unit": "m/s", "kind": "low", "warn": 1.0, "high": 0.5},
    "temperature": {"label": "Temperature", "unit": "°C",    "kind": "high",  "warn": 38,   "high": 45},
    "humidity":    {"label": "Humidity",    "unit": "%",     "kind": "range", "warn_min": 20, "warn_max": 85, "high_min": 10, "high_max": 95},
}

# Fictional / demonstration coordinates (not real survey data).
STATIONS = {
    "JADU-STATION-01": {"name": "Mine entrance",               "lat": 22.6540, "lng": 86.3510, "source": "Python simulator"},
    "JADU-STATION-02": {"name": "Underground tunnel section A", "lat": 22.6528, "lng": 86.3532, "source": "Python simulator"},
    "JADU-STATION-03": {"name": "Processing-area boundary",     "lat": 22.6511, "lng": 86.3498, "source": "Python simulator"},
}
