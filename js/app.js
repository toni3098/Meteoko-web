/* =========================================================
   Meteoria – connexion à WeatherAPI
   ========================================================= */

const API_KEY = "58f79eb35f854af9b8f160241262110";
const API_URL = "https://api.weatherapi.com/v1/forecast.json";
const DEFAULT_QUERY = "auto:ip"; // ville déduite de l'adresse IP du visiteur
const STORAGE_KEY = "meteoria:lastCity";

// ---------- Éléments du DOM ----------
const $ = (id) => document.getElementById(id);

const form = $("searchForm");
const input = $("cityInput");
const statusEl = $("status");
const card = $("currentWeather");
const forecastList = $("forecastList");
const forecastTitle = $("forecastTitle");

// ---------- Messages d'erreur de l'API ----------
const API_ERRORS = {
  1002: "Clé API manquante.",
  1003: "Veuillez saisir le nom d'une ville.",
  1006: "Ville introuvable. Vérifiez l'orthographe ou essayez une autre ville.",
  2006: "Clé API invalide.",
  2007: "Limite mensuelle de requêtes dépassée.",
  2008: "Cette clé API a été désactivée.",
  2009: "Cette clé API n'a pas accès à cette fonctionnalité.",
};

// ---------- Utilitaires ----------
function setStatus(message = "") {
  statusEl.textContent = message;
}

function setLoading(isLoading) {
  card.classList.toggle("is-loading", isLoading);
  forecastList.classList.toggle("is-loading", isLoading);
  form.querySelector("button").disabled = isLoading;
}

const round = (n) => Math.round(n);

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDateTime(localtime) {
  // "2026-10-21 14:30" -> "Mercredi 21 octobre, 14:30"
  const date = new Date(localtime.replace(" ", "T"));
  const day = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  const time = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return `${capitalize(day)}, ${time}`;
}

function formatWeekday(dateString, index) {
  if (index === 0) return "Auj.";
  const date = new Date(`${dateString}T12:00:00`);
  return capitalize(new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(date));
}

function iconUrl(path, size = 128) {
  // L'API renvoie "//cdn.weatherapi.com/weather/64x64/day/116.png"
  return `https:${path}`.replace("64x64", `${size}x${size}`);
}

function makeIcon(path, alt, size) {
  const img = document.createElement("img");
  img.src = iconUrl(path, size);
  img.alt = alt;
  img.width = size;
  img.height = size;
  return img;
}

// ---------- Appel API ----------
async function fetchWeather(query) {
  const params = new URLSearchParams({
    key: API_KEY,
    q: query,
    days: 5,
    lang: "fr",
    aqi: "no",
    alerts: "no",
  });

  let response;
  try {
    response = await fetch(`${API_URL}?${params}`);
  } catch {
    throw new Error("Connexion impossible. Vérifiez votre accès à internet.");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const code = data?.error?.code;
    throw new Error(API_ERRORS[code] || data?.error?.message || "Une erreur est survenue.");
  }
  return data;
}

// ---------- Affichage ----------
function renderCurrent(data) {
  const { location, current, forecast } = data;
  const today = forecast.forecastday[0].day;

  $("cityName").textContent = `${location.name}, ${location.country}`;
  $("cityDate").textContent = formatDateTime(location.localtime);

  const iconBox = $("currentIcon");
  iconBox.replaceChildren(makeIcon(current.condition.icon, current.condition.text, 128));

  $("currentTemp").textContent = round(current.temp_c);
  $("currentDesc").textContent = current.condition.text;
  $("tempMax").textContent = `${round(today.maxtemp_c)}°`;
  $("tempMin").textContent = `${round(today.mintemp_c)}°`;
  $("feelsLike").textContent = `${round(current.feelslike_c)}°`;

  $("humidity").textContent = `${current.humidity}%`;
  $("wind").textContent = `${round(current.wind_kph)} km/h`;
  $("pressure").textContent = `${round(current.pressure_mb)} hPa`;
  $("uv").textContent = round(current.uv);
  $("visibility").textContent = `${current.vis_km} km`;
  $("clouds").textContent = `${current.cloud}%`;
}

function renderForecast(days) {
  forecastTitle.textContent = `Prévisions sur ${days.length} jour${days.length > 1 ? "s" : ""}`;

  const cards = days.map((entry, index) => {
    const article = document.createElement("article");
    article.className = "day glass";

    const name = document.createElement("p");
    name.className = "day__name";
    name.textContent = formatWeekday(entry.date, index);

    const icon = document.createElement("p");
    icon.className = "day__icon";
    icon.append(makeIcon(entry.day.condition.icon, entry.day.condition.text, 64));

    const temp = document.createElement("p");
    temp.className = "day__temp";
    const max = document.createElement("strong");
    max.textContent = `${round(entry.day.maxtemp_c)}°`;
    const min = document.createElement("span");
    min.className = "muted";
    min.textContent = ` ${round(entry.day.mintemp_c)}°`;
    temp.append(max, min);

    article.append(name, icon, temp);
    return article;
  });

  forecastList.replaceChildren(...cards);
}

// ---------- Chargement d'une ville ----------
async function loadCity(query) {
  setStatus("");
  setLoading(true);
  try {
    const data = await fetchWeather(query);
    renderCurrent(data);
    renderForecast(data.forecast.forecastday);

    if (query !== DEFAULT_QUERY) {
      try { localStorage.setItem(STORAGE_KEY, query); } catch { /* stockage indisponible */ }
    }
  } catch (error) {
    setStatus(error.message);
  } finally {
    setLoading(false);
  }
}

// ---------- Événements ----------
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const city = input.value.trim();
  if (!city) {
    setStatus("Veuillez saisir le nom d'une ville.");
    return;
  }
  loadCity(city);
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    input.value = chip.dataset.city;
    loadCity(chip.dataset.city);
  });
});

// ---------- Démarrage ----------
(function init() {
  let saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* ignoré */ }
  loadCity(saved || DEFAULT_QUERY);
})();