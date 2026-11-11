// SB Tracker v1.2 — Swagbucks-specific manual earnings manager.
// No host permissions, no automation, nothing touches swagbucks.com.
// v1.2 adds: official To-Do List routine (8 items, 6/8 and 8/8 bonuses),
// streak badge tracker (official: 7d=25 SB, 14d=100, 21d=200, month=300,
// claim by the 5th of next month), focus-session timer, pending SB,
// SB/min cutoff filter, avoid list, cashout date planner, screener
// profile card. Swagbucks day resets at midnight Pacific (4 AM Halifax).

const $ = (id) => document.getElementById(id);

function dateKey(d) {
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
const todayKey = () => dateKey(new Date());
function keyDaysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return dateKey(d); }

const ROUTINE_ITEMS = ["Daily Poll", "Daily Search", "Deal of the Day", "Daily Discover",
  "Daily Activity (app/SwagButton)", "Attempt a Survey", "Complete a Survey", "Swag Code (if live)"];
const BADGES = [[7, 25], [14, 100], [21, 200], [30, 300]];
const PROFILE = "Not employed · No vehicle · Non-smoker / non-vaper · Never drinks alcohol · Gamer, 50+ h/week · No flights in the past year · Household of 3 · Pets: 4 cats, 1 small dog";

let state = { goal: 100, cashout: 500, cashoutDate: "", cutoff: 0, avoid: "", entries: [], queue: [], routine: {} };
let timerStartTs = null, timerInt = null;

function save() { chrome.storage.local.set({ sbTracker: state }); }
function sumWhere(fn) { return state.entries.filter(fn).reduce((s, e) => s + e.sb, 0); }
function confirmed(fn) { return sumWhere(e => !e.pending && fn(e)); }
function dayTotal(key) { return confirmed(e => e.date === key); }

