// app.js — UI wiring: airport pickers, map, chart.
(function () {
  const $ = (id) => document.getElementById(id);
  const depInput = $("dep"), arrInput = $("arr"), altInput = $("alt");
  const altValue = $("altValue"), flValue = $("flValue"), dtInput = $("dt"), goBtn = $("go");
  const statusEl = $("status"), summaryEl = $("summary");

  // --- Populate airport datalist ---
  const byLabel = {};
  const dl = $("airport-list");
  AIRPORTS.sort((a, b) => a.iata.localeCompare(b.iata)).forEach((a) => {
    const label = `${a.iata} — ${a.city} (${a.name})`;
    byLabel[label.toLowerCase()] = a;
    byLabel[a.iata.toLowerCase()] = a;
    byLabel[a.icao.toLowerCase()] = a;
    const opt = document.createElement("option");
    opt.value = label;
    dl.appendChild(opt);
  });

  function resolveAirport(text) {
    if (!text) return null;
    const t = text.trim().toLowerCase();
    if (byLabel[t]) return byLabel[t];
    // fall back: match by leading IATA code
    const code = t.split(/[\s—-]/)[0];
    return byLabel[code] || null;
  }

  // --- Altitude label (feet + flight level) ---
  function updateAltLabel() {
    const ft = +altInput.value;
    altValue.textContent = `${ft.toLocaleString()} ft`;
    flValue.textContent = `FL${Math.round(ft / 100)}`;
  }
  altInput.addEventListener("input", updateAltLabel);

  // --- Default departure time: next full hour, UTC ---
  (function initTime() {
    const now = new Date();
    now.setUTCMinutes(0, 0, 0);
    now.setUTCHours(now.getUTCHours() + 1);
    dtInput.value = now.toISOString().slice(0, 16);
  })();

  // Defaults so the demo is one click away.
  depInput.value = "JFK — New York (John F. Kennedy)";
  arrInput.value = "LHR — London (Heathrow)";

  // --- Map ---
  const map = L.map("map", { worldCopyJump: true }).setView([40, -30], 3);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    subdomains: "abcd", maxZoom: 10
  }).addTo(map);

  let routeLayers = [];
  function clearRoute() { routeLayers.forEach((l) => map.removeLayer(l)); routeLayers = []; }

  let chart = null;

  function setStatus(msg, isError) {
    statusEl.textContent = msg || "";
    statusEl.classList.toggle("error", !!isError);
  }

  async function run() {
    const dep = resolveAirport(depInput.value);
    const arr = resolveAirport(arrInput.value);
    if (!dep || !arr) { setStatus("Pick valid departure and arrival airports from the list.", true); return; }
    if (dep === arr) { setStatus("Departure and arrival must differ.", true); return; }

    goBtn.disabled = true;
    setStatus("Fetching NOAA GFS winds and computing shear…");
    try {
      const iso = dtInput.value.length === 16 ? dtInput.value : dtInput.value + ":00";
      const result = await Turbulence.computeRouteTurbulence(dep, arr, +altInput.value, iso, 40);
      drawRoute(dep, arr, result);
      drawChart(result);
      drawSummary(dep, arr, result);
      setStatus("");
    } catch (e) {
      console.error(e);
      setStatus("Could not compute turbulence: " + e.message +
        " (GFS forecasts cover ~16 days ahead; try a nearer date.)", true);
    } finally {
      goBtn.disabled = false;
    }
  }

  function drawRoute(dep, arr, result) {
    clearRoute();
    const pts = result.points;
    // Colored segments by severity.
    for (let i = 0; i < pts.length - 1; i++) {
      const seg = L.polyline(
        [[pts[i].lat, pts[i].lon], [pts[i + 1].lat, pts[i + 1].lon]],
        { color: pts[i].severity.color, weight: 5, opacity: 0.9 }
      ).addTo(map);
      routeLayers.push(seg);
    }
    const mk = (a, kind) => L.circleMarker([a.lat, a.lon], {
      radius: 6, color: "#fff", weight: 2, fillColor: "#4ea1ff", fillOpacity: 1
    }).bindTooltip(`${kind}: ${a.iata} — ${a.city}`).addTo(map);
    routeLayers.push(mk(dep, "Departure"), mk(arr, "Arrival"));
    map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lon])).pad(0.2));
  }

  function drawChart(result) {
    const pts = result.points;
    const labels = pts.map((p) => Math.round(p.distKm));
    const data = pts.map((p) => +(p.index * 100).toFixed(1));
    const colors = pts.map((p) => p.severity.color);
    if (chart) chart.destroy();
    chart = new Chart($("chart"), {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Turbulence index (0–100)",
          data,
          backgroundColor: colors,
          borderWidth: 0,
          categoryPercentage: 1.0,
          barPercentage: 1.0
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: "Distance from departure (km)", color: "#93a4bb" },
               ticks: { color: "#93a4bb", maxTicksLimit: 10 }, grid: { color: "#22314700" } },
          y: { beginAtZero: true, max: 100, title: { display: true, text: "Turbulence index", color: "#93a4bb" },
               ticks: { color: "#93a4bb" }, grid: { color: "#223147" } }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel: (ctx) => {
                const p = pts[ctx.dataIndex];
                return `${p.severity.label} · wind ${Math.round(p.windKmh)} km/h`;
              }
            }
          }
        }
      }
    });
  }

  function drawSummary(dep, arr, result) {
    const worst = result.points.reduce((a, b) => (b.index > a.index ? b : a));
    const lvl = result.levels.level;
    summaryEl.innerHTML =
      `<strong>${dep.iata} → ${arr.iata}</strong> · ${Math.round(result.meta.totalKm)} km · ` +
      `${lvl} hPa (~FL${Math.round(+altInput.value / 100)}) · valid ${result.meta.time} UTC<br>` +
      `Peak: <strong style="color:${worst.severity.color}">${worst.severity.label}</strong> ` +
      `(index ${Math.round(worst.index * 100)}) at ${Math.round(worst.distKm)} km.`;
  }

  updateAltLabel();
  goBtn.addEventListener("click", run);
  run(); // auto-run the default JFK→LHR route
})();
