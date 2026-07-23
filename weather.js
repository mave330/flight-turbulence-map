import { C } from "./config.js";

const LEVELS = {
  200:[500,400], 240:[500,400], 280:[400,300], 300:[400,300],
  320:[400,300], 340:[300,250], 350:[300,250], 360:[300,250],
  380:[250,200], 400:[250,200], 420:[200,150]
};

function vector(speedKmh, directionDeg) {
  const speed = Number(speedKmh) / 3.6;
  const direction = Number(directionDeg) * Math.PI / 180;
  return { u: -speed * Math.sin(direction), v: -speed * Math.cos(direction) };
}

function nearestIndex(times, requestedIso) {
  const target = new Date(requestedIso).getTime();
  let best = 0;
  let difference = Infinity;
  times.forEach((time, index) => {
    const current = Math.abs(new Date(`${time}Z`).getTime() - target);
    if (current < difference) { difference = current; best = index; }
  });
  return best;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), C.TIMEOUT);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`Weather HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export function severity(index) {
  if (index < 20) return { label:"Calm", color:"#39da7d" };
  if (index < 45) return { label:"Light", color:"#f4d35e" };
  if (index < 70) return { label:"Moderate", color:"#ff9f43" };
  return { label:"Severe", color:"#ff4d68" };
}

export async function weather(points, flightLevel, requestedIso, progress) {
  const [lower, upper] = LEVELS[flightLevel] || [300,250];
  const variables = [
    `wind_speed_${lower}hPa`, `wind_direction_${lower}hPa`, `geopotential_height_${lower}hPa`,
    `wind_speed_${upper}hPa`, `wind_direction_${upper}hPa`, `geopotential_height_${upper}hPa`
  ];
  const output = [];
  const chunkSize = 10;
  for (let start = 0; start < points.length; start += chunkSize) {
    const chunk = points.slice(start, start + chunkSize);
    progress(`Fetching GFS batch ${Math.floor(start/chunkSize)+1}/${Math.ceil(points.length/chunkSize)}...`);
    const params = new URLSearchParams({
      latitude: chunk.map(p => p.lat.toFixed(4)).join(","),
      longitude: chunk.map(p => p.lon.toFixed(4)).join(","),
      hourly: variables.join(","), models:"gfs_seamless", wind_speed_unit:"kmh",
      timezone:"GMT", forecast_days:"7"
    });
    const data = await fetchJson(`${C.WEATHER}?${params}`);
    const responses = Array.isArray(data) ? data : [data];
    responses.forEach((response, index) => {
      const point = chunk[index];
      const hourly = response?.hourly;
      if (!point || !Array.isArray(hourly?.time)) return;
      const i = nearestIndex(hourly.time, requestedIso);
      const lowWind = vector(hourly[`wind_speed_${lower}hPa`]?.[i], hourly[`wind_direction_${lower}hPa`]?.[i]);
      const highWind = vector(hourly[`wind_speed_${upper}hPa`]?.[i], hourly[`wind_direction_${upper}hPa`]?.[i]);
      const lowHeight = Number(hourly[`geopotential_height_${lower}hPa`]?.[i]);
      const highHeight = Number(hourly[`geopotential_height_${upper}hPa`]?.[i]);
      const dz = Math.abs(highHeight - lowHeight);
      const shear = Math.hypot(highWind.u-lowWind.u, highWind.v-lowWind.v) / dz;
      const turbulenceIndex = Math.max(0, Math.min(100, (shear - 0.002) * 5200));
      if (dz >= 20 && Number.isFinite(shear) && Number.isFinite(turbulenceIndex)) {
        output.push({ ...point, index:turbulenceIndex, shear, valid:hourly.time[i] });
      }
    });
  }
  if (output.length < 2) throw new Error("Too few valid weather samples");
  return output.sort((a,b) => a.distanceNm - b.distanceNm);
}
