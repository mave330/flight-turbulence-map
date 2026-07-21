# Definitive map display repair

This patch does not rely on the external Leaflet stylesheet. It fixes the map twice:

1. Critical Leaflet layout rules are embedded directly inside `index.html`.
2. `js/leaflet-repair.js` applies the required positioning as inline `!important` styles and watches newly created tiles with a `MutationObserver`.

## Apply exactly

1. Upload `js/leaflet-repair.js` to your repository's existing `js` folder.
2. Open `index.html`.
3. Delete all existing Leaflet CSS links, old `leaflet-fix.css` / `leaflet-critical.css` links, and the existing Leaflet/Chart/app script tags.
4. Paste the complete content of `HEAD_REPLACEMENT.html` in their place, still inside `<head>`.
5. Commit to `main` and ensure GitHub Pages deploys that commit.
6. Open the deployed page with `?build=20260721-3` appended once to bypass HTML cache.

## Verification in browser console

Run:

```js
getComputedStyle(document.querySelector('.leaflet-tile')).position
```

Expected result:

```text
absolute
```

Also run:

```js
window.__repairLeafletMap()
```

The function should exist and return without an error. If it is undefined, the newly uploaded JavaScript is not the version served by GitHub Pages.
