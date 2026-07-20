"""
GTG/EDR backend stub — the "hybrid" upgrade path.

The static frontend ships on Open-Meteo's GFS wind-shear proxy. This optional
service is where you plug in NOAA's *real* Graphical Turbulence Guidance (GTG),
which reports turbulence directly as EDR (eddy dissipation rate) — the same
product turbli uses.

It is intentionally a stub: the route/geometry contract is wired up, but the
GRIB download + sampling is left as a TODO so you can choose your source
(NOMADS GRIB filter, AWS NODD GFS/GTG buckets, or the Aviation Weather Center).

Run:
    pip install -r requirements.txt
    uvicorn app:app --reload
    # GET http://localhost:8000/turbulence?dep_lat=40.64&dep_lon=-73.78&arr_lat=51.47&arr_lon=-0.45&alt_ft=35000

Then in js/turbulence.js set USE_BACKEND = "http://localhost:8000" and call
`${USE_BACKEND}/turbulence?...` instead of the Open-Meteo URL. The response
shape below matches what the frontend already expects (points[].index 0..1).
"""
from __future__ import annotations

import math
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="GTG Turbulence Backend (stub)")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)


def great_circle(lat1, lon1, lat2, lon2, n):
    r, d = math.radians, math.degrees
    p1, l1, p2, l2 = r(lat1), r(lon1), r(lat2), r(lon2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin((l2 - l1) / 2) ** 2
    ang = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    pts = []
    for i in range(n + 1):
        f = i / n
        A = math.sin((1 - f) * ang) / math.sin(ang)
        B = math.sin(f * ang) / math.sin(ang)
        x = A * math.cos(p1) * math.cos(l1) + B * math.cos(p2) * math.cos(l2)
        y = A * math.cos(p1) * math.sin(l1) + B * math.cos(p2) * math.sin(l2)
        z = A * math.sin(p1) + B * math.sin(p2)
        pts.append((d(math.atan2(z, math.hypot(x, y))), d(math.atan2(y, x)), f))
    return pts


def sample_gtg_edr(lat: float, lon: float, alt_ft: float) -> float:
    """TODO: return real EDR at (lat, lon, altitude) from a GTG GRIB grid.

    Suggested implementation:
      1. Fetch the latest GTG GRIB for the flight level (NOMADS grib-filter or
         the AWS NODD `noaa-gfs-bdp-pds` / GTG bucket).
      2. Decode with cfgrib/pygrib and cache the grid in memory.
      3. Bilinearly interpolate EDR at (lat, lon) for the nearest flight level.
    Return EDR in m^(2/3) s^-1 (typically ~0.0–0.7+).
    """
    raise NotImplementedError("Plug in a GTG GRIB source here — see docstring.")


@app.get("/turbulence")
def turbulence(
    dep_lat: float = Query(...), dep_lon: float = Query(...),
    arr_lat: float = Query(...), arr_lon: float = Query(...),
    alt_ft: float = Query(35000), n: int = Query(40),
):
    pts = great_circle(dep_lat, dep_lon, arr_lat, arr_lon, n)
    out = []
    for lat, lon, frac in pts:
        edr = sample_gtg_edr(lat, lon, alt_ft)   # raises until implemented
        index = max(0.0, min(1.0, edr / 0.7))    # EDR → normalized 0..1
        out.append({"lat": lat, "lon": lon, "frac": frac, "index": index, "edr": edr})
    return {"points": out, "source": "NOAA GTG"}


@app.get("/")
def health():
    return {"status": "stub — implement sample_gtg_edr()"}
