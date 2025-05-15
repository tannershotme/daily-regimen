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

let wakeTime = null; // epoch milliseconds
let status = [];    // boolean[] same length as TASKS

const startBtn = document.getElementById("startBtn");
const skipBtn  = document.getElementById("skipBtn");
const resetBtn = document.getElementById("resetBtn");
const listEl   = document.getElementById("checklist");

startBtn.addEventListener("click", startDay);
skipBtn.addEventListener("click", skipToNow);
resetBtn.addEventListener("click", resetDay);

/** Parse HH:MM (24‑hour) string into a Date for today. */
function parseTimeInput(str) {
  const [h, m] = str.split(":" ).map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const now = new Date();
  const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  // if user typed a future time (e.g., 23:30 when it's 01:00), treat as yesterday
  if (candidate.getTime() > now.getTime()) {
    candidate.setDate(candidate.getDate() - 1);
  }
  return candidate;
}

function init() {
  // Register service worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(console.error);
  }

  // Restore any saved state
  wakeTime = Number(localStorage.getItem("wakeTime")) || null;
  status   = JSON.parse(localStorage.getItem("status") || "[]");

  if (wakeTime) {
    skipBtn.disabled  = false;
    resetBtn.disabled = false;
    scheduleAll();
  }
  render();

  // ask for notifications up front (optional)
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function startDay() {
  const input = prompt("What time did you wake up today? (HH:MM 24‑hour) | Leave blank to use now");
  let w;
  if (input && input.trim()) {
    const parsed = parseTimeInput(input.trim());
    if (!parsed) {
      alert("Could not parse time. Using current time.");
      w = Date.now();
    } else {
      w = parsed.getTime();
    }
  } else {
    w = Date.now();
  }

  wakeTime = w;
  status   = TASKS.map(() => false);

  localStorage.setItem("wakeTime", String(wakeTime));
  localStorage.setItem("status", JSON.stringify(status));

  skipBtn.disabled  = false;
  resetBtn.disabled = false;

  scheduleAll();
  render();
}

function scheduleAll() {
  TASKS.forEach((_, i) => scheduleTask(i));
}

function scheduleTask(i) {
  if (!wakeTime) return;
  const taskTime = wakeTime + TASKS[i].offset * 60000; // ms
  const delay = taskTime - Date.now();
  if (delay <= 0) return; // already passed

  setTimeout(() => notifyTask(i), delay);
}

function notifyTask(i) {
  if (status[i]) return; // already done
  const task = TASKS[i];

  if ("Notification" in window && Notification.permission === "granted") {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification("Time for: " + task.label, {
        body: "Tap to open checklist and mark done.",
        tag: "task-" + i,
      });
    });
  } else {
    alert("Time for: " + task.label);
  }

  // visually draw attention
  const li = document.getElementById("task-" + i);
  if (li) li.classList.add("notify");
}

function skipToNow() {
  if (!wakeTime) return;
  const now = Date.now();
  TASKS.forEach((t, i) => {
    const taskTime = wakeTime + t.offset * 60000;
    if (now >= taskTime) {
      status[i] = true; // mark as completed (skipped)
    }
  });
  localStorage.setItem("status", JSON.stringify(status));
  render();
}

function resetDay() {
  localStorage.removeItem("wakeTime");
  localStorage.removeItem("status");
  wakeTime = null;
  status  = [];
  skipBtn.disabled  = true;
  resetBtn.disabled = true;
  render();
}

function toggleDone(i) {
  status[i] = !status[i];
  localStorage.setItem("status", JSON.stringify(status));
  render();
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

    const timeSpan = document.createElement("span");
    timeSpan.className = "time";
    if (wakeTime) {
      const taskStamp = wakeTime + task.offset * 60000;
      timeSpan.textContent = formatTime(taskStamp);
    } else {
      timeSpan.textContent = "+" + task.offset + "m";
    }

    li.appendChild(label);
    li.appendChild(timeSpan);
    listEl.appendChild(li);
  });
}

// Kick it off
init();
