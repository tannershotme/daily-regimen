/* app.js – hide Start button once the day begins, re‑show on reset */

// --------------------------- Task list ---------------------------------
// Default tasks used when none are saved in localStorage
const DEFAULT_TASKS = [
  { label: "Adderall XR 20 mg + Probiotic", offset: 0 },
  { label: "Celsius (1st can)", offset: 30 },
  { label: "Ginkgo biloba, Milk Thistle, B-12", offset: 60 },
  { label: "Super B-Complex", offset: 180 },
  { label: "Multivitamin (Focus Factor OR Myers)", offset: 300 },
  { label: "Adderall XR 20 mg (2nd) + Celsius (optional)", offset: 480 },
  { label: "Vitamin D3, Fish Oil, CoQ10", offset: 720 },
  { label: "Ashwagandha + Magnesium glycinate", offset: 900 },
];
let tasks;
try { tasks = JSON.parse(localStorage.getItem("tasks") || "null"); }
catch { tasks = null; }

// Fallback to defaults if nothing stored or parsing failed
if (!Array.isArray(tasks) || !tasks.every(t => t && typeof t.offset === "number"))
  tasks = DEFAULT_TASKS.slice();

let wakeTime = null;  // epoch ms marking wake‑up
let status   = [];    // boolean per task
let timers   = [];    // setTimeout handles

// --------------------------- DOM refs ----------------------------------
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const editBtn  = document.getElementById("editBtn");
const skipEl   = document.getElementById("skipBtn"); // may still be in HTML
if (skipEl) skipEl.remove();                          // remove obsolete element
const listEl   = document.getElementById("checklist");

startBtn.addEventListener("click", showWakePicker);
resetBtn.addEventListener("click", resetDay);
if(editBtn) editBtn.addEventListener("click", showTaskEditor);

function hideStart(){ startBtn.style.display = "none"; }
function showStart(){ startBtn.style.display = "inline-block"; }

// -------------------------- Utilities ----------------------------------
const pad = n => String(n).padStart(2, "0");
const escapeHTML = s => s.replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));
const parseTimeInput = str => {
  const [h,m] = str.split(":" ).map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  if (d.getTime() > now.getTime()) d.setDate(d.getDate() - 1);
  return d;
};
const formatTime = ts => new Date(ts).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });

// -------------------- Overlay helpers ----------------------------------
function ensureCSS(){
  if(document.getElementById("overlay-css")) return;
  const s=document.createElement("style"); s.id="overlay-css";
  s.textContent=`.overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:1000}`+
    `.picker{background:#fff;padding:1rem 1.25rem;border-radius:.75rem;box-shadow:0 2px 8px rgba(0,0,0,.2);text-align:center;max-width:90%}`+
    `.picker h2{margin:0 0 .75rem;font-size:1.1rem}`+
    `.picker input{padding:.5rem;width:140px;font-size:1rem}`+
    `.picker-buttons{margin-top:1rem;display:flex;gap:.5rem;justify-content:center}`+
    `.picker-buttons button{padding:.45rem 1rem;border:none;border-radius:.5rem;background:#4f46e5;color:#fff;font-weight:600;cursor:pointer}`+
    `.task-list{max-height:50vh;overflow:auto;text-align:left;margin:.5rem 0}`+
    `.task-list label{display:block;margin:.25rem 0}`+
    `.task-edit-row{display:flex;gap:.5rem;margin:.25rem 0}`+
    `.task-edit-row input{padding:.25rem;font-size:.9rem}`+
    `.task-edit-row button{background:#ef4444;color:#fff;border:none;border-radius:.25rem;padding:.25rem .5rem}`;
  document.head.appendChild(s);
}

// -------------------- Wake-time picker ---------------------------------
function showWakePicker(){
  ensureCSS();
  const ov=document.createElement("div"); ov.className="overlay";
  ov.innerHTML=`<div class="picker"><h2>Select wake‑up time</h2><input id="wakeInput" type="time" step="60"><div class="picker-buttons"><button id="confirmWake">Start</button><button id="cancelWake" style="background:#9ca3af">Cancel</button></div></div>`;
  document.body.appendChild(ov);
  const now=new Date();
  ov.querySelector("#wakeInput").value=`${pad(now.getHours())}:${pad(now.getMinutes())}`;
  ov.querySelector("#wakeInput").focus();
  ov.querySelector("#cancelWake").onclick=()=>document.body.removeChild(ov);
  ov.querySelector("#confirmWake").onclick=()=>{
    try{
      const val=ov.querySelector("#wakeInput").value;
      const parsed=parseTimeInput(val);
      setWakeTime(parsed?parsed.getTime():Date.now());
    }catch(e){
      console.error("Failed to start day",e);
    }finally{
      document.body.removeChild(ov);
    }
  };
}

// -------------------- Past‑task overlay --------------------------------
function promptPastTasks(ids){
  if(!ids.length) return;
  ensureCSS();
  const ov=document.createElement("div"); ov.className="overlay";
  ov.innerHTML=`<div class="picker"><h2>Mark what you already took</h2><div class="task-list">${ids.map(i=>`<label><input type=checkbox data-idx=${i}> ${escapeHTML(tasks[i].label)}</label>`).join("")}</div><div class="picker-buttons"><button id="checkAllPast" style="background:#22c55e">Check All</button><button id="savePast">Save</button></div></div>`;
  document.body.appendChild(ov);
  ov.querySelector("#checkAllPast").onclick=()=>ov.querySelectorAll("input[type=checkbox]").forEach(cb=>cb.checked=true);
  ov.querySelector("#savePast").onclick=()=>{
    ov.querySelectorAll("input[type=checkbox]").forEach(cb=>{ if(cb.checked) status[+cb.dataset.idx]=true; });
    localStorage.setItem("status",JSON.stringify(status));
    render();
    document.body.removeChild(ov);
  };
}

