// turbulence.js
// Computes an along-route turbulence profile from Open-Meteo's GFS pressure-level
// data (winds + geopotential heights). This is a clear-air-turbulence (CAT) PROXY
// derived from vertical wind shear — NOT NOAA's official GTG/EDR product that
// turbli uses. See README for the accuracy caveat and the GTG backend path.

const OpenMeteoLevels = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300, 250, 200, 150, 100, 70, 50, 30];

// Severity bands for the normalized turbulence index (0..1).
const SeverityBands = [
  { min: 0.00, label: "Calm",     color: "#2ecc71" },
  { min: 0.20, label: "Light",    color: "#c6e34d" },
  { min: 0.40, label: "Moderate", color: "#f4b731" },
  { min: 0.60, label: "Strong",   color: "#e8663b" },
  { min: 0.80, label: "Severe",   color: "#b5179e" }
];

function severityFor(index) {
  let band = SeverityBands[0];
  for (const b of SeverityBands) if (index >= b.min) band = b;
  return band;
}

// --- Geometry: great-circle interpolation between two lat/lon points ---
function toRad(d) { return d * Math.PI / 180; }
function toDeg(r) { return r * 180 / Math.PI; }

function greatCirclePoints(lat1, lon1, lat2, lon2, n) {
  const φ1 = toRad(lat1), λ1 = toRad(lon1);
  const φ2 = toRad(lat2), λ2 = toRad(lon2);
  const dφ = φ2 - φ1, dλ = λ2 - λ1;
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  const δ = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); // angular distance
  const pts = [];
  if (δ === 0) return [{ lat: lat1, lon: lon1, frac: 0 }];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * δ) / Math.sin(δ);
    const B = Math.sin(f * δ) / Math.sin(δ);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    const φ = Math.atan2(z, Math.sqrt(x * x + y * y));
    const λ = Math.atan2(y, x);
    pts.push({ lat: toDeg(φ), lon: toDeg(λ), frac: f });
  }
  return pts;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dφ = toRad(lat2 - lat1), dλ = toRad(lon2 - lon1);
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Altitude → pressure level selection ---
// ISA barometric approximation (troposphere + lower stratosphere is fine here).
function altitudeFtToHpa(ft) {
  const m = ft * 0.3048;
  if (m < 11000) return 1013.25 * Math.pow(1 - 2.25577e-5 * m, 5.25588);
  // above tropopause (~11 km): isothermal layer
  const p11 = 226.32;
  return p11 * Math.exp(-(m - 11000) / 6341.6);
}

function nearestLevel(hpa) {
  return OpenMeteoLevels.reduce((a, b) => Math.abs(b - hpa) < Math.abs(a - hpa) ? b : a);
}

// Returns { level, above, below } — neighbouring pressure levels used for shear.
function shearLevels(altitudeFt) {
  const hpa = altitudeFtToHpa(altitudeFt);
  const level = nearestLevel(hpa);
  const idx = OpenMeteoLevels.indexOf(level);
  const above = OpenMeteoLevels[Math.min(idx + 1, OpenMeteoLevels.length - 1)]; // lower hPa = higher altitude
  const below = OpenMeteoLevels[Math.max(idx - 1, 0)];
  return { level, above, below };
}

// Convert wind speed (km/h) + direction (deg, meteorological) to u/v components (m/s).
function windUV(speedKmh, dirDeg) {
  const s = speedKmh / 3.6;
  const r = toRad(dirDeg);
  // meteorological: direction wind comes FROM
  return { u: -s * Math.sin(r), v: -s * Math.cos(r) };
}

// Map vertical wind shear (per second) to a normalized 0..1 turbulence index.
// Empirical mapping tuned to GFS-derived CAT: ~0.005/s light, ~0.03/s severe.
function shearToIndex(vws) {
  return Math.max(0, Math.min(1, vws / 0.03));
}

// --- Main: fetch + compute the route turbulence profile ---
// Returns { points:[{lat,lon,distKm,index,severity,windKmh,vws}], levels, meta }
async function computeRouteTurbulence(dep, arr, altitudeFt, isoDateTime, nSamples = 40) {
  const path = greatCirclePoints(dep.lat, dep.lon, arr.lat, arr.lon, nSamples);
  const { level, above, below } = shearLevels(altitudeFt);

  const lats = path.map(p => p.lat.toFixed(4)).join(",");
  const lons = path.map(p => p.lon.toFixed(4)).join(",");
  const date = isoDateTime.slice(0, 10);

  const vars = [
    `wind_speed_${level}hPa`, `wind_direction_${level}hPa`,
    `wind_speed_${above}hPa`, `wind_direction_${above}hPa`,
    `wind_speed_${below}hPa`, `wind_direction_${below}hPa`,
    `geopotential_height_${above}hPa`, `geopotential_height_${below}hPa`
  ];

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
    `&hourly=${vars.join(",")}&models=gfs_seamless&start_date=${date}&end_date=${date}` +
    `&windspeed_unit=kmh&timezone=UTC`;

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Open-Meteo request failed (${resp.status})`);
  let data = await resp.json();
  const locs = Array.isArray(data) ? data : [data]; // multi vs single location shape

  // Find the hour index matching the requested time.
  const targetHour = isoDateTime.slice(0, 13); // "YYYY-MM-DDTHH"
  const times = locs[0].hourly.time;
  let hIdx = times.findIndex(t => t.startsWith(targetHour));
  if (hIdx < 0) hIdx = 0;

  let cumDist = 0;
  const points = path.map((p, i) => {
    const h = locs[i].hourly;
    const wDir = h[`wind_direction_${level}hPa`][hIdx];
    const wSpd = h[`wind_speed_${level}hPa`][hIdx];
    const uA = windUV(h[`wind_speed_${above}hPa`][hIdx], h[`wind_direction_${above}hPa`][hIdx]);
    const uB = windUV(h[`wind_speed_${below}hPa`][hIdx], h[`wind_direction_${below}hPa`][hIdx]);
    const zA = h[`geopotential_height_${above}hPa`][hIdx];
    const zB = h[`geopotential_height_${below}hPa`][hIdx];
    const dz = Math.abs(zA - zB) || 1;
    const dV = Math.hypot(uA.u - uB.u, uA.v - uB.v);
    const vws = dV / dz; // per second
    const index = shearToIndex(vws);

    if (i > 0) cumDist += haversineKm(path[i - 1].lat, path[i - 1].lon, p.lat, p.lon);
    return {
      lat: p.lat, lon: p.lon, distKm: cumDist, frac: p.frac,
      index, vws, windKmh: wSpd, severity: severityFor(index)
    };
  });

  return {
    points,
    levels: { level, above, below },
    meta: {
      time: times[hIdx],
      totalKm: cumDist,
      maxIndex: Math.max(...points.map(p => p.index))
    }
  };
}

window.Turbulence = {
  computeRouteTurbulence, greatCirclePoints, severityFor, SeverityBands,
  altitudeFtToHpa, shearLevels, haversineKm
};
