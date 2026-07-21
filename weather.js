import { C } from "./config.js";

const PRESSURE_LEVELS = {
  200: [500, 400],
  240: [500, 400],
  280: [400, 300],
  300: [400, 300],
  320: [400, 300],
  340: [300, 250],
  350: [300, 250],
  360: [300, 250],
  380: [250, 200],
  400: [250, 200],
  420: [200, 150]
};

function windVector(speedKmh, directionDegrees) {
  const speedMs = Number(speedKmh) / 3.6;
  const directionRadians = Number(directionDegrees) * Math.PI / 180;

  return {
    u: -speedMs * Math.sin(directionRadians),
    v: -speedMs * Math.cos(directionRadians)
  };
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), C.TIMEOUT);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Weather HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function nearestTimeIndex(times, requestedIso) {
  const target = new Date(requestedIso).getTime();
  let bestIndex = 0;
  let bestDifference = Infinity;

  times.forEach((time, index) => {
    const current = new Date(`${time}Z`).getTime();
    const difference = Math.abs(current - target);

    if (difference < bestDifference) {
      bestDifference = difference;
      bestIndex = index;
    }
  });

  return bestIndex;
}

export function severity(index) {
  if (index < 20) return { label: "Calm", color: "#39da7d" };
  if (index < 45) return { label: "Light", color: "#f4d35e" };
  if (index < 70) return { label: "Moderate", color: "#ff9f43" };
  return { label: "Severe", color: "#ff4d68" };
}

export async function weather(points, flightLevel, requestedIso, progress) {
  const pressurePair = PRESSURE_LEVELS[flightLevel] || [300, 250];
  const lowerLevel = pressurePair[0];
  const upperLevel = pressurePair[1];

  const variables = [
    `wind_speed_${lowerLevel}hPa`,
    `wind_direction_${lowerLevel}hPa`,
    `geopotential_height_${lowerLevel}hPa`,
    `wind_speed_${upperLevel}hPa`,
    `wind_direction_${upperLevel}hPa`,
    `geopotential_height_${upperLevel}hPa`
  ];

  const output = [];
  const chunkSize = 10;
  const chunkCount = Math.ceil(points.length / chunkSize);

  for (let start = 0; start < points.length; start += chunkSize) {
    const chunkNumber = Math.floor(start / chunkSize) + 1;
    progress(`Fetching GFS batch ${chunkNumber}/${chunkCount}...`);

    const chunk = points.slice(start, start + chunkSize);
    const params = new URLSearchParams({
      latitude: chunk.map((point) => point.lat.toFixed(4)).join(","),
      longitude: chunk.map((point) => point.lon.toFixed(4)).join(","),
      hourly: variables.join(","),
      models: "gfs_seamless",
      wind_speed_unit: "kmh",
      timezone: "GMT",
      forecast_days: "7"
    });

    const data = await fetchJson(`${C.WEATHER}?${params.toString()}`);
    const responses = Array.isArray(data) ? data : [data];

    responses.forEach((response, responseIndex) => {
      const point = chunk[responseIndex];
      const hourly = response && response.hourly;

      if (!point || !hourly || !Array.isArray(hourly.time)) return;

      const timeIndex = nearestTimeIndex(hourly.time, requestedIso);
      const lowerSpeed = hourly[`wind_speed_${lowerLevel}hPa`]?.[timeIndex];
      const lowerDirection = hourly[`wind_direction_${lowerLevel}hPa`]?.[timeIndex];
      const lowerHeight = Number(hourly[`geopotential_height_${lowerLevel}hPa`]?.[timeIndex]);
      const upperSpeed = hourly[`wind_speed_${upperLevel}hPa`]?.[timeIndex];
      const upperDirection = hourly[`wind_direction_${upperLevel}hPa`]?.[timeIndex];
      const upperHeight = Number(hourly[`geopotential_height_${upperLevel}hPa`]?.[timeIndex]);

      const lowerWind = windVector(lowerSpeed, lowerDirection);
      const upperWind = windVector(upperSpeed, upperDirection);
      const verticalDistance = Math.abs(upperHeight - lowerHeight);
      const windDifference = Math.hypot(
        upperWind.u - lowerWind.u,
        upperWind.v - lowerWind.v
      );
      const shear = windDifference / verticalDistance;
      const index = Math.max(0, Math.min(100, (shear - 0.002) * 5200));

      if (!Number.isFinite(index) || !Number.isFinite(shear) || verticalDistance < 20) {
        return;
      }

      output.push({
        ...point,
        index,
        shear,
        valid: hourly.time[timeIndex]
      });
    });
  }

  if (output.length < 2) {
    throw new Error("Too few valid weather samples");
  }

  return output.sort((a, b) => a.distanceNm - b.distanceNm);
}
