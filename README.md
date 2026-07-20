# ✈️ Flight Turbulence Map

A static web app: pick a **departure** and **arrival** airport and a **cruise altitude**,
and get an estimated **turbulence profile chart** and a **color-coded route map**.

It works like [turbli.com](https://turbli.com) in spirit, but turbli has no public API, so
this app is built on the **same public NOAA data turbli itself uses** — the GFS model,
served for free (no key) by [Open-Meteo](https://open-meteo.com).

![screenshot placeholder](docs/screenshot.png)

> ⚠️ **Estimate only — not for operational flight planning.** The turbulence index here is a
> clear-air-turbulence (CAT) **proxy** computed from *vertical wind shear* in the GFS model.
> It is **not** NOAA's official Graphical Turbulence Guidance (GTG) EDR product. See
> [Accuracy & the GTG upgrade path](#accuracy--the-gtg-upgrade-path).

## How it works

1. A **great-circle** path is drawn between the two airports and sampled at 40 points.
2. Your cruise altitude is converted to a **pressure level** (e.g. FL350 → 250 hPa).
3. One batched [Open-Meteo](https://open-meteo.com/en/docs/gfs-api) request fetches GFS winds
   and geopotential heights at that level and the ones just above/below, for all 40 points.
4. At each point the **vertical wind shear** `|ΔV| / Δz` is computed and mapped to a
   normalized turbulence index (0–100) and a severity band (Calm → Severe).
5. The route is drawn on a [Leaflet](https://leafletjs.com) map (segments colored by
   severity) and the profile is plotted with [Chart.js](https://www.chartjs.org).

Everything runs in the browser — **no backend, no build step, no API key.**

## Run locally

Because browsers restrict `fetch` from `file://`, serve the folder over HTTP:

```bash
cd turbulence-map
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy to GitHub Pages

1. Create a new GitHub repo and push these files to `main`.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. The included workflow (`.github/workflows/deploy.yml`) publishes the site on every push.

Your site goes live at `https://<user>.github.io/<repo>/`.
(If you prefer, you can instead pick **Source: Deploy from a branch → `main` / root** and skip the workflow.)

## Accuracy & the GTG upgrade path

turbli uses NOAA's **GTG** (Graphical Turbulence Guidance), which reports turbulence directly
in **EDR** (eddy dissipation rate). This app approximates that from wind shear, which captures
most **clear-air turbulence** near jet streams but **not** convective (thunderstorm) or
mountain-wave turbulence.

The `backend/` folder is a stub showing where to plug in **real GTG/EDR**: a small
FastAPI service that downloads NOAA GTG GRIB files and samples EDR along the route. When it's
running, point `js/turbulence.js` at it instead of Open-Meteo (`USE_BACKEND` flag) — the rest
of the frontend is unchanged. This is the "hybrid" design: shipping on Open-Meteo today,
GTG-ready tomorrow.

## Extending the airport list

`js/airports.js` ships ~100 major world hubs. For full coverage, download the free
[OurAirports](https://ourairports.com/data/) `airports.csv`, filter to
`type in (large_airport, medium_airport)`, and convert the rows to the same
`{ iata, icao, name, city, country, lat, lon }` shape.

## Data sources & credits

- Winds / geopotential: **NOAA GFS** via [Open-Meteo](https://open-meteo.com) (CC-BY 4.0).
- Basemap: [OpenStreetMap](https://www.openstreetmap.org) / [CARTO](https://carto.com).
- Inspiration: [turbli.com](https://turbli.com) — [their data sources](https://turbli.com/sources/).

## License

MIT — see [LICENSE](LICENSE).
