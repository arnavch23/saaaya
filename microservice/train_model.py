"""Train a CatBoost surrogate on the weather rows used by the SAAYA prototype.

There are no observed hospital-admission labels in this repository. The target
is therefore an explicit evidence-calibrated proxy, not a clinical outcome.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from catboost import CatBoostRegressor

ROOT = Path(__file__).resolve().parent
FRONTEND_DATA = ROOT.parent / "frontend" / "src" / "data" / "puneHistoricalWardRisk.ts"
WARD_CSV = ROOT / "model" / "SAAYA_Ward_Populations.csv"
MODEL_PATH = ROOT / "model" / "SAAYA_Hospital_CatBoost.cbm"
TRAINING_CSV = ROOT / "data" / "SAAYA_Prototype_Weather_Training.csv"
PREDICTIONS_CSV = ROOT / "data" / "SAAYA_Prototype_Surge_Predictions.csv"
FEATURES_CSV = ROOT / "model" / "SAAYA_Hospital_Model_Features.csv"
METRICS_CSV = ROOT / "docs" / "SAAYA_Hospital_Model_Metrics.csv"
IMPORTANCE_CSV = ROOT / "docs" / "SAAYA_Hospital_Feature_Importance.csv"
IMPORTANCE_PNG = ROOT / "docs" / "SAAYA_Hospital_Feature_Importance.png"
RESPONSE_PNG = ROOT / "docs" / "SAAYA_Hospital_Response_Curve.png"
METADATA_JSON = ROOT / "model" / "SAAYA_Hospital_Model_Metadata.json"
REPORT_TXT = ROOT / "docs" / "SAAYA_Hospital_Model_Report.txt"

REFERENCE_C = 29.791666666666668
RR_PER_1C = 1.013
TARGET = "hospital_surge_pct"
FEATURES = ["temperature_daytime_mean_c"]


def load_prototype_rows() -> pd.DataFrame:
    source = FRONTEND_DATA.read_text(encoding="utf-8")
    match = re.search(r"historicalWardRisk\s*=\s*(\[.*?\])\s+as const;", source, flags=re.DOTALL)
    if not match:
        raise RuntimeError(f"Could not parse the generated prototype weather data: {FRONTEND_DATA}")
    frame = pd.DataFrame(json.loads(match.group(1)))
    needed = {"date", "wardId", "temperature"}
    if not needed.issubset(frame.columns):
        raise RuntimeError(f"Prototype data is missing required columns: {sorted(needed - set(frame.columns))}")
    frame = frame.rename(columns={"wardId": "ward_id", "temperature": FEATURES[0]})
    frame["date"] = pd.to_datetime(frame["date"], errors="raise").dt.strftime("%Y-%m-%d")
    frame["ward_id"] = pd.to_numeric(frame["ward_id"], errors="raise").astype(int)
    frame[FEATURES[0]] = pd.to_numeric(frame[FEATURES[0]], errors="raise")
    return frame.sort_values(["date", "ward_id"]).reset_index(drop=True)


def score_metrics(actual: pd.Series, predicted: np.ndarray) -> dict[str, float]:
    error = predicted - actual.to_numpy(dtype=float)
    return {
        "MAE_percentage_points": float(np.mean(np.abs(error))),
        "RMSE_percentage_points": float(np.sqrt(np.mean(error**2))),
        "R2_proxy_only": float(1 - np.sum(error**2) / np.sum((actual - actual.mean()) ** 2)),
    }


def main() -> None:
    frame = load_prototype_rows()
    wards = pd.read_csv(WARD_CSV)
    if frame["ward_id"].nunique() != 58 or set(frame["ward_id"]) != set(wards["ward_id"].astype(int)):
        raise RuntimeError("Prototype weather rows and the 58-ward population table do not align")
    temperature_delta = (frame[FEATURES[0]] - REFERENCE_C).clip(lower=0)
    # Convert the project's externally sourced RR=1.013/°C to percentage-point
    # uplift above baseline. This uses prototype daytime mean temperature as a
    # proxy for the cited daily-mean exposure; see metadata/report caveat.
    frame[TARGET] = ((RR_PER_1C**temperature_delta) - 1) * 100
    frame["target_source"] = "evidence_calibrated_proxy_not_observed_admissions"
    frame.to_csv(TRAINING_CSV, index=False, float_format="%.6f")

    unique_dates = sorted(frame["date"].unique())
    year_by_date = pd.Series(pd.to_datetime(unique_dates).year, index=unique_dates)
    train_dates = set(year_by_date[year_by_date == year_by_date.min()].index)
    valid_dates = set(year_by_date[year_by_date == sorted(year_by_date.unique())[1]].index)
    test_dates = set(year_by_date[year_by_date == year_by_date.max()].index)
    if min(train_dates) >= min(valid_dates) or min(valid_dates) >= min(test_dates):
        raise RuntimeError("Expected distinct chronologically ordered weather years for train/validation/test")

    train = frame[frame.date.isin(train_dates)]
    valid = frame[frame.date.isin(valid_dates)]
    test = frame[frame.date.isin(test_dates)]
    model = CatBoostRegressor(
        loss_function="RMSE", eval_metric="MAE", iterations=900, depth=4,
        learning_rate=0.035, l2_leaf_reg=8, random_seed=42,
        monotone_constraints={FEATURES[0]: 1}, verbose=False, allow_writing_files=False,
    )
    model.fit(
        train[FEATURES], train[TARGET],
        eval_set=(valid[FEATURES], valid[TARGET]),
        early_stopping_rounds=100, verbose=False,
    )
    model.save_model(str(MODEL_PATH), format="cbm")

    validation_metrics = score_metrics(valid[TARGET], model.predict(valid[FEATURES]))
    test_predictions = np.maximum(0, model.predict(test[FEATURES]))
    test_metrics = score_metrics(test[TARGET], test_predictions)
    target_summary = frame[TARGET].describe(percentiles=[.1, .25, .5, .75, .9, .95, .99]).to_dict()
    train_predictions = np.maximum(0, model.predict(frame[FEATURES]))
    frame["hospital_surge_pct"] = train_predictions
    frame["model_status"] = "CATBOOST_EVIDENCE_CALIBRATED_SURROGATE"
    frame.to_csv(PREDICTIONS_CSV, index=False, float_format="%.6f")
    pd.DataFrame([{"split": "validation_2025", **validation_metrics}, {"split": "test_2026", **test_metrics}]).to_csv(METRICS_CSV, index=False, float_format="%.8f")
    pd.DataFrame({"feature": FEATURES, "importance": model.get_feature_importance()}).to_csv(IMPORTANCE_CSV, index=False, float_format="%.6f")
    pd.DataFrame({"feature": FEATURES}).to_csv(FEATURES_CSV, index=False)
    importance = pd.read_csv(IMPORTANCE_CSV)
    fig, ax = plt.subplots(figsize=(7, 3.5))
    ax.barh(importance["feature"], importance["importance"], color="#a85d43")
    ax.set_xlabel("CatBoost feature importance")
    ax.set_title("Prototype weather surrogate · proxy only")
    fig.tight_layout()
    fig.savefig(IMPORTANCE_PNG, dpi=160)
    plt.close(fig)
    grid = pd.DataFrame({FEATURES[0]: np.linspace(frame[FEATURES[0]].min(), frame[FEATURES[0]].max(), 120)})
    curve = np.maximum(0, model.predict(grid))
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.plot(grid[FEATURES[0]], curve, color="#a85d43", linewidth=2)
    ax.axvline(REFERENCE_C, color="#596b7b", linestyle="--", label=f"Reference {REFERENCE_C:.2f}°C")
    ax.set(xlabel="Prototype daytime mean temperature (°C)", ylabel="Estimated uplift (percentage points)", title="CatBoost response · evidence-calibrated proxy only")
    ax.legend()
    fig.tight_layout()
    fig.savefig(RESPONSE_PNG, dpi=160)
    plt.close(fig)

    prediction_summary = pd.Series(train_predictions).describe(percentiles=[.1, .25, .5, .75, .9, .95, .99]).to_dict()
    metadata = {
        "project": "SAAYA / Ushna-Tapasani",
        "model_name": "Prototype Weather Heat-Associated Demand Surrogate",
        "model_type": "CatBoost approximation of an evidence-calibrated proxy; not trained on observed admissions",
        "training_data": {
            "source_file": "frontend/src/data/puneHistoricalWardRisk.ts",
            "export_file": str(TRAINING_CSV.relative_to(ROOT)).replace("\\", "/"),
            "rows": int(len(frame)), "ward_count": int(frame.ward_id.nunique()),
            "date_start": str(frame.date.min()), "date_end": str(frame.date.max()),
            "weather_fields": "ERA5-Seamless ward-level daytime aggregates, 10:00-16:00 IST",
        },
        "target": {
            "name": TARGET,
            "units": "percentage points above expected baseline",
            "classification": "evidence_calibrated_proxy_not_observed_admissions",
            "definition": "max(0, ((1.013 ** max(temperature_daytime_mean_c - reference_c, 0)) - 1) * 100)",
            "temperature_reference_c": REFERENCE_C,
            "relative_risk_per_1c": RR_PER_1C,
            "source_assumption": "Project metadata's externally sourced, non-Pune-specific all-cause hospitalization association; applying a daily-mean coefficient to the prototype's 10:00-16:00 temperature is an unvalidated proxy assumption.",
            "observed_hospital_admission_labels_available": False,
            "target_distribution": {k: float(v) for k, v in target_summary.items()},
        },
        "feature_names": FEATURES,
        "excluded_features_and_reasons": {
            "ward_id": "No observed ward-specific outcome labels to estimate ward effects.",
            "population": "A percentage uplift does not scale with population; use population only for absolute baseline demand calculations.",
            "heatwave_duration_and_severity": "Prototype source has daytime mean temperature, not validated daily maximum/observed outcomes; no evidence-supported independent heatwave effect is available.",
            "elderly_pct": "Not present in the supplied ward data.",
        },
        "validation": {
            "method": "Chronological by full calendar year: train 2024, validation 2025, held-out proxy test 2026.",
            "validation_metrics": validation_metrics,
            "test_metrics": test_metrics,
            "metrics_interpretation": "Measures approximation of the constructed proxy only; does not establish hospital-demand or clinical predictive accuracy.",
        },
        "prediction_summary_proxy_only": {k: float(v) for k, v in prediction_summary.items()},
        "catboost": {"best_iteration": int(model.best_iteration_), "random_seed": 42, "monotonic_constraint": {FEATURES[0]: 1}},
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
    }
    METADATA_JSON.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    REPORT_TXT.write_text(
        "SAAYA PROTOTYPE WEATHER SURGE SURROGATE\n"
        "========================================\n\n"
        "STATUS\n------\n"
        "Retrained from the frontend's 2024-2026 ERA5-Seamless prototype weather rows.\n"
        "This is an evidence-calibrated proxy, not a model trained on hospital admissions.\n\n"
        "DATA\n----\n"
        f"Rows: {len(frame)} ({frame.ward_id.nunique()} wards; {frame.date.nunique()} dates)\n"
        f"Coverage: {frame.date.min()} through {frame.date.max()}\n"
        "Source: frontend/src/data/puneHistoricalWardRisk.ts\n"
        "Inputs match the prototype daily daytime temperature field (10:00-16:00 IST).\n\n"
        "TARGET\n------\n"
        "Evidence-calibrated percentage-point uplift = max(0, (1.013^max(T - 29.7917, 0) - 1) * 100).\n"
        "The RR coefficient is external and not Pune-specific. Applying a daily-mean coefficient\n"
        "to daytime-mean temperature is an unvalidated proxy assumption. No target range was forced.\n\n"
        "VALIDATION\n----------\n"
        "Chronological holdout: train 2024, validate 2025, test 2026.\n"
        f"Validation proxy metrics: {json.dumps(validation_metrics, sort_keys=True)}\n"
        f"Test proxy metrics: {json.dumps(test_metrics, sort_keys=True)}\n"
        "These scores measure proxy approximation only, not clinical accuracy.\n\n"
        "LIMITATIONS\n-----------\n"
        "No real ward-level admissions, elderly shares, or hospital-capacity data are present.\n"
        "Heatwave effects are not independently learned or added without outcome evidence.\n"
        "Real hospital admissions linked to daily ward weather are required for supervised clinical validation.\n",
        encoding="utf-8",
    )
    print(f"Trained on {len(train):,} rows; validation {len(valid):,}; test {len(test):,}.")
    print(f"Proxy target median/max: {frame[TARGET].median():.2f}/{frame[TARGET].max():.2f} percentage points.")
    print(f"Held-out 2026 proxy metrics: {test_metrics}")
    print(f"Retrained model written: {MODEL_PATH}")


if __name__ == "__main__":
    main()
