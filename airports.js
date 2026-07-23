import { C } from "./config.js";
import { norm, esc } from "./utils.js";

// The UI starts immediately with this local list. The worldwide database is
// downloaded in the background and replaces it when ready.
const STARTER_AIRPORTS = [
  ["CDG", "LFPG", "Charles de Gaulle International Airport", "Paris", "FR", 49.0097, 2.5479],
  ["ORY", "LFPO", "Paris Orly Airport", "Paris", "FR", 48.7262, 2.3652],
  ["LYS", "LFLL", "Lyon Saint-Exupery Airport", "Lyon", "FR", 45.7256, 5.0811],
  ["NCE", "LFMN", "Nice Cote d'Azur Airport", "Nice", "FR", 43.6584, 7.2159],
  ["MRS", "LFML", "Marseille Provence Airport", "Marseille", "FR", 43.4393, 5.2214],
  ["TLS", "LFBO", "Toulouse Blagnac Airport", "Toulouse", "FR", 43.6291, 1.3638],
  ["LHR", "EGLL", "London Heathrow Airport", "London", "GB", 51.4700, -0.4543],
  ["AMS", "EHAM", "Amsterdam Airport Schiphol", "Amsterdam", "NL", 52.3105, 4.7683],
  ["FRA", "EDDF", "Frankfurt Airport", "Frankfurt", "DE", 50.0379, 8.5622],
  ["MAD", "LEMD", "Adolfo Suarez Madrid-Barajas Airport", "Madrid", "ES", 40.4983, -3.5676],
  ["JFK", "KJFK", "John F. Kennedy International Airport", "New York", "US", 40.6413, -73.7781],
  ["EWR", "KEWR", "Newark Liberty International Airport", "Newark", "US", 40.6895, -74.1745],
  ["LAX", "KLAX", "Los Angeles International Airport", "Los Angeles", "US", 33.9416, -118.4085],
  ["SFO", "KSFO", "San Francisco International Airport", "San Francisco", "US", 37.6213, -122.3790],
  ["ATL", "KATL", "Hartsfield-Jackson Atlanta International Airport", "Atlanta", "US", 33.6407, -84.4277],
  ["YUL", "CYUL", "Montreal-Trudeau International Airport", "Montreal", "CA", 45.4706, -73.7408],
  ["DXB", "OMDB", "Dubai International Airport", "Dubai", "AE", 25.2532, 55.3657],
  ["SIN", "WSSS", "Singapore Changi Airport", "Singapore", "SG", 1.3644, 103.9915],
  ["HND", "RJTT", "Tokyo Haneda Airport", "Tokyo", "JP", 35.5494, 139.7798],
  ["SYD", "YSSY", "Sydney Kingsford Smith Airport", "Sydney", "AU", -33.9399, 151.1753]
].map(([iata, icao, name, city, country, lat, lon]) => ({
  iata, icao, name, city, country, lat, lon,
  scheduled: true,
  type: "large_airport"
}));

