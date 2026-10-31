"""Rule-based risk engine + simple statistical anomaly check (demonstration only)."""
from statistics import mean, pstdev
from config import PARAMETERS


def param_status(key: str, value: float):
    """Return (status, severity_ratio) for one parameter. ratio 0..1+ (1 = at HIGH threshold)."""
    p = PARAMETERS[key]
    if p["kind"] == "high":
        ratio = value / p["high"]
        if value >= p["high"]:
            return "HIGH", ratio
        if value >= p["warn"]:
            return "WARNING", ratio
        return "NORMAL", ratio
    if p["kind"] == "low":
        # lower is worse; the "high" threshold is the smaller number
        if value <= p["high"]:
            return "HIGH", 1.0
        if value <= p["warn"]:
            return "WARNING", 0.5 + 0.5 * (p["warn"] - value) / (p["warn"] - p["high"])
        return "NORMAL", 0.0
    # range
    if value < p["high_min"] or value > p["high_max"]:
        return "HIGH", 1.0
    if value < p["warn_min"] or value > p["warn_max"]:
        return "WARNING", 0.6
    return "NORMAL", 0.0


def warn_fraction(key: str, value: float) -> float:
    """How close a NORMAL reading is to its warning threshold (0..1)."""
    p = PARAMETERS[key]
    if p["kind"] == "high":
        return min(value / p["warn"], 1.0)
    if p["kind"] == "low":
        return min(p["warn"] / max(value, 1e-6), 1.0) if value > 0 else 1.0
    return 0.0


def evaluate(data: dict) -> dict:
    """Per-parameter status, overall status, 0-100 risk score and human-readable warnings."""
    parameters, warnings, ratios = {}, [], []
    for key, p in PARAMETERS.items():
        value = data[key]
        status, ratio = param_status(key, value)
        parameters[key] = {"value": value, "status": status}
        ratios.append(min(ratio, 1.0))
        if status != "NORMAL":
            warnings.append(
                {"parameter": key, "label": p["label"], "value": value, "unit": p["unit"],
                 "severity": status,
                 "message": f"Simulated {p['label']} = {value} {p['unit']} crossed the {status.lower()} demonstration threshold"}
            )
    statuses = [v["status"] for v in parameters.values()]
    overall = "HIGH" if "HIGH" in statuses else "WARNING" if "WARNING" in statuses else "NORMAL"
    # Risk score: dominated by the worst parameter, nudged by how many are elevated.
    elevated = sum(1 for s in statuses if s != "NORMAL")
    score = round(min(100, max(ratios) * 85 + elevated * 5)) if ratios else 0
    if overall == "NORMAL":
        score = round(30 * max(warn_fraction(k, data[k]) for k in PARAMETERS) ** 2)
    elif overall == "WARNING":
        score = min(max(score, 40), 74)
    else:
        score = max(score, 75)
    return {"parameters": parameters, "status": overall, "risk_score": score, "warnings": warnings}


def detect_anomalies(current: dict, history: list, min_samples: int = 15, z_limit: float = 3.0) -> list:
    """Flag parameters that deviate strongly from this station's recent behaviour (z-score)."""
    if len(history) < min_samples:
        return []
    found = []
    for key in PARAMETERS:
        series = [h[key] for h in history if key in h]
        if len(series) < min_samples:
            continue
        mu, sd = mean(series), pstdev(series)
        sd = max(sd, 0.02 * abs(mu), 1e-6)  # avoid false alarms on nearly-flat signals
        z = (current[key] - mu) / sd
        if abs(z) >= z_limit:
            found.append({"parameter": key, "label": PARAMETERS[key]["label"], "z_score": round(z, 2),
                          "explanation": f"{PARAMETERS[key]['label']} is {abs(z):.1f}σ {'above' if z > 0 else 'below'} the recent average ({mu:.1f})"})
    return found
