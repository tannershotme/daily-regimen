// -------- Configurable task list (minutes offset from wake) --------
const TASKS = [
  { id: 0, label: "Adderall XR 20 mg + Probiotic", offset: 0 },
  { id: 1, label: "Celsius (1st can)", offset: 30 },
  { id: 2, label: "Ginkgo biloba, Milk Thistle, B‑12", offset: 60 },
  { id: 3, label: "Super B‑Complex", offset: 180 },
  { id: 4, label: "Multivitamin (Focus Factor OR Myers)", offset: 300 },
  { id: 5, label: "Adderall XR 20 mg (2nd) + Celsius (optional)", offset: 480 },
  { id: 6, label: "Vitamin D3, Fish Oil, CoQ10", offset: 720 },
  { id: 7, label: "Ashwagandha + Magnesium glycinate", offset: 900 },
];

let wakeTime = null;            // Epoch ms marking "T = 0"
let status   = [];              // Completion booleans per TASK

// ----------------------- DOM elements ------------------------------
const startBtn = document.getElementById("startBtn");
const skipBtn  = document.getElementById("skipBtn");
const resetBtn = document.getElementById("resetBtn");
const listEl   = document.getElementById("checklist");

startBtn.addEventListener("click", showWakePicker);
skipBtn.addEventListener("click", skipToNow);
resetBtn.addEventListener("click", resetDay);

// -------------------- Utility helpers ------------------------------
function pad(n) { return n.toString().padStart(2, "0"); }

/** Convert HH:MM string -> Date object for *today*. */
function parseTimeInput(str) {
  const [h, m] = str.split(":" ).map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const now = new Date();
  const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  // If chosen time is in the future (e.g., 23:30 when now is 07:00), assume it was yesterday.
  if (candidate.getTime() > now.getTime()) candidate.setDate(candidate.getDate() - 1);
  return candidate;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ------------------------ Wake‑time picker -------------------------
function injectOverlayCSS() {
  const css = `.overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:1000;}`+
              `.picker{background:#fff;padding:1rem 1.25rem;border-radius:.75rem;box-shadow:0 2px 8px rgba(0,0,0,.2);text-align:center;}`+
              `.picker h2{margin:0 0 .75rem;font-size:1.1rem;}`+
              `.picker input{padding:.5rem;width:140px;font-size:1rem;}`+
              `.picker-buttons{margin-top:1rem;display:flex;gap:.5rem;justify-content:center;}`+
              `.picker-buttons button{padding:.45rem 1rem;border:none;border-radius:.5rem;background:#4f46e5;color:#fff;font-weight:600;cursor:pointer;}`;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}

function showWakePicker() {
  injectOverlayCSS();

  // Build overlay
  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML = `\n    <div class="picker">\n      <h2>Select wake‑up time</h2>\n      <input id="wakeInput" type="time" step="60">\n      <div class="picker-buttons">\n        <button id="confirmWake">Start</button>\n        <button id="cancelWake" style="background:#9ca3af">Cancel</button>\n      </div>\n    </div>`;
  document.body.appendChild(ov);

  // Prefill with current time HH:MM
  const now = new Date();
  ov.querySelector("#wakeInput").value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  // Show native timepicker on supported browsers
  ov.querySelector("#wakeInput").focus();

  // Event handlers
  ov.querySelector("#cancelWake").onclick = () => document.body.removeChild(ov);
  ov.querySelector("#confirmWake").onclick = () => {
    const val = ov.querySelector("#wakeInput").value;
    const parsed = parseTimeInput(val);
    setWakeTime(parsed ? parsed.getTime() : Date.now());
    document.body.removeChild(ov);
  };
}

function setWakeTime(epochMs) {
  wakeTime = epochMs;
  status   = TASKS.map(() => false);

  localStorage.setItem("wakeTime", String(wakeTime));
  localStorage.setItem("status",   JSON.stringify(status));

  skipBtn.disabled  = false;
  resetBtn.disabled = false;

  scheduleAll();
  render();
}

// ------------------------ Scheduling & notifications --------------
function scheduleAll() { TASKS.forEach((_, i) => scheduleTask(i)); }

function scheduleTask(i) {
  if (!wakeTime) return;
  const when = wakeTime + TASKS[i].offset * 60000;
  const delay = when - Date.now();
  if (delay <= 0) return; // time passed
  setTimeout(() => notifyTask(i), delay);
}

function notifyTask(i) {
  if (status[i]) return;
  const task = TASKS[i];

  if ("Notification" in window && Notification.permission === "granted") {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification("Time for: " + task.label, {
        body: "Open checklist and mark done.",
        tag: "task-" + i,
      });
    });
  } else {
    alert("Time for: " + task.label);
  }

  const li = document.getElementById("task-" + i);
  if (li) li.classList.add("notify");
}

// --------------------------- Skip / Reset -------------------------
function skipToNow() {
  if (!wakeTime) return;
  const now = Date.now();
  TASKS.forEach((t, i) => {
    const due = wakeTime + t.offset * 60000;
    if (now >= due) status[i] = true;
  });
  localStorage.setItem("status", JSON.stringify(status));
  render();
}

function resetDay() {
  localStorage.removeItem("wakeTime");
  localStorage.removeItem("status");
  wakeTime = null;
  status  = [];
  skipBtn.disabled = resetBtn.disabled = true;
  render();
}

// ------------------------------ UI --------------------------------
function toggleDone(i) {
  status[i] = !status[i];
  localStorage.setItem("status", JSON.stringify(status));
  render();
}

function render() {
  listEl.innerHTML = "";
  TASKS.forEach((task, i) => {
    const li = document.createElement("li");
    li.className = "task" + (status[i] ? " done" : "");
    li.id = "task-" + i;
    li.onclick = () => toggleDone(i);

    const label = document.createElement("span");
    label.textContent = task.label;

    const time = document.createElement("span");
    time.className = "time";
    time.textContent = wakeTime ? formatTime(wakeTime + task.offset * 60000) : `+${task.offset}m`;

    li.append(label, time);
    listEl.appendChild(li);
  });
}

// --------------------------- Init ---------------------------------
(function init() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");

  wakeTime = Number(localStorage.getItem("wakeTime")) || null;
  status   = JSON.parse(localStorage.getItem("status") || "[]");

  if (wakeTime) {
    skipBtn.disabled  = false;
    resetBtn.disabled = false;
    scheduleAll();
  }

  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }

  render();
})();
