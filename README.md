# Flight Turbulence Map v2.0.0

Major clean rebuild. Airport search is now based on a bundled local dataset and never waits for a remote 12+ MB CSV. No ES modules are used, eliminating stale dependency-module failures. Leaflet is loaded without SRI. A deployment workflow runs syntax, core logic, asset, HTML-ID and dataset tests before publishing.

## Deploy
Delete the old repository contents, upload all contents of this folder to repository root, commit to `main`, and select GitHub Actions under Settings → Pages.

## Test locally
`npm test`

Serve with `python3 -m http.server 8000` and open the local page.

## Limitations
Experimental vertical-wind-shear proxy, not GTG/EDR and not for operational use.
