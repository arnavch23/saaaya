#!/usr/bin/env python3
"""Build locally cached Pune ward summer heat-risk data from Open-Meteo ERA5.

The script samples up to three representative points inside every 2022 Pune ward,
downloads hourly ERA5-Seamless fields in batches, and creates daily daytime
aggregates for the dashboard.  It deliberately contains no generated weather.

WBGT note: ERA5 does not provide the black-globe temperature needed for an
observed outdoor WBGT. ``wbgt`` is therefore a documented screening estimate:
wet-bulb temperature (Stull) plus a bounded solar and wind adjustment. It is
appropriate for prototype prioritisation, not occupational compliance.
"""
from __future__ import annotations

import argparse
import json
import math
import time
from urllib.error import HTTPError
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEOJSON = ROOT / "public/data/pune-electoral-wards-2022.geojson"
RAW_CACHE = ROOT / "data/real-historical/open-meteo-era5-pune-summer-hourly.json"
OUTPUT = ROOT / "src/data/puneHistoricalWardRisk.ts"
API = "https://archive-api.open-meteo.com/v1/archive"
HOURLY = "temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation"


def point_in_ring(lon: float, lat: float, ring: list[list[float]]) -> bool:
    inside = False
    for index, point in enumerate(ring):
        previous = ring[index - 1]
        if (point[1] > lat) != (previous[1] > lat):
            crossing = (previous[0] - point[0]) * (lat - point[1]) / (previous[1] - point[1]) + point[0]
            if lon < crossing:
                inside = not inside
    return inside


def point_in_polygon(lon: float, lat: float, rings: list[list[list[float]]]) -> bool:
    return bool(rings) and point_in_ring(lon, lat, rings[0]) and not any(point_in_ring(lon, lat, hole) for hole in rings[1:])


def largest_polygon(geometry: dict) -> list[list[list[float]]]:
    polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
    return max(polygons, key=lambda polygon: abs(sum(
        polygon[0][i - 1][0] * point[1] - point[0] * polygon[0][i - 1][1]
        for i, point in enumerate(polygon[0])
    )))


def samples_for_feature(feature: dict) -> list[tuple[float, float]]:
    polygon = largest_polygon(feature["geometry"])
    ring = polygon[0]
    lons, lats = [p[0] for p in ring], [p[1] for p in ring]
    min_lon, max_lon, min_lat, max_lat = min(lons), max(lons), min(lats), max(lats)
    candidates = [
        ((min_lon + max_lon) / 2, (min_lat + max_lat) / 2),
        *[(min_lon + (max_lon - min_lon) * x, min_lat + (max_lat - min_lat) * y) for x in (.2, .5, .8) for y in (.2, .5, .8)],
    ]
    accepted: list[tuple[float, float]] = []
    for lon, lat in candidates:
        if point_in_polygon(lon, lat, polygon) and all(math.hypot(lon - old_lon, lat - old_lat) > .001 for old_lon, old_lat in accepted):
            accepted.append((round(lat, 5), round(lon, 5)))
        if len(accepted) == 3:
            break
    return accepted or [(round(ring[0][1], 5), round(ring[0][0], 5))]


def fetch_batch(points: list[tuple[float, float]], start: str, end: str) -> list[dict]:
    query = urllib.parse.urlencode({
        "latitude": ",".join(str(lat) for lat, _ in points),
        "longitude": ",".join(str(lon) for _, lon in points),
        "start_date": start, "end_date": end, "hourly": HOURLY,
        "timezone": "Asia/Kolkata", "models": "era5_seamless",
    })
    request = urllib.request.Request(f"{API}?{query}", headers={"User-Agent": "SAAYA historical-risk builder/1.0"})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                payload = json.load(response)
            break
        except HTTPError as error:
            if error.code != 429 or attempt == 5:
                raise
            delay = 5 * (attempt + 1)
            print(f"Open-Meteo rate limit reached; retrying in {delay}s")
            time.sleep(delay)
    return payload if isinstance(payload, list) else [payload]


def wet_bulb_c(temp: float, humidity: float) -> float:
    # Stull (2011), valid for ordinary ambient conditions.
    return (temp * math.atan(.151977 * math.sqrt(humidity + 8.313659)) + math.atan(temp + humidity)
            - math.atan(humidity - 1.676331) + .00391838 * humidity ** 1.5 * math.atan(.023101 * humidity) - 4.686035)


