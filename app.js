/* app.js */
const TASKS = [
  { id: 0, label: "Adderall XR 20 mg + Probiotic", offset: 0 },
  { id: 1, label: "Celsius (1st can)", offset: 30 },
  { id: 2, label: "Ginkgo biloba, Milk Thistle, B-12", offset: 60 },
  { id: 3, label: "Super B-Complex", offset: 180 },
  { id: 4, label: "Multivitamin (Focus Factor OR Myers)", offset: 300 },
  { id: 5, label: "Adderall XR 20 mg (2nd) + Celsius (optional)", offset: 480 },
  { id: 6, label: "Vitamin D3, Fish Oil, CoQ10", offset: 720 },
  { id: 7, label: "Ashwagandha + Magnesium glycinate", offset: 900 },
];

let wakeTime = null;
let status = []; // boolean array tracking completion

const startBtn = document.getElementById("startBtn");
const skipBtn = document.getElementById("skipBtn");
const resetBtn = document.getElementById("resetBtn");
const listEl = document.getElementById("checklist");

startBtn.addEventListener("click", startDay);
skipBtn.addEventListener("click", skipToNow);
resetBtn.addEventListener("click", resetDay);

function init() {
  // Register service worker (PWA + background notifications)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(console.error);
  }

  // Request notification permission early
  if ("Notification" in window) {
    Notification.requestPermission();
  }

  // Restore state if present
  const savedWake = localStorage.getItem("wakeTime");
  const savedStatus = localStorage.getItem("status");
  if (savedWake) {
    wakeTime = Number(savedWake);
    status = JSON.parse(savedStatus || "[]");
    skipBtn.disabled = false;
    resetBtn.disabled = false;
    scheduleAll();
  }

  render();
}

function startDay() {
  wakeTime = Date.now();
  status = TASKS.map(() => false);
  localStorage.setItem("wakeTime", wakeTime);
  localStorage.setItem("status", JSON.stringify(status));
  skipBtn.disabled = false;
  resetBtn.disabled = false;
  scheduleAll();
  render();
}

function scheduleAll() {
  TASKS.forEach((_, i) => scheduleTask(i));
}

function scheduleTask(i) {
  if (!wakeTime) return;
  const taskTime = wakeTime + TASKS[i].offset * 60 * 1000;
  const delay = taskTime - Date.now();
  if (delay <= 0) return; // task time already passed
  setTimeout(() => notifyTask(i), delay);
}

function notifyTask(i) {
  if (status[i]) return; // already done/ignored
  const task = TASKS[i];
  // Browser notification
  if ("Notification" in window && Notification.permission === "granted") {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification("Time for: " + task.label, {
        body: "Open the checklist to confirm.",
        tag: "task-" + i,
      });
    });
  } else {
    alert("Time for: " + task.label);
  }
  // Highlight item in list
  const li = document.getElementById("task-" + i);
  if (li) li.classList.add("notify");
}

function skipToNow() {
  if (!wakeTime) return;
  const now = Date.now();
  TASKS.forEach((t, i) => {
    const taskTime = wakeTime + t.offset * 60 * 1000;
    if (now >= taskTime && !status[i]) {
      status[i] = true; // mark done (skipped)
    }
  });
  localStorage.setItem("status", JSON.stringify(status));
  render();
}

function resetDay() {
  localStorage.removeItem("wakeTime");
  localStorage.removeItem("status");
  wakeTime = null;
  status = [];
  skipBtn.disabled = true;
  resetBtn.disabled = true;
  render();
}

function toggleDone(i) {
  status[i] = !status[i];
  localStorage.setItem("status", JSON.stringify(status));
  render();
}

function formatTime(dateObj) {
  return dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function render() {
  listEl.innerHTML = "";
  TASKS.forEach((task, i) => {
    const li = document.createElement("li");
    li.className = "task" + (status[i] ? " done" : "");
    li.id = "task-" + i;
    li.addEventListener("click", () => toggleDone(i));

    const label = document.createElement("span");
    label.textContent = task.label;

    const time = document.createElement("span");
    time.className = "time";
    if (wakeTime) {
      const tDate = new Date(wakeTime + task.offset * 60 * 1000);
      time.textContent = formatTime(tDate);
    } else {
      time.textContent = "+" + task.offset + "m";
    }

    li.appendChild(label);
    li.appendChild(time);
    listEl.appendChild(li);
  });
}

init();
