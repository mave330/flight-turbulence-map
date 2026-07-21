# Display bug fix v2

The previous patch positioned `.leaflet-pane`, but did not position `.leaflet-tile` and `.leaflet-tile-container`. The screenshot proves that the tile images are still participating in normal document flow. This local critical stylesheet includes all positioning and overflow rules required to keep tiles inside `#map` even if the CDN stylesheet is rejected or blocked.

Upload `css/leaflet-critical.css`, then apply `index-head-replacement.txt` exactly.
