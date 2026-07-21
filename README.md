# Flight Turbulence Map — updated edition

A static, responsive web app that estimates a **clear-air-turbulence proxy** along a great-circle route.

## Improvements in this version

- Worldwide airport search loaded from the public OurAirports CSV.
- Fast indexed filtering: only the best 30 results are rendered, never thousands of `<option>` elements.
- Offline fallback airport list and browser cache.
- Stable Leaflet sizing and route-layer cleanup.
- Chart.js instance cleanup, explicit canvas height and invalid-sample filtering.
- Batched, timed Open-Meteo requests with visible errors.
- Responsive layout and accessible controls.
- Forecast-time selector and route summary.

## Deploy to GitHub Pages

1. Replace the contents of your repository with the contents of this folder.
2. Commit and push to the `main` branch.
3. In repository **Settings → Pages**, choose **GitHub Actions** as the source.
4. The included workflow deploys the static site.

No build command is required.

## Run locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Data and limitations

- Airport list: OurAirports public-domain/open data.
- Forecast: NOAA GFS pressure-level variables through Open-Meteo.
- Map: Leaflet and OpenStreetMap.
- Graph: Chart.js.

The displayed 0–100 value is a heuristic proxy derived from vertical wind shear. It is **not** GTG/EDR and must not be used for operational flight planning. Convective, mountain-wave, wake and low-level turbulence are not represented.

## Troubleshooting

Open browser developer tools (`F12`) and check **Console** and **Network**. The UI now surfaces timeout, HTTP and insufficient-sample errors. If the full airport file cannot be reached, a small fallback list is used automatically.