function computeStreak() {
  let streak = 0;
  const d = new Date();
  if (dayTotal(todayKey()) < state.goal) d.setDate(d.getDate() - 1);
  while (state.goal > 0 && dayTotal(dateKey(d)) >= state.goal) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

function li(textParts, onDelete) {
  const el = document.createElement("li");
  const span = document.createElement("span");
  textParts.forEach(([txt, bold]) => {
    if (bold) { const b = document.createElement("b"); b.textContent = txt; span.appendChild(b); }
    else span.appendChild(document.createTextNode(txt));
  });
  el.appendChild(span);
  const del = document.createElement("button");
  del.className = "del"; del.textContent = "✕"; del.onclick = onDelete;
  el.appendChild(del);
  return el;
}

function render() {
  const today = todayKey();
  const tTotal = dayTotal(today);
  const lifetime = confirmed(() => true);
  const pendingTotal = sumWhere(e => e.pending);

  $("balance").textContent = lifetime;
  $("pendingLine").textContent = pendingTotal > 0 ? "(+" + pendingTotal + " SB pending)" : "";
  $("todayTotal").textContent = tTotal;
  $("goalLabel").textContent = state.goal;
  $("goalInput").value = state.goal;
  $("goalBar").style.width = Math.min(100, (tTotal / state.goal) * 100) + "%";

  const streak = computeStreak();
  const nextBadge = BADGES.find(([d]) => d > streak);
  $("streak").textContent = "Streak: " + streak + " days" + (nextBadge ? " · next badge at " + nextBadge[0] + "d = " + nextBadge[1] + " SB" : " · Monthly Master pace 🏆");
  if (streak >= 7) $("streak").textContent += " — claim badges by the 5th next month";

  const hour = new Date().getHours();
  $("streakWarn").textContent = (tTotal < state.goal && hour >= 18)
    ? "⚠️ " + (state.goal - tTotal) + " SB short of Goal 1 — streak at risk (SB day ends 4:00 AM your time)." : "";

  // Daily routine (official To-Do List structure)
  const done = state.routine[today] || [];
  const rList = $("routine"); rList.innerHTML = "";
  ROUTINE_ITEMS.forEach((name, i) => {
    const el = document.createElement("li");
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.checked = done.includes(i);
    cb.onchange = () => {
      const arr = state.routine[today] || (state.routine[today] = []);
      const at = arr.indexOf(i);
      if (cb.checked && at < 0) arr.push(i);
      if (!cb.checked && at >= 0) arr.splice(at, 1);
      save(); render();
    };
    const label = document.createElement("span"); label.textContent = " " + name;
    el.appendChild(cb); el.appendChild(label); rList.appendChild(el);
  });
  const n = done.length;
  $("routineBonus").textContent = n >= 8 ? "— 8/8: both bonuses ✓" : n >= 6 ? "— 6/8: first bonus ✓" : "— " + n + "/8 (bonus at 6 and 8)";

  $("profileCard").textContent = PROFILE;

  // Cashout + planner
  const target = state.cashout || 500;
  const left = Math.max(0, target - lifetime);
  $("cashoutLabel").textContent = target;
  $("cashoutInput").value = target;
  if (state.cashoutDate) $("cashoutDate").value = state.cashoutDate;
  $("cashoutLeft").textContent = left > 0 ? left + " SB to go" : "Target reached 🎉";
  $("cashoutBar").style.width = Math.min(100, (lifetime / target) * 100) + "%";
  const last7 = confirmed(e => e.date > keyDaysAgo(7));
  const avgDay = last7 / 7;
  $("cashoutEta").textContent = left > 0
    ? (avgDay > 0 ? "At your 7-day pace (" + Math.round(avgDay) + " SB/day): ~" + Math.ceil(left / avgDay) + " days" : "Log a few days of SB to get an ETA") : "";
  if (state.cashoutDate && left > 0) {
    const days = Math.ceil((new Date(state.cashoutDate + "T23:59") - new Date()) / 86400000);
    $("plannerLine").textContent = days > 0 ? "To hit " + target + " SB by " + state.cashoutDate + ": earn " + Math.ceil(left / days) + " SB/day for " + days + " days." : "That date has passed — pick a new one.";
  } else $("plannerLine").textContent = "";

  // Stats
  const last30 = confirmed(e => e.date > keyDaysAgo(30));
  const sources = {};
  state.entries.filter(e => !e.pending).forEach(e => { sources[e.source] = (sources[e.source] || 0) + e.sb; });
  const srcTxt = Object.entries(sources).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + " " + v).join(" · ");
  $("stats").textContent = "Last 7 days: " + last7 + " SB · Last 30 days: " + last30 + " SB" + (srcTxt ? " — " + srcTxt : "");
  const totalMins = state.entries.reduce((s, e) => s + (e.minutes || 0), 0);
  const allSb = sumWhere(() => true);
  $("rateSummary").textContent = totalMins > 0
    ? "Lifetime tracked: " + allSb + " SB in " + totalMins + " min (" + Math.round(allSb / (totalMins / 60)) + " SB/h)"
    : "Lifetime tracked: " + allSb + " SB";

  // Entries
  const eList = $("entries"); eList.innerHTML = "";
  state.entries.slice(-12).reverse().forEach((e, i) => {
    const realIdx = state.entries.length - 1 - i;
    const rate = e.minutes > 0 ? " · " + (e.sb / e.minutes).toFixed(1) + " SB/min" : "";
    const pend = e.pending ? " · ⏳ pending" : "";
    eList.appendChild(li([[e.date.slice(5) + " · " + e.source + " · ", false], [e.sb + " SB", true], [rate + pend, false]],
      () => { state.entries.splice(realIdx, 1); save(); render(); }));
  });

  // Queue with cutoff filter
  $("cutoffInput").value = state.cutoff || 0;
  const qList = $("queue"); qList.innerHTML = "";
  [...state.queue].map((q, i) => ({ ...q, i, rate: q.sb / q.min }))
    .filter(q => q.rate >= (state.cutoff || 0))
    .sort((a, b) => b.rate - a.rate)
    .forEach(q => {
      qList.appendChild(li([[q.sb + " SB", true], [" / " + q.min + " min · " + q.rate.toFixed(1) + " SB/min" + (q.note ? " · " + q.note : ""), false]],
        () => { state.queue.splice(q.i, 1); save(); render(); }));
    });
  $("avoidText").value = state.avoid || "";
}