// -------------------- Task editor overlay -------------------------------
function showTaskEditor(){
  ensureCSS();
  const ov=document.createElement("div"); ov.className="overlay";
  ov.innerHTML=`<div class="picker"><h2>Edit Tasks</h2><div class="task-list" id="editList"></div><div class="picker-buttons"><button id="addTask" style="background:#22c55e">Add</button><button id="saveTasks">Save</button></div></div>`;
  document.body.appendChild(ov);
  const list=ov.querySelector("#editList");
  const addRow=t=>{
    const row=document.createElement("div");
    row.className="task-edit-row";
    const labelInput=document.createElement("input");
    labelInput.className="label";
    labelInput.placeholder="Label";
    labelInput.value=t.label;
    const offsetInput=document.createElement("input");
    offsetInput.className="offset";
    offsetInput.type="number";
    offsetInput.min="0";
    offsetInput.value=t.offset;
    offsetInput.style.width="70px";
    const removeBtn=document.createElement("button");
    removeBtn.className="remove";
    removeBtn.textContent="\u2715";
    removeBtn.onclick=()=>list.removeChild(row);
    row.append(labelInput,offsetInput,removeBtn);
    list.appendChild(row);
  };
  tasks.forEach(addRow);
  ov.querySelector("#addTask").onclick=()=>addRow({label:"",offset:0});
  ov.querySelector("#saveTasks").onclick=()=>{
    const newTasks=[];
    list.querySelectorAll(".task-edit-row").forEach(row=>{
      const label=row.querySelector(".label").value.trim();
      const offset=parseInt(row.querySelector(".offset").value,10)||0;
      if(label) newTasks.push({label,offset});
    });
    tasks=newTasks;
    localStorage.setItem("tasks",JSON.stringify(tasks));
    resetDay();
    document.body.removeChild(ov);
  };
}

// -------------------- State & scheduler --------------------------------
function clearAllTimers(){ timers.forEach(id=>clearTimeout(id)); timers=[]; }
function setWakeTime(ms){
  clearAllTimers();
  wakeTime=ms; status=tasks.map(()=>false); hideStart(); resetBtn.disabled=false;
  localStorage.setItem("wakeTime",wakeTime); localStorage.setItem("status",JSON.stringify(status));
  const now=Date.now();
  const passed=tasks.map((t,i)=>i).filter(i=>now>=wakeTime+t.offset*60000);
  promptPastTasks(passed);
  scheduleAll(); render();
}
function scheduleAll(){tasks.forEach((_,i)=>scheduleTask(i));}
function scheduleTask(i){ if(!wakeTime) return; const delay=wakeTime+tasks[i].offset*60000-Date.now(); if(delay>0) { const id=setTimeout(()=>notify(i),delay); timers.push(id); }}
function notify(i){
  if(status[i]) return;
  const t=tasks[i];
  if(Notification.permission==="granted"){
    if(navigator.serviceWorker && navigator.serviceWorker.ready){
      navigator.serviceWorker.ready
        .then(r=>r.showNotification(`Time for: ${t.label}`,{body:"Open checklist to confirm.",tag:`task-${i}`}))
        .catch(e=>console.error("Notify failed",e));
    }else{
      try{ new Notification(`Time for: ${t.label}`,{body:"Open checklist to confirm.",tag:`task-${i}`}); }
      catch(e){ console.error("Notification error",e); }
    }
  }else{
    alert(`Time for: ${t.label}`);
  }
}

// -------------------- Reset -------------------------------------------
function resetDay(){
  clearAllTimers();
  localStorage.removeItem("wakeTime");
  localStorage.removeItem("status");
  wakeTime=null; status=[];
  showStart();
  resetBtn.disabled=true;
  render();
}

// -------------------- UI ----------------------------------------------
function toggleDone(i){ status[i]=!status[i]; localStorage.setItem("status",JSON.stringify(status)); render(); }
function render(){
  listEl.innerHTML="";
  tasks.forEach((t,i)=>{
    const li=document.createElement("li");
    li.className=`task${status[i]?" done":""}`;
    li.id=`task-${i}`;
    li.onclick=()=>toggleDone(i);
    const label=document.createElement("span"); label.textContent=t.label;
    const time=document.createElement("span"); time.className="time";
    time.textContent=wakeTime?formatTime(wakeTime+t.offset*60000):`+${t.offset}m`;
    li.append(label,time);
    listEl.appendChild(li);
  });
}

// -------------------- Init --------------------------------------------
(function(){
  if("serviceWorker" in navigator)
    navigator.serviceWorker.register("sw.js").catch(e=>console.error("SW reg failed",e));
  wakeTime=+localStorage.getItem("wakeTime")||null;
  status=JSON.parse(localStorage.getItem("status")||"[]");
  if(wakeTime){ hideStart(); resetBtn.disabled=false; scheduleAll(); }
  else { showStart(); resetBtn.disabled=true; }
  if(Notification.permission==="default") Notification.requestPermission();
  render();
})();
