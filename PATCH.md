# Leaflet tile-overlap hotfix

The screenshot shows unstyled Leaflet tile panes escaping the map container and overlapping the Chart.js panel.

## Apply

1. Upload `css/leaflet-fix.css` to the repository.
2. In `index.html`, immediately after `<link rel="stylesheet" href="./css/style.css">`, add:

```html
<link rel="stylesheet" href="./css/leaflet-fix.css">
```

3. Replace the existing Leaflet CSS `<link>` with the official Leaflet 1.9.4 form:

```html
<link
  rel="stylesheet"
  href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
  crossorigin=""
>
```

4. Commit and push. Hard-refresh the published page (Ctrl+F5).

The local hotfix file includes the full Leaflet stylesheet through jsDelivr as a fallback and adds paint/layout containment.
