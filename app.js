// BIKE v2.1 — START/FIN por zonas GPS + Calibración de ruta (DH serio base)
// - Auto start al entrar a START
// - Auto stop al entrar a FIN
// - Modo CALIBRAR: graba la ruta (puntos GPS) entre START y FIN
// - PB guardado en localStorage
// - Velocidad solo informativa (calculada por distancia/tiempo)

let watchId = null;

let armed = false;
let running = false;
let startTime = null;
let timerInterval = null;

let isCalibrating = false;
let calibrationRoute = []; // puntos {lat, lon, t, acc?}

let bestTime = localStorage.getItem("pb");
bestTime = bestTime ? parseFloat(bestTime) : null;

// Zonas START/FIN guardadas
let startZone = JSON.parse(localStorage.getItem("startZone") || "null");
let finishZone = JSON.parse(localStorage.getItem("finishZone") || "null");

// Track calibrado guardado (una pista simple por ahora)
let currentTrack = JSON.parse(localStorage.getItem("currentTrack") || "null");

// Ajustes (bosque: sube a 25–35 si lo necesitas)
const ZONE_RADIUS_M = 20;

// Para evitar disparo doble al pasar por START
let startCrossedLock = false;

// ---------------- DOM ----------------
const speedEl = document.getElementById("speed");
const timeEl = document.getElementById("time");
const pbEl = document.getElementById("pb");
const armBtn = document.getElementById("armBtn");
const calibrateBtn = document.getElementById("calibrateBtn");

// (opcionales: si existen en tu HTML, los usará)
const setStartBtn = document.getElementById("setStartBtn");
const setFinishBtn = document.getElementById("setFinishBtn");
const statusEl = document.getElementById("status");
const zonesEl = document.getElementById("zones");

function setStatus(txt) {
  if (statusEl) statusEl.textContent = txt;
}

function updateZonesText() {
  if (!zonesEl) return;
  const s = startZone ? `${startZone.lat.toFixed(5)}, ${startZone.lon.toFixed(5)}` : "--";
  const f = finishZone ? `${finishZone.lat.toFixed(5)}, ${finishZone.lon.toFixed(5)}` : "--";
  zonesEl.textContent = `START: ${s} | FIN: ${f}`;
}

if (pbEl) pbEl.textContent = bestTime ? bestTime.toFixed(2) : "--";
if (timeEl) timeEl.textContent = "0.00";
if (speedEl) speedEl.textContent = "—";
setStatus("No armado");
updateZonesText();

// ---------------- Utils ----------------
function toRad(x) { return (x * Math.PI) / 180; }

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---------------- Timer ----------------
function startTimer() {
  running = true;
  startTime = Date.now();
  if (timeEl) timeEl.textContent = "0.00";
  setStatus(isCalibrating ? "Calibrando (corriendo)..." : "Corriendo...");

  timerInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    if (timeEl) timeEl.textContent = elapsed.toFixed(2);
  }, 50);
}

function stopTimer(reason = "Terminado") {
  running = false;
  clearInterval(timerInterval);

  const finalTime = timeEl ? parseFloat(timeEl.textContent) : 0;

  // Actualiza PB
  if (!bestTime || (finalTime > 0 && finalTime < bestTime)) {
    bestTime = finalTime;
    localStorage.setItem("pb", String(bestTime));
    if (pbEl) pbEl.textContent = bestTime.toFixed(2);
  }

  setStatus(reason);

  // Si estaba calibrando, guarda ruta calibrada
  if (isCalibrating) {
    if (calibrationRoute.length >= 10 && startZone && finishZone) {
      // distancia estimada de la ruta (sumatoria entre puntos)
      let dist = 0;
      for (let i = 1; i < calibrationRoute.length; i++) {
        const a = calibrationRoute[i - 1];
        const b = calibrationRoute[i];
        dist += haversineMeters(a.lat, a.lon, b.lat, b.lon);
      }

      currentTrack = {
        start: startZone,
        finish: finishZone,
        route: calibrationRoute,
        distance_m: Math.round(dist),
        time_s: finalTime
      };

      localStorage.setItem("currentTrack", JSON.stringify(currentTrack));
      alert("Ruta calibrada y guardada ✅");
    } else {
      alert("Calibración incompleta (muy pocos puntos). Intenta nuevamente.");
    }

    // salir de modo calibración
    isCalibrating = false;
    calibrationRoute = [];
    if (calibrateBtn) calibrateBtn.textContent = "CALIBRAR PISTA";
  }
}

