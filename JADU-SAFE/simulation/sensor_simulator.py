"""Python sensor simulator for JADU-STATION-01, JADU-STATION-02, and JADU-STATION-03.
Sends SYNTHETIC readings to the FastAPI backend.

Usage:
    python sensor_simulator.py                          # normal behaviour, all stations
    python sensor_simulator.py --skip-station-01        # use Wokwi for Station 01
    python sensor_simulator.py --scenario vent_failure --after 30
    python sensor_simulator.py --url https://xxxx.trycloudflare.com --interval 3

Scenarios: normal, vent_failure, dust_spike, water_contamination
"""
import argparse
import json
import random
import time
import urllib.error
import urllib.request

BASE = {
    "JADU-STATION-01": dict(radon_bqm3=180, gamma_usvh=0.40, pm25=30, pm10=55, ph=7.2, tds=280, airflow_ms=2.5, temperature=29, humidity=65),
    "JADU-STATION-02": dict(radon_bqm3=220, gamma_usvh=0.55, pm25=38, pm10=70, ph=7.0, tds=320, airflow_ms=2.2, temperature=33, humidity=72),
    "JADU-STATION-03": dict(radon_bqm3=90,  gamma_usvh=0.25, pm25=28, pm10=52, ph=7.3, tds=410, airflow_ms=3.0, temperature=30, humidity=58),
}
NOISE = dict(radon_bqm3=12, gamma_usvh=0.03, pm25=3, pm10=5, ph=0.05, tds=10, airflow_ms=0.08, temperature=0.4, humidity=1.5)
LIMITS = dict(radon_bqm3=(0, 5000), gamma_usvh=(0, 20), pm25=(0, 500), pm10=(0, 900), ph=(0, 14), tds=(0, 5000),
              airflow_ms=(0, 10), temperature=(-10, 80), humidity=(0, 100))


def apply_scenario(values: dict, scenario: str, progress: float) -> dict:
    """progress goes 0 -> 1 over ~40 seconds after the scenario starts."""
    v = dict(values)
    if scenario == "vent_failure":     # fan stops, radon builds up
        v["airflow_ms"] *= (1 - 0.95 * progress)
        v["radon_bqm3"] *= (1 + 6.0 * progress)
        v["temperature"] += 8 * progress
    elif scenario == "dust_spike":
        v["pm25"] *= (1 + 4.5 * progress)
        v["pm10"] *= (1 + 3.5 * progress)
    elif scenario == "water_contamination":
        v["tds"] *= (1 + 2.2 * progress)
        v["ph"] -= 2.4 * progress
    return v


def post(url: str, key: str, payload: dict):
    req = urllib.request.Request(url.rstrip("/") + "/api/sensors", data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json", "X-API-Key": key}, method="POST")
    with urllib.request.urlopen(req, timeout=8) as r:
        return json.loads(r.read())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:8000")
    ap.add_argument("--key", default="jadu-demo-key")
    ap.add_argument("--interval", type=float, default=3.0)
    ap.add_argument("--scenario", default="normal", choices=["normal", "vent_failure", "dust_spike", "water_contamination"])
    ap.add_argument("--after", type=float, default=20.0, help="seconds before the scenario starts")
    ap.add_argument("--station", default="JADU-STATION-02", help="station the scenario affects")
    ap.add_argument("--skip-station-01", action="store_true", help="leave Station 01 to the Wokwi simulator")
    args = ap.parse_args()

    state = {sid: dict(vals) for sid, vals in BASE.items()}
    t0 = time.time()
    print(f"Simulator running -> {args.url}  (scenario={args.scenario} on {args.station} after {args.after}s)")
    while True:
        elapsed = time.time() - t0
        progress = min(1.0, max(0.0, (elapsed - args.after) / 40.0))
        for sid, vals in state.items():
            if args.skip_station_01 and sid == "JADU-STATION-01":
                continue
            for k in vals:  # slow random walk around the baseline
                lo, hi = LIMITS[k]
                vals[k] = min(hi, max(lo, vals[k] + random.gauss(0, NOISE[k]) + 0.1 * (BASE[sid][k] - vals[k])))
            out = apply_scenario(vals, args.scenario, progress) if sid == args.station else vals
            out = {k: round(min(LIMITS[k][1], max(LIMITS[k][0], x)), 2) for k, x in out.items()}
            payload = {"station_id": sid, **out}
            try:
                res = post(args.url, args.key, payload)
                print(f"{sid}: {res['status']:<7} risk={res['risk_score']:>3} new_alerts={res['new_alerts']}")
            except (urllib.error.URLError, TimeoutError) as e:
                print(f"{sid}: send failed ({e})")
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