function enrich(airports) {
  return airports.map((airport, id) => ({
    ...airport,
    id: `${airport.icao || airport.iata}-${id}`,
    search: norm(`${airport.iata} ${airport.icao} ${airport.name} ${airport.city} ${airport.country}`)
  }));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function shapeCsv(text) {
  const rows = parseCsv(text);
  const header = rows.shift();
  if (!header) throw new Error("Airport CSV is empty");

  const column = Object.fromEntries(header.map((name, index) => [name, index]));

  return rows.map((row) => ({
    iata: (row[column.iata_code] || "").toUpperCase(),
    icao: (row[column.icao_code] || row[column.gps_code] || row[column.ident] || "").toUpperCase(),
    name: row[column.name] || "Unknown airport",
    city: row[column.municipality] || "",
    country: row[column.iso_country] || "",
    lat: Number(row[column.latitude_deg]),
    lon: Number(row[column.longitude_deg]),
    scheduled: row[column.scheduled_service] === "yes",
    type: row[column.type] || ""
  })).filter((airport) =>
    Number.isFinite(airport.lat) &&
    Number.isFinite(airport.lon) &&
    (airport.iata || airport.icao) &&
    !["closed", "heliport", "seaplane_base", "balloonport"].includes(airport.type)
  );
}

function readCache() {
  try {
    const raw = localStorage.getItem("airports-progressive-v2");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 1000 ? parsed : null;
  } catch (error) {
    console.warn("Airport cache ignored", error);
    try { localStorage.removeItem("airports-progressive-v2"); } catch {}
    return null;
  }
}

function writeCache(airports) {
  try {
    localStorage.setItem("airports-progressive-v2", JSON.stringify(airports));
  } catch (error) {
    console.warn("Airport cache unavailable", error);
  }
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`Airport data HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns an immediately usable airport array. If no full cache exists, the
 * local starter list is returned while the worldwide list loads in background.
 */
export function loadAirportsProgressively(onStatus, onWorldwideReady) {
  const cached = readCache();
  if (cached) {
    onStatus(`${cached.length.toLocaleString()} airports ready`);
    return enrich(cached);
  }

  const starter = enrich(STARTER_AIRPORTS);
  onStatus(`${starter.length} airports ready; worldwide list loading in background`);

  void (async () => {
    try {
      const text = await fetchWithTimeout(C.AIRPORTS, 15000);
      onStatus("Worldwide airport file downloaded; indexing...");

      // Yield to the browser before parsing the large CSV so the UI can paint.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const worldwide = shapeCsv(text);
      if (worldwide.length < 1000) throw new Error("Worldwide airport list is unexpectedly small");

      writeCache(worldwide);
      const indexed = enrich(worldwide);
      onWorldwideReady(indexed);
      onStatus(`${indexed.length.toLocaleString()} airports ready`);
    } catch (error) {
      console.warn("Worldwide airport list unavailable; starter list remains active", error);
      onStatus(`${starter.length} starter airports ready; worldwide list unavailable`);
    }
  })();

  return starter;
}

function search(index, query, limit = 30) {
  const normalized = norm(query);
  if (!normalized) return index.filter((airport) => airport.scheduled && airport.iata).slice(0, limit);

  const tokens = normalized.split(" ");
  return index
    .filter((airport) => tokens.every((token) => airport.search.includes(token)))
    .map((airport) => {
      let score = 0;
      if (airport.iata.toLowerCase() === normalized) score -= 100;
      if (airport.icao.toLowerCase() === normalized) score -= 90;
      if (airport.iata.toLowerCase().startsWith(normalized)) score -= 40;
      if (airport.icao.toLowerCase().startsWith(normalized)) score -= 35;
      if (airport.scheduled) score -= 10;
      if (airport.type === "large_airport") score -= 5;
      return { airport, score };
    })
    .sort((a, b) => a.score - b.score || a.airport.name.localeCompare(b.airport.name))
    .slice(0, limit)
    .map(({ airport }) => airport);
}

export function createPicker(input, box, label, initialData, onPick) {
  let data = initialData;
  let current = [];
  let selected = null;

  const close = () => { box.hidden = true; };
  const choose = (airport) => {
    if (!airport) return;
    selected = airport;
    input.value = airport.iata || airport.icao;
    label.textContent = `${airport.name} • ${airport.city || airport.country} • ${airport.icao}`;
    close();
    onPick(airport);
  };
  const render = () => {
    current = search(data, input.value);
    box.innerHTML = current.length
      ? current.map((airport, index) => `<button type="button" class="result" data-index="${index}"><b>${esc(airport.iata || airport.icao)}</b>${esc(airport.name)}<small>${esc([airport.city, airport.country, airport.icao].filter(Boolean).join(" • "))}</small></button>`).join("")
      : '<div class="result">No matching airport</div>';
    box.hidden = false;
  };

  input.addEventListener("focus", render);
  input.addEventListener("input", () => {
    selected = null;
    label.textContent = "No airport selected";
    onPick(null);
    render();
  });
  box.addEventListener("mousedown", (event) => {
    const button = event.target.closest("[data-index]");
    if (button) choose(current[Number(button.dataset.index)]);
  });
  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".picker")) close();
  });

  return {
    set: choose,
    setData(nextData) { data = nextData; },
    getSelected() { return selected; }
  };
}