// ---------------- Lógica de botones ----------------
if (armBtn) {
  armBtn.addEventListener("click", () => {
    // Para DH serio: exige START y FIN
    if (!startZone || !finishZone) {
      alert("Primero define START y FIN.");
      return;
    }

    armed = !armed;

    if (armed) {
      startCrossedLock = false;
      armBtn.textContent = "DESARMAR";
      setStatus(isCalibrating ? "Calibrar: cruza START" : "Armado: esperando START");
    } else {
      armBtn.textContent = "ARMAR";
      setStatus("No armado");
      if (running) stopTimer("Detenido (desarmado)");
    }
  });
}

if (calibrateBtn) {
  calibrateBtn.addEventListener("click", () => {
    if (!startZone || !finishZone) {
      alert("Define START y FIN primero.");
      return;
    }

    isCalibrating = !isCalibrating;

    if (isCalibrating) {
      calibrationRoute = [];
      setStatus("Calibrando: arma y cruza START");
      calibrateBtn.textContent = "DETENER CALIBRACIÓN";
    } else {
      // si se apaga calibración en medio, solo desactiva
      calibrateBtn.textContent = "CALIBRAR PISTA";
      setStatus(armed ? "Armado: esperando START" : "No armado");
    }
  });
}

// Opcionales: SET START / SET FIN (si agregas botones en HTML)
let lastPos = null;

if (setStartBtn) {
  setStartBtn.addEventListener("click", () => {
    if (!lastPos) { alert("Aún no hay GPS. Espera unos segundos."); return; }
    startZone = { lat: lastPos.lat, lon: lastPos.lon };
    localStorage.setItem("startZone", JSON.stringify(startZone));
    updateZonesText();
    alert("START guardado ✅");
  });
}

if (setFinishBtn) {
  setFinishBtn.addEventListener("click", () => {
    if (!lastPos) { alert("Aún no hay GPS. Espera unos segundos."); return; }
    finishZone = { lat: lastPos.lat, lon: lastPos.lon };
    localStorage.setItem("finishZone", JSON.stringify(finishZone));
    updateZonesText();
    alert("FIN guardado ✅");
  });
}

// ---------------- GPS / Velocidad informativa ----------------
let lastT = null;
let speedKmhSmoothed = 0;
const MIN_DT = 0.7; // segundos mínimos entre muestras útiles

function onPosition(position) {
  const { latitude, longitude, accuracy } = position.coords;
  const t = position.timestamp ? position.timestamp : Date.now();

  // lastPos para botones/uso
  const prevPos = lastPos;
  lastPos = { lat: latitude, lon: longitude };

  // Velocidad informativa por distancia/tiempo
  if (prevPos && lastT) {
    const dt = (t - lastT) / 1000;
    if (dt >= MIN_DT) {
      const d = haversineMeters(prevPos.lat, prevPos.lon, latitude, longitude);
      const sp = (d / dt) * 3.6;
      speedKmhSmoothed = 0.7 * speedKmhSmoothed + 0.3 * sp;
      if (speedEl) speedEl.textContent = Math.max(0, speedKmhSmoothed).toFixed(1) + " km/h";
    }
  }
  lastT = t;

  // Si no hay zonas, no hacemos lógica de cronometraje
  if (!startZone || !finishZone) return;

  const distToStart = haversineMeters(latitude, longitude, startZone.lat, startZone.lon);
  const distToFinish = haversineMeters(latitude, longitude, finishZone.lat, finishZone.lon);

  // Auto start al entrar a START
  if (armed && !running) {
    if (!startCrossedLock && distToStart <= ZONE_RADIUS_M) {
      startCrossedLock = true;
      startTimer();
    }
  }

  // Grabación de ruta durante calibración mientras corre
  if (isCalibrating && running) {
    calibrationRoute.push({
      lat: latitude,
      lon: longitude,
      t: t,
      acc: accuracy
    });
  }

  // Auto stop al entrar a FIN
  if (running && distToFinish <= ZONE_RADIUS_M) {
    stopTimer("Terminado (auto stop en FIN)");
    armed = false;
    if (armBtn) armBtn.textContent = "ARMAR";
  }
}

function onError(err) {
  console.warn("GPS error:", err);
  setStatus("Error GPS");
}

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




