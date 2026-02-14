// BIKE v1.1 - velocidad robusta por distancia/tiempo (iPhone friendly)

let watchId = null;
let armed = false;
let running = false;
let startTime = null;
let timerInterval = null;

let bestTime = localStorage.getItem("pb");
bestTime = bestTime ? parseFloat(bestTime) : null;

const speedEl = document.getElementById("speed");
const timeEl = document.getElementById("time");
const pbEl = document.getElementById("pb");
const armBtn = document.getElementById("armBtn");

pbEl.textContent = bestTime ? bestTime.toFixed(2) : "--";

armBtn.addEventListener("click", () => {
  armed = !armed;
  armBtn.textContent = armed ? "DESARMAR" : "ARMAR";

  // Si desarmas, detén el timer (por seguridad)
  if (!armed && running) stopTimer();
});

// --- util: Haversine para distancia en metros ---
function toRad(x) { return (x * Math.PI) / 180; }

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // metros
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// --- Timer ---
function startTimer() {
  running = true;
  startTime = Date.now();
  timerInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    timeEl.textContent = elapsed.toFixed(2);
  }, 50);
}

function stopTimer() {
  running = false;
  clearInterval(timerInterval);

  const finalTime = parseFloat(timeEl.textContent);
  if (!bestTime || finalTime < bestTime) {
    bestTime = finalTime;
    localStorage.setItem("pb", String(bestTime));
    pbEl.textContent = bestTime.toFixed(2);
  }
}

// --- Velocidad robusta (promedio suavizado) ---
let lastPos = null;
let lastT = null;
let speedKmhSmoothed = 0;

const START_KMH = 6.0; // umbral de inicio (ajustable)
const STOP_KMH = 1.5;  // umbral de parada (ajustable)
const MIN_DT = 0.7;    // mínimo segundos entre muestras útiles

function onPosition(position) {
  const { latitude, longitude, accuracy } = position.coords;
  const t = position.timestamp ? position.timestamp : Date.now();

  // Filtra lecturas muy malas (bosque puede dar alta accuracy)
  // Igual lo dejamos flexible: solo avisamos internamente si es enorme.
  // Si quieres, después mostramos warning en UI.
  const accOk = (accuracy == null) ? true : accuracy < 80;

  let speedKmh = null;

  // Intentar speed nativa si viene
  if (position.coords.speed != null && !Number.isNaN(position.coords.speed)) {
    speedKmh = position.coords.speed * 3.6;
  }

  // Si no hay speed nativa, la calculamos
  if (speedKmh == null && lastPos && lastT) {
    const dt = (t - lastT) / 1000;
    if (dt >= MIN_DT) {
      const d = haversineMeters(lastPos.lat, lastPos.lon, latitude, longitude);
      speedKmh = (d / dt) * 3.6;
    }
  }

  // Actualiza last
  lastPos = { lat: latitude, lon: longitude };
  lastT = t;

  // Si aún no hay speed, mostramos lo que tengamos
  if (speedKmh == null) {
    speedEl.textContent = "—";
    return;
  }

  // Suavizado simple para evitar saltos
  speedKmhSmoothed = 0.7 * speedKmhSmoothed + 0.3 * speedKmh;
  const shown = Math.max(0, speedKmhSmoothed);

  speedEl.textContent = shown.toFixed(1) + " km/h";

  // Lógica de arranque/parada
  if (armed && !running) {
    // Para evitar que arranque con ruido, pedimos umbral y opcionalmente buena accuracy
    if (shown >= START_KMH && accOk) startTimer();
    // Si accuracy no es buena, igual podría arrancar; si quieres, quito accOk.
    if (shown >= START_KMH && !accOk) startTimer();
  }

  if (running) {
    // Parada cuando baja de umbral por un ratito
    if (shown <= STOP_KMH) {
      stopTimer();
    }
  }
}

function onError(err) {
  console.warn("GPS error:", err);
}

// Iniciar tracking
if ("geolocation" in navigator) {
  watchId = navigator.geolocation.watchPosition(onPosition, onError, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 10000,
  });
}

// Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");

}


