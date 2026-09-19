"""
ARAVINDHA — Real-data landslide dataset builder (Option A).

Turns NASA COOLR landslide catalog points (South Asia / India subset) into a
supervised learning dataset:

  labels     : 1 = landslide recorded (COOLR), 0 = sampled non-event location
  features   : rain_1d, rain_3d, rain_7d, rain_15d, rain_max_7d   (antecedent rainfall, mm)
               elevation_m, slope_deg                             (Copernicus DEM via Open-Meteo)
               month_sin, month_cos                               (seasonality)
  rain source: NASA POWER daily precipitation (satellite-era, no API key, no
               hourly quota) — a 16-day window fetched per point, antecedent
               windows computed locally. Legacy Open-Meteo batch path retained
               in cache but unused.
  terrain    : Open-Meteo Elevation API — 5 samples/point (center + 4 offsets
               100 m away) → slope via central differences.

Resume-safe: every API response is cached under ml-service/data/.cache/.
Output: ml-service/data/landslide_dataset.csv + build_report.json
"""

import csv
import json
import math
import os
import random
import sys
import threading
import time
import zlib
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict
from datetime import date, datetime, timedelta

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
DATA_DIR = os.path.join(ROOT, "ml-service", "data")
CACHE_DIR = os.path.join(DATA_DIR, ".cache")
RAW_CSV = os.path.join(DATA_DIR, "coolr_raw.csv")
OUT_CSV = os.path.join(DATA_DIR, "landslide_dataset.csv")
REPORT = os.path.join(DATA_DIR, "build_report.json")

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"   # legacy path (quota-limited)
ELEV_URL = "https://api.open-meteo.com/v1/elevation"
POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"  # rain source (no quota wall)

# India + Himalaya + NE + Western Ghats bounding box
BBOX = {"lat_min": 6.5, "lat_max": 36.5, "lon_min": 68.0, "lon_max": 97.5}
YEAR_MIN, YEAR_MAX = 2007, 2024          # COOLR coverage
NEG_PER_POS = 2.0                        # negatives sampled per positive
MIN_NEG_DIST_DEG = 0.10                  # ~11 km from any cataloged landslide
THROTTLE_S = 0.8                        # be gentle — per-minute quotas exist
MAX_RETRY = int(os.environ.get("MAX_RETRY", "10"))   # patient through rate-limit windows
#   MAX_RETRY=2 env override = "fast pass": cached batches are reused instantly and
#   any quota/network-blocked batch is abandoned quickly, letting the POWER-elevation
#   + KNN-slope rescue fill those points instead of stalling the whole build.

os.makedirs(CACHE_DIR, exist_ok=True)
random.seed(42)
SESSION = requests.Session()
SESSION.headers["User-Agent"] = "aravindha-dataset-builder/1.0"


def cache_get(key):
    p = os.path.join(CACHE_DIR, key + ".json")
    if os.path.exists(p):
        try:
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None
    return None


def cache_put(key, obj):
    p = os.path.join(CACHE_DIR, key + ".json")
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f)
    os.replace(tmp, p)


def throttled_get(url, params, throttle=None, retries=None):
    throttle = THROTTLE_S if throttle is None else throttle
    retries = MAX_RETRY if retries is None else retries
    for attempt in range(retries):
        try:
            r = SESSION.get(url, params=params, timeout=(10, 45))
            if r.status_code == 200:
                time.sleep(throttle)
                return r.json()
            if r.status_code in (429, 503):     # rate limited — back off
                time.sleep(min(20 * (attempt + 1), 90))
                continue
            print(f"    HTTP {r.status_code}, retrying...", flush=True)
        except Exception as e:
            print(f"    net error ({type(e).__name__}), retrying...", flush=True)
        time.sleep(3 * (attempt + 1))
    return None


