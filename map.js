import { severity } from "./weather.js";

let map;
let routeLayer;
let tileLayer;

/*
 * Self-contained Leaflet geometry.
 * This is injected by map.js itself, so it cannot be skipped because of a
 * missing <link>, a bad SRI hash, stylesheet order, or GitHub Pages cache.
 */
const LEAFLET_GEOMETRY = `
#map{position:relative!important;overflow:hidden!important;isolation:isolate!important;contain:layout paint!important;width:100%!important;z-index:0!important}
#map .leaflet-pane,#map .leaflet-tile,#map .leaflet-marker-icon,#map .leaflet-marker-shadow,#map .leaflet-tile-container,#map .leaflet-pane>svg,#map .leaflet-pane>canvas,#map .leaflet-image-layer,#map .leaflet-layer{position:absolute!important;left:0!important;top:0!important}
#map .leaflet-container{overflow:hidden!important}
#map img.leaflet-tile{position:absolute!important;width:256px!important;height:256px!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;display:block!important}
#map .leaflet-pane{z-index:400!important}#map .leaflet-tile-pane{z-index:200!important}#map .leaflet-overlay-pane{z-index:400!important}#map .leaflet-shadow-pane{z-index:500!important}#map .leaflet-marker-pane{z-index:600!important}#map .leaflet-tooltip-pane{z-index:650!important}#map .leaflet-popup-pane{z-index:700!important}
#map .leaflet-control{position:relative!important;z-index:800!important;pointer-events:auto!important}#map .leaflet-top,#map .leaflet-bottom{position:absolute!important;z-index:1000!important;pointer-events:none!important}#map .leaflet-top{top:0!important}#map .leaflet-right{right:0!important}#map .leaflet-bottom{bottom:0!important}#map .leaflet-left{left:0!important}
`;

function installGeometry() {
  let style = document.getElementById("leaflet-geometry-from-map-js");
  if (!style) {
    style = document.createElement("style");
    style.id = "leaflet-geometry-from-map-js";
    style.textContent = LEAFLET_GEOMETRY;
    document.head.appendChild(style);
  }
}

function hardenElement(el) {
  if (!el) return;
  el.style.setProperty("position", "absolute", "important");
  el.style.setProperty("left", "0", "important");
  el.style.setProperty("top", "0", "important");
}

function hardenTile(tile) {
  hardenElement(tile);
  tile.style.setProperty("width", "256px", "important");
  tile.style.setProperty("height", "256px", "important");
  tile.style.setProperty("max-width", "none", "important");
  tile.style.setProperty("max-height", "none", "important");
  tile.style.setProperty("margin", "0", "important");
  tile.style.setProperty("padding", "0", "important");
  tile.style.setProperty("display", "block", "important");
}

function hardenMapDom() {
  const host = document.getElementById("map");
  if (!host) return;
  host.style.setProperty("position", "relative", "important");
  host.style.setProperty("overflow", "hidden", "important");
  host.style.setProperty("isolation", "isolate", "important");
  host.style.setProperty("contain", "layout paint", "important");
  host.querySelectorAll(".leaflet-pane,.leaflet-tile-container,.leaflet-layer,.leaflet-marker-icon,.leaflet-marker-shadow,.leaflet-image-layer").forEach(hardenElement);
  host.querySelectorAll("img.leaflet-tile").forEach(hardenTile);
}

export function initMap() {
  installGeometry();

  const host = document.getElementById("map");
  if (!host) throw new Error("Map container #map was not found");
  host.style.cssText += ";position:relative!important;overflow:hidden!important;isolation:isolate!important;contain:layout paint!important";

  map = L.map(host, {
    worldCopyJump: true,
    zoomControl: true,
    preferCanvas: true
  }).setView([25, 0], 2);

  tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    tileSize: 256,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });

  // The tile itself is repaired at creation/load time, not afterwards.
  tileLayer.on("tileloadstart tileload", (event) => hardenTile(event.tile));
  tileLayer.addTo(map);

  routeLayer = L.layerGroup().addTo(map);

  const observer = new MutationObserver(hardenMapDom);
  observer.observe(host, { childList: true, subtree: true });

  hardenMapDom();
  requestAnimationFrame(() => {
    hardenMapDom();
    map.invalidateSize(false);
  });

  return map;
}

export function drawRoute(samples, dep, arr) {
  if (!map || !routeLayer) throw new Error("Map is not initialized");
  routeLayer.clearLayers();

  for (let i = 0; i < samples.length - 1; i += 1) {
    const a = samples[i];
    const b = samples[i + 1];
    const meanIndex = (a.index + b.index) / 2;
    L.polyline([[a.lat, a.lon], [b.lat, b.lon]], {
      color: severity(meanIndex).color,
      weight: 6,
      opacity: 0.9
    })
      .bindTooltip(`${Math.round(a.distanceNm)} NM • ${severity(a.index).label} • ${a.index.toFixed(0)}/100`)
      .addTo(routeLayer);
  }

  L.circleMarker([dep.lat, dep.lon], {
    radius: 7, color: "#fff", weight: 2, fillColor: "#42d4c3", fillOpacity: 1
  }).bindPopup(`<b>${dep.iata || dep.icao}</b><br>${dep.name}`).addTo(routeLayer);

  L.circleMarker([arr.lat, arr.lon], {
    radius: 7, color: "#fff", weight: 2, fillColor: "#4fa4ff", fillOpacity: 1
  }).bindPopup(`<b>${arr.iata || arr.icao}</b><br>${arr.name}`).addTo(routeLayer);

  const bounds = L.latLngBounds(samples.map((p) => [p.lat, p.lon]));
  map.fitBounds(bounds, { padding: [28, 28], maxZoom: 7, animate: false });

  hardenMapDom();
  requestAnimationFrame(() => {
    hardenMapDom();
    map.invalidateSize(false);
  });
}
