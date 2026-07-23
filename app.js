import { C } from "./config.js";
import { loadAirportsProgressively, createPicker } from "./airports.js";
import { route, distance } from "./utils.js";
import { weather } from "./weather.js";
import { initMap, draw } from "./map.js";
import { plot } from "./chart.js";

const $ = (id) => document.getElementById(id);
let departure = null;
let arrival = null;
let departurePicker;
let arrivalPicker;
let busy = false;

function updateButton() {
  $("analyse").disabled = busy || !departure || !arrival || departure.id === arrival.id;
}

function setStatus(text, isError = false) {
  $("status").textContent = text;
  $("status").className = `status${isError ? " error" : ""}`;
}

function buildForecastTimes() {
  const start = new Date();
  start.setUTCMinutes(0, 0, 0);
  for (let hours = 0; hours <= 144; hours += 3) {
    const date = new Date(start.getTime() + hours * 3600000);
    const option = document.createElement("option");
    option.value = date.toISOString();
    option.textContent = `${date.toLocaleString(undefined, {
      weekday: "short", day: "2-digit", month: "short", hour: "2-digit",
      minute: "2-digit", timeZone: "UTC", hour12: false
    })} UTC`;
    $("time").appendChild(option);
  }
}

async function analyseRoute() {
  if (!departure || !arrival || busy) return;
  busy = true;
  updateButton();

  try {
    const flightLevel = Number($("fl").value.slice(2));
    const points = route(departure, arrival, C.SAMPLES);
    const samples = await weather(points, flightLevel, $("time").value, setStatus);
    draw(samples, departure, arrival);
    plot(samples);

    const values = samples.map((sample) => sample.index);
    $("distance").textContent = `${Math.round(distance(departure, arrival)).toLocaleString()} NM`;
    $("mean").textContent = `${(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(0)}/100`;
    $("maximum").textContent = `${Math.max(...values).toFixed(0)}/100`;
    $("valid").textContent = `${samples.length}/${C.SAMPLES}`;
    setStatus(`Forecast rendered for ${samples[0].valid} UTC at FL${flightLevel}. Experimental estimate only.`);
  } catch (error) {
    console.error(error);
    setStatus(error.name === "AbortError" ? "Request timed out" : error.message, true);
  } finally {
    busy = false;
    updateButton();
  }
}

function initializeAirportPickers(initialAirports) {
  departurePicker = createPicker(
    $("depInput"), $("depResults"), $("depSelected"), initialAirports,
    (airport) => { departure = airport; updateButton(); }
  );
  arrivalPicker = createPicker(
    $("arrInput"), $("arrResults"), $("arrSelected"), initialAirports,
    (airport) => { arrival = airport; updateButton(); }
  );

  const cdg = initialAirports.find((airport) => airport.iata === "CDG");
  const jfk = initialAirports.find((airport) => airport.iata === "JFK");
  if (cdg) departurePicker.set(cdg);
  if (jfk) arrivalPicker.set(jfk);
}

function init() {
  try {
    buildForecastTimes();
    initMap();

    const initialAirports = loadAirportsProgressively(
      (text) => { $("airportStatus").textContent = text; },
      (worldwideAirports) => {
        departurePicker?.setData(worldwideAirports);
        arrivalPicker?.setData(worldwideAirports);
      }
    );

    initializeAirportPickers(initialAirports);
    $("analyse").addEventListener("click", analyseRoute);
    $("swap").addEventListener("click", () => {
      const oldDeparture = departurePicker.getSelected();
      const oldArrival = arrivalPicker.getSelected();
      if (oldArrival) departurePicker.set(oldArrival);
      if (oldDeparture) arrivalPicker.set(oldDeparture);
    });

    setStatus("The starter airport list is ready. The worldwide list loads in the background.");
    updateButton();
  } catch (error) {
    console.error("Application initialization failed", error);
    $("airportStatus").textContent = "Airport initialization failed";
    setStatus(error.message || "Application initialization failed", true);
  }
}

window.addEventListener("DOMContentLoaded", init, { once: true });