# ----------------------------------------------------------------------------
# 1. Load COOLR positives
# ----------------------------------------------------------------------------
def load_catalog():
    if not os.path.exists(RAW_CSV):
        print("FATAL: ml-service/data/coolr_raw.csv not found. Run scripts/fetch_coolr.sh first.")
        sys.exit(1)
    positives, bad = [], 0
    with open(RAW_CSV, "r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                lat = float(row.get("latitude") or row.get("Latitude") or "")
                lon = float(row.get("longitude") or row.get("Longitude") or "")
            except (TypeError, ValueError):
                bad += 1
                continue
            if not (BBOX["lat_min"] <= lat <= BBOX["lat_max"]
                    and BBOX["lon_min"] <= lon <= BBOX["lon_max"]):
                continue
            d = (row.get("event_date") or row.get("Event Date") or "").strip()
            dt = None
            for fmt in ("%m/%d/%Y %I:%M:%S %p", "%m/%d/%Y %H:%M:%S",
                        "%m-%d-%Y %H:%M", "%m/%d/%Y", "%m-%d-%Y"):
                try:
                    dt = datetime.strptime(d, fmt).date()
                    break
                except ValueError:
                    continue
            if dt is None:
                bad += 1
                continue
            if not (YEAR_MIN <= dt.year <= YEAR_MAX):
                continue
            positives.append({"lat": lat, "lon": lon, "date": dt})
    # de-dup near-identical points
    seen, uniq = set(), []
    for p in positives:
        k = (round(p["lat"], 2), round(p["lon"], 2), p["date"])
        if k in seen:
            continue
        seen.add(k)
        uniq.append(p)
    print(f"Catalog: {len(uniq)} India-region events ({bad} rows skipped, global total read).")
    return uniq


# ----------------------------------------------------------------------------
# 2. Negative sampling (distance-filtered)
# ----------------------------------------------------------------------------
def sample_negatives(positives):
    # uniform-grid hash for proximity rejection
    grid = defaultdict(list)
    for p in positives:
        grid[(int(p["lat"] / MIN_NEG_DIST_DEG), int(p["lon"] / MIN_NEG_DIST_DEG))].append(p)

    def too_close(lat, lon):
        gx, gy = int(lat / MIN_NEG_DIST_DEG), int(lon / MIN_NEG_DIST_DEG)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for q in grid.get((gx + dx, gy + dy), []):
                    if abs(q["lat"] - lat) < MIN_NEG_DIST_DEG and abs(q["lon"] - lon) < MIN_NEG_DIST_DEG:
                        return True
        return False

    n_neg = int(len(positives) * NEG_PER_POS)
    negatives, attempts = [], 0
    while len(negatives) < n_neg and attempts < n_neg * 30:
        attempts += 1
        lat = random.uniform(BBOX["lat_min"], BBOX["lat_max"])
        lon = random.uniform(BBOX["lon_min"], BBOX["lon_max"])
        if too_close(lat, lon):
            continue
        # random date across the same coverage window (monsoon-weighted)
        month = random.choices(range(1, 13), weights=[1, 1, 1, 2, 3, 4, 5, 5, 4, 2, 1, 1])[0]
        day = random.randint(1, 28)
        year = random.randint(YEAR_MIN, YEAR_MAX - 1)
        negatives.append({"lat": round(lat, 4), "lon": round(lon, 4),
                          "date": date(year, month, day)})
    print(f"Negatives: {len(negatives)} sampled (>11 km from any catalog event).")
    return negatives


# ----------------------------------------------------------------------------
# 3. Rainfall features — NASA POWER daily precipitation (per-point, parallel)
# ----------------------------------------------------------------------------
_RAIN_WINDOW = 16                      # 15 antecedent days + the event day
_WORKERS = 2                           # POWER dislikes bursts; 2 workers, steady pace
_THROTTLE_POWER = 0.6
_local = threading.local()


def _power_session():
    if not hasattr(_local, "s"):
        s = requests.Session()
        s.headers["User-Agent"] = "aravindha-dataset-builder/1.0"
        _local.s = s
    return _local.s


def _rain_for_point(i, p):
    """Antecedent rainfall features for one point from NASA POWER."""
    end = p["date"]
    start = end - timedelta(days=_RAIN_WINDOW - 1)
    key = "pow_" + str(zlib.crc32(json.dumps(
        [round(p["lat"], 3), round(p["lon"], 3),
         start.isoformat(), end.isoformat()], sort_keys=True).encode()) & 0xFFFFFFFF)
    data = cache_get(key)
    if data is None:
        data = throttled_get(
            POWER_URL,
            {"parameters": "PRECTOTCORR", "community": "AG",
             "latitude": f"{p['lat']:.3f}", "longitude": f"{p['lon']:.3f}",
             "start": start.strftime("%Y%m%d"), "end": end.strftime("%Y%m%d"),
             "format": "JSON"},
            throttle=_THROTTLE_POWER, retries=5)
        if data is not None:
            cache_put(key, data)
    if not isinstance(data, dict):
        return i, None
    try:
        pr_map = data["properties"]["parameter"]["PRECTOTCORR"]
    except (KeyError, TypeError):
        return i, None
    vals = []
    for d in range(_RAIN_WINDOW):
        day = start + timedelta(days=d)
        v = pr_map.get(day.isoformat()) or pr_map.get(day.strftime("%Y%m%d"))
        if v is not None and v >= 0:          # -999 = missing fill
            vals.append(float(v))
    if not vals:
        return i, None
    def cum(n):
        return round(sum(vals[-n:]), 2)
    return i, {
        "rain_1d": cum(1), "rain_3d": cum(3), "rain_7d": cum(7),
        "rain_15d": cum(15), "rain_max_7d": round(max(vals[-7:]), 2),
    }


def _om_year_pass(points, out):
    """Pass 1: Open-Meteo year-batched archive calls (56 calls total when the
    hourly quota allows; ~80 batches already banked in cache). Appends resolved
    features to `out`, returns indices still unresolved."""
    # Fast quota probe: one tiny call. If the hourly quota is closed, bail out
    # instantly instead of burning backoff sleeps — POWER mops up instead.
    probe = throttled_get(ARCHIVE_URL, {
        "latitude": "25.3", "longitude": "91.6",
        "start_date": "2009-07-01", "end_date": "2009-07-02",
        "daily": "precipitation_sum", "timezone": "UTC",
    }, throttle=0, retries=1)
    if probe is None:
        print("  rain: open-meteo quota closed — using POWER for everything", flush=True)
        return list(range(len(points)))
    by_year = defaultdict(list)
    for i, p in enumerate(points):
        by_year[p["date"].year].append(i)
    for year, idxs in sorted(by_year.items()):
        for bstart in range(0, len(idxs), 100):
            batch = idxs[bstart:bstart + 100]
            lats = ",".join(f"{points[i]['lat']:.4f}" for i in batch)
            lons = ",".join(f"{points[i]['lon']:.4f}" for i in batch)
            key = f"rain_{year}_{bstart}_{zlib.crc32(lats.encode()) % 99991}"
            data = cache_get(key)
            if data is None:
                data = throttled_get(ARCHIVE_URL, {
                    "latitude": lats, "longitude": lons,
                    "start_date": f"{year}-01-01", "end_date": f"{year}-12-31",
                    "daily": "precipitation_sum", "timezone": "UTC",
                })
                if data is not None:
                    cache_put(key, data)
            if data is None:
                continue                      # quota window closed — POWER will mop up
            results = data if isinstance(data, list) else [data]
            for j, i in enumerate(batch):
                if j >= len(results):
                    continue
                daily = results[j].get("daily", {})
                times = daily.get("time", [])
                pr = daily.get("precipitation_sum", [])
                ev_date = points[i]["date"]
                try:
                    pos = times.index(ev_date.isoformat())
                except ValueError:
                    continue
                def cum(days_back):
                    lo = max(0, pos - days_back + 1)
                    vals = [v for v in pr[lo:pos + 1] if v is not None]
                    return round(sum(vals), 2)
                mx = [v for v in pr[max(0, pos - 6):pos + 1] if v is not None]
                out[i] = {
                    "rain_1d": cum(1), "rain_3d": cum(3), "rain_7d": cum(7),
                    "rain_15d": cum(15), "rain_max_7d": round(max(mx), 2) if mx else 0.0,
                }
    return [i for i in range(len(points)) if i not in out]


def rain_features_for(points):
    """Hybrid antecedent-rainfall fetch:
      pass 1 — Open-Meteo year batches (cheap, cached; skips silently when quota is out)
      pass 2 — NASA POWER per-point 16-day windows for whatever pass 1 missed
    Both sources are real observations; every response is cached."""
    out = {}
    unresolved = _om_year_pass(points, out)
    print(f"  rain: open-meteo resolved {len(points) - len(unresolved)}/{len(points)}; power mopping up {len(unresolved)}...", flush=True)
    if unresolved:
        done = 0
        with ThreadPoolExecutor(max_workers=_WORKERS) as ex:
            for i, feat in ex.map(lambda ip: _rain_for_point(*ip),
                                  [(i, points[i]) for i in unresolved]):
                done += 1
                if done % 250 == 0:
                    print(f"  rain: power {done}/{len(unresolved)}...", flush=True)
                if feat is not None:
                    out[i] = feat
    return out


# ----------------------------------------------------------------------------
# 4. Terrain features — elevation + slope (5 samples/point, 100 coords/call)
# ----------------------------------------------------------------------------
def _pow_elev_for_point(p):
    """Exact-match elevation: recompute the point's POWER cache key (the same
    formula _rain_for_point used) and read the site elevation from its own
    response geometry — no coordinate matching, guaranteed hit if cached."""
    end = p["date"]
    start = end - timedelta(days=_RAIN_WINDOW - 1)
    key = "pow_" + str(zlib.crc32(json.dumps(
        [round(p["lat"], 3), round(p["lon"], 3),
         start.isoformat(), end.isoformat()], sort_keys=True).encode()) & 0xFFFFFFFF)
    data = cache_get(key)
    if isinstance(data, dict):
        g = data.get("geometry", {}).get("coordinates", [])
        if len(g) >= 3 and float(g[2]) > -1000:
            return float(g[2])
    return None


def _harvest_power_elevations():
    """Free center elevations: every cached POWER response carries the site
    elevation as the 3rd geometry coordinate. Returns {(lat3, lon3): elev_m}."""
    out = {}
    for name in os.listdir(CACHE_DIR):
        if not name.startswith("pow_"):
            continue
        try:
            with open(os.path.join(CACHE_DIR, name), encoding="utf-8") as f:
                d = json.load(f)
            g = d.get("geometry", {}).get("coordinates", [])
            if len(g) >= 3:
                out[(round(g[1], 3), round(g[0], 3))] = float(g[2])
        except Exception:
            continue
    return out


def _slope_from_neighbors(i, c_elev, elev_known, points):
    """Slope (deg) via least-squares plane fit over the nearest points with
    known elevation (KNN gradient, 100 m baseline when real DEM samples exist,
    up to ~250 km regional baseline when only POWER site elevations are known,
    so dense-event regions keep a fine 100 m DEM slope and sparse regions still
    get a real (if coarse) terrain gradient instead of being dropped)."""
    try:
        import numpy as np
        from scipy.spatial import cKDTree
    except ImportError:
        return None
    known_idx = [j for j in elev_known if j != i]
    if len(known_idx) < 6:
        return None
    lat0 = math.radians(points[i]["lat"])
    coords = []
    for j in known_idx:                      # use the full known-elevation cloud
        dy = (points[j]["lat"] - points[i]["lat"]) * 111_320.0
        dx = (points[j]["lon"] - points[i]["lon"]) * 111_320.0 * math.cos(lat0)
        coords.append((dx, dy))
    tree = cKDTree(coords)
    k = min(8, len(coords))
    dist, idx = tree.query([0.0, 0.0], k=k)
    if dist[-1] == 0 or dist[-1] > 250_000:     # no neighbours within 250 km
        return None
    sel = [known_idx[idx[t]] for t in range(k)]
    A = [[coords[idx[t]][0], coords[idx[t]][1], 1.0] for t in range(k)]
    b = [elev_known[j] for j in sel]
    try:
        (a, bb, _), *_ = np.linalg.lstsq(np.array(A), np.array(b), rcond=None)
    except Exception:
        return None
    return round(math.degrees(math.atan(math.hypot(a, bb))), 2)


def terrain_features_for(points):
    dlat = 100.0 / 111_320.0                      # ~100 m in degrees latitude
    tasks = []                                    # (point_idx, which, lat, lon)
    for i, p in enumerate(points):
        dlon = 100.0 / (111_320.0 * max(0.2, math.cos(math.radians(p["lat"]))))
        tasks.append((i, "c", p["lat"], p["lon"]))
        tasks.append((i, "n", p["lat"] + dlat, p["lon"]))
        tasks.append((i, "s", p["lat"] - dlat, p["lon"]))
        tasks.append((i, "e", p["lat"], p["lon"] + dlon))
        tasks.append((i, "w", p["lat"], p["lon"] - dlon))

    elev = {}
    total_calls = -(-len(tasks) // 100)
    skip_fetch = os.environ.get("OM_ELEV_DISABLED") == "1"
    for c, bstart in enumerate(range(0, len(tasks), 100) if not skip_fetch else []):
        batch = tasks[bstart:bstart + 100]
        key = f"elev_{bstart}_{len(batch)}_{zlib.crc32(','.join(f'{t[2]:.4f},{t[3]:.4f}' for t in batch).encode()) % 99991}"
        data = cache_get(key)
        if data is None:
            if c % 10 == 0:
                print(f"  elevation: call {c + 1}/{total_calls}...", flush=True)
            data = throttled_get(ELEV_URL, {
                "latitude": ",".join(f"{t[2]:.5f}" for t in batch),
                "longitude": ",".join(f"{t[3]:.5f}" for t in batch),
            })
            if data is not None:
                cache_put(key, data)
        if data is None:
            continue
        for j, t in enumerate(batch):
            if j < len(data.get("elevation", [])):
                elev[(t[0], t[1])] = data["elevation"][j]

    out = {}
    for i, p in enumerate(points):
        c = elev.get((i, "c"))
        n, s, e, w = (elev.get((i, k)) for k in "nsew")
        if c is not None and None not in (n, s, e, w):
            dlat = 100.0 / 111_320.0
            dlon = 100.0 / (111_320.0 * max(0.2, math.cos(math.radians(p["lat"]))))
            dzdx = (e - w) / (2 * dlon * 111_320.0 * math.cos(math.radians(p["lat"])))
            dzdy = (n - s) / (2 * dlat * 111_320.0)
            slope = math.degrees(math.atan(math.hypot(dzdx, dzdy)))
            out[i] = {"elevation_m": round(c, 1), "slope_deg": round(slope, 2)}

    # Quota-blocked rescue: harvest free POWER site elevations, then derive the
    # remaining slopes as KNN gradients over the known-elevation cloud.
    missing = [i for i in range(len(points)) if i not in out]
    if missing:
        pow_elev = _harvest_power_elevations()
        elev_known = {}
        for i in range(len(points)):
            if i in out:
                elev_known[i] = out[i]["elevation_m"]
                continue
            v = _pow_elev_for_point(points[i])          # exact key match first
            if v is None:
                v = pow_elev.get((round(points[i]["lat"], 3), round(points[i]["lon"], 3)))
            if v is not None:
                elev_known[i] = v
        rescued = 0
        for i in missing:
            c = elev_known.get(i)
            if c is None:
                continue
            slope = _slope_from_neighbors(i, c, elev_known, points)
            if slope is not None:
                out[i] = {"elevation_m": round(c, 1), "slope_deg": slope}
                rescued += 1
        if rescued:
            print(f"  terrain: rescued {rescued}/{len(missing)} quota-blocked points "
                  f"via POWER elevations + KNN slope", flush=True)
    return out


# ----------------------------------------------------------------------------
def main():
    t0 = time.time()
    positives = load_catalog()
    if len(positives) < 60:
        print("Too few positives to train on — check the catalog file.")
        sys.exit(1)
    negatives = sample_negatives(positives)
    points = positives + negatives

    print(f"Fetching antecedent rainfall for {len(points)} points (year-batched)...")
    rain = rain_features_for(points)
    print(f"  rain features resolved for {len(rain)}/{len(points)} points")

    print(f"Fetching elevation+slope for {len(points)} points...")
    terrain = terrain_features_for(points)
    print(f"  terrain features resolved for {len(terrain)}/{len(points)} points")

    rows, skipped = [], 0
    for i, p in enumerate(points):
        r, t = rain.get(i), terrain.get(i)
        if not r or not t:
            skipped += 1
            continue
        rows.append({
            "label": 1 if i < len(positives) else 0,
            "lat": p["lat"], "lon": p["lon"], "event_date": p["date"].isoformat(),
            **r, **t,
            "month_sin": round(math.sin(2 * math.pi * p["date"].month / 12), 4),
            "month_cos": round(math.cos(2 * math.pi * p["date"].month / 12), 4),
        })

    fields = ["label", "lat", "lon", "event_date", "rain_1d", "rain_3d", "rain_7d",
              "rain_15d", "rain_max_7d", "elevation_m", "slope_deg",
              "month_sin", "month_cos"]
    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        wcsv = csv.DictWriter(f, fieldnames=fields)
        wcsv.writeheader()
        wcsv.writerows(rows)

    n_pos = sum(r["label"] for r in rows)
    report = {
        "built_at": datetime.utcnow().isoformat() + "Z",
        "positives": n_pos, "negatives": len(rows) - n_pos,
        "skipped_no_features": skipped,
        "elapsed_s": round(time.time() - t0, 1),
        "bbox": BBOX, "years": [YEAR_MIN, YEAR_MAX],
    }
    with open(REPORT, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(json.dumps(report, indent=2))
    print(f"WROTE {OUT_CSV} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