def screening_wbgt(temp: float, humidity: float, wind: float, solar: float) -> float:
    tw = wet_bulb_c(temp, humidity)
    radiant_load = min(3.0, max(0.0, solar) / 300 * 3.0)
    wind_relief = min(1.2, max(0.0, wind) / 20)
    globe_proxy = temp + radiant_load - wind_relief
    return .7 * tw + .2 * globe_proxy + .1 * temp


def risk_for_wbgt(wbgt: float) -> tuple[str, int]:
    if wbgt < 26: return "Low", round(max(0, wbgt - 20) * 8)
    if wbgt < 28: return "Moderate", round(40 + (wbgt - 26) * 10)
    if wbgt < 30: return "High", round(60 + (wbgt - 28) * 10)
    if wbgt < 32: return "Very High", round(80 + (wbgt - 30) * 8)
    return "Extreme", min(100, round(96 + (wbgt - 32) * 2))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", default="2024-03-01")
    parser.add_argument("--end", default="2026-05-31")
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()
    features = json.loads(GEOJSON.read_text())["features"]
    wards = [{"id": int(f["properties"]["wardnum"]), "name": f["properties"].get("Name2") or f"Ward {f['properties']['wardnum']}", "points": samples_for_feature(f)} for f in features]
    if RAW_CACHE.exists() and not args.refresh:
        raw = json.loads(RAW_CACHE.read_text())
    else:
        samples = [(ward["id"], lat, lon) for ward in wards for lat, lon in ward["points"]]
        raw = {}
        for year in (2024, 2025, 2026):
            start, end = f"{year}-03-01", f"{year}-05-31"
            responses: list[dict] = []
            for offset in range(0, len(samples), 60):
                batch = samples[offset:offset + 60]
                print(f"Downloading {year} samples {offset + 1}-{offset + len(batch)} of {len(samples)}")
                responses.extend(fetch_batch([(lat, lon) for _, lat, lon in batch], start, end))
                time.sleep(1)
            raw[str(year)] = {"samples": samples, "responses": responses}
        RAW_CACHE.parent.mkdir(parents=True, exist_ok=True)
        RAW_CACHE.write_text(json.dumps(raw, separators=(",", ":")))

    ward_by_id = {ward["id"]: ward for ward in wards}
    rows_by_key: dict[tuple[int, str], list[tuple[float, float, float, float]]] = defaultdict(list)
    for payload in raw.values():
        for sample, response in zip(payload["samples"], payload["responses"]):
            ward_id, _, _ = sample
            hourly = response["hourly"]
            for index, timestamp in enumerate(hourly["time"]):
                hour = int(timestamp[11:13])
                if 10 <= hour <= 16:
                    values = [hourly[key][index] for key in ("temperature_2m", "relative_humidity_2m", "wind_speed_10m", "shortwave_radiation")]
                    if all(value is not None for value in values):
                        rows_by_key[(ward_id, timestamp[:10])].append(tuple(float(value) for value in values))

    result = []
    for (ward_id, date), values in sorted(rows_by_key.items(), key=lambda item: (item[0][1], item[0][0])):
        temp, humidity, wind, solar = (sum(value[i] for value in values) / len(values) for i in range(4))
        wbgt = screening_wbgt(temp, humidity, wind, solar)
        risk, score = risk_for_wbgt(wbgt)
        ward = ward_by_id[ward_id]
        lat = sum(point[0] for point in ward["points"]) / len(ward["points"])
        lon = sum(point[1] for point in ward["points"]) / len(ward["points"])
        result.append({"date": date, "time": "10:00–16:00 IST", "wardId": ward_id, "wardName": ward["name"], "latitude": round(lat, 5), "longitude": round(lon, 5), "temperature": round(temp, 1), "humidity": round(humidity), "windSpeed": round(wind, 1), "solarRadiation": round(solar), "wbgt": round(wbgt, 1), "thermalRisk": score, "riskLevel": risk})

    banner = "// Generated by scripts/build_historical_ward_risk.py from Open-Meteo ERA5-Seamless. Do not edit by hand.\n"
    OUTPUT.write_text(banner + "export const historicalWardRisk = " + json.dumps(result, separators=(",", ":")) + " as const;\n")
    print(f"Wrote {len(result):,} ward-day records to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
