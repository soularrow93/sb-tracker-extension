// SB Tracker v1.1 — manual earnings manager. No host permissions, no automation.
// Changelog v1.1: local-time day boundaries, cashout countdown with ETA,
// per-source + 7/30-day stats, JSON import, safe DOM rendering (no innerHTML
// for user text), extension icons.

const $ = (id) => document.getElementById(id);

// Local (not UTC) date key so "today" matches the user's wall clock.
function dateKey(d) {
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
const todayKey = () => dateKey(new Date());
function keyDaysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return dateKey(d); }

let state = { goal: 100, cashout: 500, entries: [], queue: [] };

function save() { chrome.storage.local.set({ sbTracker: state }); }

function sumWhere(fn) { return state.entries.filter(fn).reduce((s, e) => s + e.sb, 0); }
function dayTotal(key) { return sumWhere(e => e.date === key); }

function computeStreak() {
  let streak = 0;
  const d = new Date();
  if (dayTotal(todayKey()) < state.goal) d.setDate(d.getDate() - 1);
  while (dayTotal(dateKey(d)) >= state.goal && state.goal > 0) { streak++; d.setDate(d.getDate() - 1); }
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
  const lifetime = sumWhere(() => true);

  $("balance").textContent = lifetime;
  $("todayTotal").textContent = tTotal;
  $("goalLabel").textContent = state.goal;
  $("goalInput").value = state.goal;
  $("goalBar").style.width = Math.min(100, (tTotal / state.goal) * 100) + "%";
  $("streak").textContent = "Streak: " + computeStreak() + " days";

  const minsToday = state.entries.filter(e => e.date === today).reduce((s, e) => s + (e.minutes || 0), 0);
  $("todayRate").textContent = minsToday > 0 ? "Today: " + Math.round(tTotal / (minsToday / 60)) + " SB/h" : "";

  // Cashout countdown
  const target = state.cashout || 500;
  const left = Math.max(0, target - lifetime);
  $("cashoutLabel").textContent = target;
  $("cashoutInput").value = target;
  $("cashoutLeft").textContent = left > 0 ? left + " SB to go" : "Target reached 🎉";
  $("cashoutBar").style.width = Math.min(100, (lifetime / target) * 100) + "%";
  const last7 = sumWhere(e => e.date > keyDaysAgo(7));
  const avgDay = last7 / 7;
  $("cashoutEta").textContent = left > 0
    ? (avgDay > 0 ? "At your 7-day pace (" + Math.round(avgDay) + " SB/day): ~" + Math.ceil(left / avgDay) + " days" : "Log a few days of SB to get an ETA")
    : "";

  // Stats: last 7 / 30 days + per-source totals
  const last30 = sumWhere(e => e.date > keyDaysAgo(30));
  const sources = {};
  state.entries.forEach(e => { sources[e.source] = (sources[e.source] || 0) + e.sb; });
  const srcTxt = Object.entries(sources).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + " " + v).join(" · ");
  $("stats").textContent = "Last 7 days: " + last7 + " SB · Last 30 days: " + last30 + " SB" + (srcTxt ? " — " + srcTxt : "");

  const totalMins = state.entries.reduce((s, e) => s + (e.minutes || 0), 0);
  $("rateSummary").textContent = totalMins > 0
    ? "Lifetime: " + lifetime + " SB in " + totalMins + " min (" + Math.round(lifetime / (totalMins / 60)) + " SB/h)"
    : "Lifetime: " + lifetime + " SB";

  const eList = $("entries"); eList.innerHTML = "";
  state.entries.slice(-12).reverse().forEach((e, i) => {
    const realIdx = state.entries.length - 1 - i;
    const rate = e.minutes > 0 ? " · " + (e.sb / e.minutes).toFixed(1) + " SB/min" : "";
    eList.appendChild(li([[e.date.slice(5) + " · " + e.source + " · ", false], [e.sb + " SB", true], [rate, false]],
      () => { state.entries.splice(realIdx, 1); save(); render(); }));
  });

  const qList = $("queue"); qList.innerHTML = "";
  [...state.queue].map((q, i) => ({ ...q, i, rate: q.sb / q.min }))
    .sort((a, b) => b.rate - a.rate)
    .forEach(q => {
      qList.appendChild(li([[q.sb + " SB", true], [" / " + q.min + " min · " + q.rate.toFixed(1) + " SB/min" + (q.note ? " · " + q.note : ""), false]],
        () => { state.queue.splice(q.i, 1); save(); render(); }));
    });
}

$("saveGoal").onclick = () => { const v = parseInt($("goalInput").value, 10); if (v > 0) { state.goal = v; save(); render(); } };
$("saveCashout").onclick = () => { const v = parseInt($("cashoutInput").value, 10); if (v > 0) { state.cashout = v; save(); render(); } };

$("addEntry").onclick = () => {
  const sb = parseInt($("sbAmount").value, 10);
  const minutes = parseInt($("sbMinutes").value, 10) || 0;
  if (!sb || sb <= 0) return;
  state.entries.push({ date: todayKey(), sb, minutes, source: $("sbSource").value });
  $("sbAmount").value = ""; $("sbMinutes").value = "";
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
      state = { goal: data.goal > 0 ? data.goal : 100, cashout: data.cashout > 0 ? data.cashout : 500, entries: data.entries, queue: data.queue };
      save(); render();
    } catch (err) { alert("Import failed: not a valid SB Tracker export."); }
  };
  reader.readAsText(file);
  ev.target.value = "";
};

chrome.storage.local.get("sbTracker", (res) => {
  if (res.sbTracker) {
    state = res.sbTracker;
    if (!state.cashout) state.cashout = 500;
  }
  render();
});
