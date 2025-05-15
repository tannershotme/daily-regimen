// --------------------------- Task list ---------------------------------
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

let wakeTime = null;  // epoch ms marking wake‑up
let status   = [];    // boolean per task

// --------------------------- DOM refs ----------------------------------
const startBtn = document.getElementById("startBtn");
const skipBtn  = document.getElementById("skipBtn");
const resetBtn = document.getElementById("resetBtn");
const listEl   = document.getElementById("checklist");

startBtn.addEventListener("click", showWakePicker);
skipBtn.addEventListener("click", skipToNow);
resetBtn.addEventListener("click", resetDay);

// -------------------------- Utilities ----------------------------------
const pad = n => String(n).padStart(2, "0");
const parseTimeInput = str => {
  const [h, m] = str.split(":" ).map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  if (d.getTime() > now.getTime()) d.setDate(d.getDate() - 1);
  return d;
};
const formatTime = ts => new Date(ts).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });

// -------------------- Overlay helpers ----------------------------------
function ensureOverlayCSS(){
  if(document.getElementById("overlay-css")) return;
  const style=document.createElement("style");
  style.id="overlay-css";
  style.textContent=`.overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:1000}`+
    `.picker{background:#fff;padding:1rem 1.25rem;border-radius:.75rem;box-shadow:0 2px 8px rgba(0,0,0,.2);text-align:center;max-width:90%}`+
    `.picker h2{margin:0 0 .75rem;font-size:1.1rem}`+
    `.picker input{padding:.5rem;width:140px;font-size:1rem}`+
    `.picker-buttons{margin-top:1rem;display:flex;gap:.5rem;justify-content:center}`+
    `.picker-buttons button{padding:.45rem 1rem;border:none;border-radius:.5rem;background:#4f46e5;color:#fff;font-weight:600;cursor:pointer}`+
    `.task-list{max-height:50vh;overflow:auto;text-align:left;margin:.5rem 0}`+
    `.task-list label{display:block;margin:.25rem 0}`;
  document.head.appendChild(style);
}

// -------------------- Wake‑time picker ---------------------------------
function showWakePicker(){
  ensureOverlayCSS();
  const ov=document.createElement("div");
  ov.className="overlay";
  ov.innerHTML=`<div class="picker"><h2>Select wake‑up time</h2><input id="wakeInput" type="time" step="60"><div class="picker-buttons"><button id="confirmWake">Start</button><button id="cancelWake" style="background:#9ca3af">Cancel</button></div></div>`;
  document.body.appendChild(ov);
  const now=new Date();
  ov.querySelector("#wakeInput").value=`${pad(now.getHours())}:${pad(now.getMinutes())}`;
  ov.querySelector("#wakeInput").focus();
  ov.querySelector("#cancelWake").onclick=()=>document.body.removeChild(ov);
  ov.querySelector("#confirmWake").onclick=()=>{
    const val=ov.querySelector("#wakeInput").value;
    const parsed=parseTimeInput(val);
    setWakeTime(parsed?parsed.getTime():Date.now());
    document.body.removeChild(ov);
  };
}

// -------------------- Past‑task overlay --------------------------------
function promptPastTasks(pastIdx){
  if(!pastIdx.length) return;
  ensureOverlayCSS();
  const ov=document.createElement("div");
  ov.className="overlay";
  const listHtml=pastIdx.map(i=>`<label><input type="checkbox" data-idx="${i}"> ${TASKS[i].label}</label>`).join("");
  ov.innerHTML=`<div class="picker"><h2>Mark what you already took</h2><div class="task-list">${listHtml}</div><div class="picker-buttons"><button id="checkAllPast" style="background:#22c55e">Check All</button><button id="savePast">Save</button></div></div>`;
  document.body.appendChild(ov);
  ov.querySelector("#checkAllPast").onclick=()=>ov.querySelectorAll("input[type=checkbox]").forEach(cb=>cb.checked=true);
  ov.querySelector("#savePast").onclick=()=>{
    ov.querySelectorAll("input[type=checkbox]").forEach(cb=>{ if(cb.checked) status[Number(cb.dataset.idx)]=true; });
    localStorage.setItem("status",JSON.stringify(status));
    render();
    document.body.removeChild(ov);
  };
}

// -------------------- State management --------------------------------
function setWakeTime(ms){
  wakeTime=ms;
  status=TASKS.map(()=>false);
  localStorage.setItem("wakeTime",String(wakeTime));
  localStorage.setItem("status",JSON.stringify(status));
  skipBtn.disabled=resetBtn.disabled=false;
  const now=Date.now();
  const pastIdx=TASKS.filter((t,i)=>now>=wakeTime+t.offset*60000).map(t=>t.id);
  scheduleAll();
  render();
  promptPastTasks(pastIdx);
}

// -------------------- Scheduler & notifications -----------------------
function scheduleAll(){TASKS.forEach((_,i)=>scheduleTask(i));}
function scheduleTask(i){
  if(!wakeTime) return;
  const when=wakeTime+TASKS[i].offset*60000;
  const delay=when-Date.now();
  if(delay<=0) return;
  setTimeout(()=>notifyTask(i),delay);
}
function notifyTask(i){
  if(status[i]) return;
  const task=TASKS[i];
  if("Notification" in window && Notification.permission==="granted"){
    navigator.serviceWorker.ready.then(reg=>reg.showNotification(`Time for: ${task.label}`,{body:"Open checklist to confirm.",tag:`task-${i}`}));
  }else{
    alert(`Time for: ${task.label}`);
  }
  const li=document.getElementById(`task-${i}`);
  if(li) li.classList.add("notify");
}

// -------------------- Skip / Reset ------------------------------------
function skipToNow(){
  if(!wakeTime) return;
  const now=Date.now();
  TASKS.forEach((t,i)=>{ if(now>=wakeTime+t.offset*60000) status[i]=true; });
  localStorage.setItem("status",JSON.stringify(status));
  render();
}
function resetDay(){
  localStorage.removeItem("wakeTime");
  localStorage.removeItem("status");
  wakeTime=null; status=[];
  skipBtn.disabled=resetBtn.disabled=true;
  render();
}

// -------------------- UI rendering ------------------------------------
function toggleDone(i){
  status[i]=!status[i];
  localStorage.setItem("status",JSON.stringify(status));
  render();
}
function render(){
  listEl.innerHTML="";
  TASKS.forEach((task,i)=>{
    const li=document.createElement("li");
    li.className="task"+(status[i]?" done":"");
    li.id=`task-${i}`;
    li.onclick=()=>toggleDone(i);
    const label=document.createElement("span"); label.textContent=task.label;
    const time=document.createElement("span"); time.className="time";
    time.textContent=wakeTime?formatTime(wakeTime+task.offset*60000):`+${task.offset}m`;
    li.append(label,time);
    listEl.appendChild(li);
  });
}

// -------------------- Init --------------------------------------------
(function init(){
  if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
  wakeTime=Number(localStorage.getItem("wakeTime"))||null;
  status=JSON.parse(localStorage.getItem("status")||"[]");
  if(wakeTime){ skipBtn.disabled=resetBtn.disabled=false; scheduleAll(); }
  if("Notification" in window && Notification.permission==="default") Notification.requestPermission();
  render();
})();
