# Flight Turbulence Map — clean build

Clean static build for GitHub Pages. The Leaflet CSS and JS links intentionally have **no `integrity` attribute**, because the previous invalid SRI value caused the browser to block `leaflet.css`.

## Upload
Delete the old repository contents, then upload the contents of this folder so `index.html` is at repository root. Set GitHub Pages source to **GitHub Actions**.

## Validation
In DevTools Network, `leaflet.css` must return HTTP 200 and must not show `blocked: integrity`. In Console:
`getComputedStyle(document.querySelector('.leaflet-tile')).position` must return `absolute`.

Experimental only; not for operational flight planning.
