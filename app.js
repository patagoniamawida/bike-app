let watchId = null;
let armed = false;
let running = false;
let startTime = null;
let timerInterval = null;
let bestTime = localStorage.getItem("pb");

const speedEl = document.getElementById("speed");
const timeEl = document.getElementById("time");
const pbEl = document.getElementById("pb");
const armBtn = document.getElementById("armBtn");

if (bestTime) {
  pbEl.textContent = parseFloat(bestTime).toFixed(2);
}

armBtn.addEventListener("click", () => {
  armed = !armed;
  armBtn.textContent = armed ? "DESARMAR" : "ARMAR";
});

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
    localStorage.setItem("pb", bestTime);
    pbEl.textContent = bestTime.toFixed(2);
  }
}

function success(position) {
  const speed = position.coords.speed;
  if (speed !== null) {
    const kmh = speed * 3.6;
    speedEl.textContent = kmh.toFixed(1) + " km/h";

    if (armed && kmh > 5 && !running) {
      startTimer();
    }

    if (running && kmh < 3) {
      stopTimer();
    }
  }
}

function error(err) {
  console.warn(err.message);
}

if ("geolocation" in navigator) {
  watchId = navigator.geolocation.watchPosition(success, error, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 5000,
  });
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}