// Focus timer
function fmtTimer(sec) { const m = String(Math.floor(sec / 60)).padStart(2, "0"); const s = String(sec % 60).padStart(2, "0"); return m + ":" + s; }
$("timerStart").onclick = () => {
  timerStartTs = Date.now();
  $("timerStart").disabled = true; $("timerStop").disabled = false;
  timerInt = setInterval(() => { $("timerDisplay").textContent = fmtTimer(Math.floor((Date.now() - timerStartTs) / 1000)); }, 500);
};
$("timerStop").onclick = () => {
  clearInterval(timerInt);
  const mins = Math.max(1, Math.round((Date.now() - timerStartTs) / 60000));
  $("timerStart").disabled = false; $("timerStop").disabled = true;
  $("timerDisplay").textContent = "00:00";
  const sb = parseInt(prompt("Session over (" + mins + " min). How many SB did you earn?"), 10);
  if (sb > 0) { state.entries.push({ date: todayKey(), sb, minutes: mins, source: "other" }); save(); render(); }
  timerStartTs = null;
};

$("saveGoal").onclick = () => { const v = parseInt($("goalInput").value, 10); if (v > 0) { state.goal = v; save(); render(); } };
$("saveCashout").onclick = () => {
  const v = parseInt($("cashoutInput").value, 10);
  if (v > 0) state.cashout = v;
  state.cashoutDate = $("cashoutDate").value || "";
  save(); render();
};
$("saveCutoff").onclick = () => { const v = parseFloat($("cutoffInput").value) || 0; state.cutoff = v; save(); render(); };
$("saveAvoid").onclick = () => { state.avoid = $("avoidText").value; save(); };
$("copyProfile").onclick = () => { navigator.clipboard.writeText(PROFILE); $("copyProfile").textContent = "Copied ✓"; setTimeout(() => $("copyProfile").textContent = "Copy", 1200); };

$("addEntry").onclick = () => {
  const sb = parseInt($("sbAmount").value, 10);
  const minutes = parseInt($("sbMinutes").value, 10) || 0;
  if (!sb || sb <= 0) return;
  state.entries.push({ date: todayKey(), sb, minutes, source: $("sbSource").value, pending: $("sbPending").checked });
  $("sbAmount").value = ""; $("sbMinutes").value = ""; $("sbPending").checked = false;
  save(); render();
};

$("addQueue").onclick = () => {
  const sb = parseInt($("qSb").value, 10);
  const min = parseInt($("qMin").value, 10);
  if (!sb || !min) return;
  state.queue.push({ sb, min, note: $("qNote").value.trim() });
  $("qSb").value = ""; $("qMin").value = ""; $("qNote").value = "";
  save(); render();
};

$("exportBtn").onclick = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "sb-tracker-export.json";
  a.click();
  URL.revokeObjectURL(a.href);
};
$("importBtn").onclick = () => $("importFile").click();
$("importFile").onchange = (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.entries) || !Array.isArray(data.queue)) throw new Error("bad format");
      state = { goal: data.goal > 0 ? data.goal : 100, cashout: data.cashout > 0 ? data.cashout : 500,
        cashoutDate: data.cashoutDate || "", cutoff: data.cutoff || 0, avoid: data.avoid || "",
        entries: data.entries, queue: data.queue, routine: data.routine || {} };
      save(); render();
    } catch (err) { alert("Import failed: not a valid SB Tracker export."); }
  };
  reader.readAsText(file);
  ev.target.value = "";
};

chrome.storage.local.get("sbTracker", (res) => {
  if (res.sbTracker) {
    state = { ...state, ...res.sbTracker };
    if (!state.routine) state.routine = {};
    // keep only today's routine to stop storage growth
    const t = todayKey();
    state.routine = state.routine[t] ? { [t]: state.routine[t] } : {};
  }
  render();
});
