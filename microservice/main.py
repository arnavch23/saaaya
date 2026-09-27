"""Serve the prototype-trained, evidence-calibrated SAAYA surge surrogate."""
from datetime import date as Date
from pathlib import Path
import os
import logging

import pandas as pd
from catboost import CatBoostRegressor
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

BASE = Path(__file__).resolve().parent
load_dotenv(BASE / ".env")
MODEL_PATH = BASE / "model" / "SAAYA_Hospital_CatBoost.cbm"
WARD_PATH = BASE / "model" / "SAAYA_Ward_Populations.csv"
FEATURE_PATH = BASE / "model" / "SAAYA_Hospital_Model_Features.csv"
PROTOTYPE_WEATHER_PATH = BASE / "data" / "SAAYA_Prototype_Weather_Training.csv"

app = FastAPI(title="SAAYA Hospital Surge Inference")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO").upper())
logger = logging.getLogger("saaya.surge")
origins = [value.strip() for value in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if value.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

model = CatBoostRegressor()
model.load_model(str(MODEL_PATH))
feature_names = pd.read_csv(FEATURE_PATH)["feature"].astype(str).tolist()
if feature_names != list(model.feature_names_):
    raise RuntimeError("Feature manifest does not match the loaded CatBoost model")
prototype_weather = pd.read_csv(PROTOTYPE_WEATHER_PATH, dtype={"date": str, "ward_id": int})
ward_populations = pd.read_csv(WARD_PATH).set_index("ward_id")["population"]

# The heatmap's existing operational risk categories are derived from its
# calibrated 0–100 thermal-risk score. Add a transparent monotonic adjustment
# after the temperature-only CatBoost estimate so the displayed surge estimate
# is directionally consistent with the heatmap. This is a prototype alignment
# rule, not a coefficient learned from observed hospital admissions.
RISK_BAND_SURGE_ADJUSTMENT = {
    "Low": 0.0,
    "Moderate": 1.0,
    "High": 2.0,
    "Very High": 3.0,
    "Extreme": 4.0,
}


def operational_risk_score(row: pd.Series, ward_id: int) -> int:
    # Match frontend/src/data/historicalRisk.ts exposure offsets and
    # thermalStress.ts operational cutoffs exactly.
    exposure_offsets = (-25, -18, -12, -6, -2, 3, 7, 11, 15, -8, 5)
    base = float(row["thermalRisk"])
    score = max(0, min(100, round(base + 12 + exposure_offsets[(ward_id - 1) % len(exposure_offsets)])))
    return score


def risk_band(score: int) -> str:
    if score < 35:
        return "Low"
    if score < 50:
        return "Moderate"
    if score < 65:
        return "High"
    if score < 80:
        return "Very High"
    return "Extreme"


@app.get("/predict_surge")
async def predict_surge(date: Date = Query(...), ward_id: int = Query(..., ge=1, le=58)):
    day = date.isoformat()
    matching = prototype_weather.loc[
        (prototype_weather["date"] == day) & (prototype_weather["ward_id"] == ward_id)
    ]
    if matching.empty:
        raise HTTPException(status_code=404, detail="No prototype weather record exists for this ward/date")
    if ward_id not in ward_populations.index:
        raise HTTPException(status_code=404, detail=f"Ward {ward_id} was not found in the population table")

    row = matching.loc[:, feature_names].apply(pd.to_numeric, errors="coerce")
    if row.isna().any().any():
        raise HTTPException(status_code=502, detail="Prototype weather row is missing the trained model feature")
    try:
        raw_prediction = float(model.predict(row)[0])
    except Exception as exc:
        raise HTTPException(status_code=500, detail="CatBoost inference failed") from exc
    surge_pct = max(0.0, raw_prediction)
    heatmap_score = operational_risk_score(matching.iloc[0], ward_id)
    heatmap_risk_level = risk_band(heatmap_score)
    risk_adjustment_pct = RISK_BAND_SURGE_ADJUSTMENT[heatmap_risk_level]
    aligned_surge_pct = surge_pct + risk_adjustment_pct
    population = int(ward_populations.loc[ward_id])
    baseline_admissions_per_day = population * 34.0 / 1000 / 365
    expected_increase_per_day = baseline_admissions_per_day * aligned_surge_pct / 100
    logger.info(
        "Surge estimate ward=%s date=%s temperature=%.1fC raw_pct=%.4f",
        ward_id, day, float(row.iloc[0]["temperature_daytime_mean_c"]), raw_prediction,
    )
    return {
        "ward_id": ward_id,
        "date": day,
        "hospital_surge_pct": aligned_surge_pct,
        "temperature_surge_baseline_pct": surge_pct,
        "heatmap_risk_score": heatmap_score,
        "heatmap_risk_level": heatmap_risk_level,
        "risk_band_adjustment_pct": risk_adjustment_pct,
        "estimate_type": "evidence_calibrated_proxy_not_observed_admissions",
        "expected_baseline_admissions_per_day": baseline_admissions_per_day,
        "expected_increase_per_day": expected_increase_per_day,
    }
