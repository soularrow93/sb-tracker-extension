// SB Tracker — manual earnings manager. No host permissions, no automation.
const $ = (id) => document.getElementById(id);
const todayKey = () => new Date().toISOString().slice(0, 10);

let state = { goal: 100, entries: [], queue: [], days: {} };

function save() { chrome.storage.local.set({ sbTracker: state }); }

function dayTotal(date) {
  return state.entries.filter(e => e.date === date).reduce((s, e) => s + e.sb, 0);
}

function computeStreak() {
  let streak = 0;
  const d = new Date();
  // If today hasn't hit goal yet, start counting from yesterday.
  if (dayTotal(todayKey()) < state.goal) d.setDate(d.getDate() - 1);
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (dayTotal(key) >= state.goal) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

function render() {
  const today = todayKey();
  const tTotal = dayTotal(today);
  const lifetime = state.entries.reduce((s, e) => s + e.sb, 0);
  $("balance").textContent = lifetime;
  $("todayTotal").textContent = tTotal;
  $("goalLabel").textContent = state.goal;
  $("goalInput").value = state.goal;
  $("goalBar").style.width = Math.min(100, (tTotal / state.goal) * 100) + "%";
  $("streak").textContent = "Streak: " + computeStreak() + " days";

  const mins = state.entries.filter(e => e.date === today).reduce((s, e) => s + (e.minutes || 0), 0);
  $("todayRate").textContent = mins > 0 ? "Today's rate: " + Math.round(tTotal / (mins / 60)) + " SB/h" : "";

  const totalMins = state.entries.reduce((s, e) => s + (e.minutes || 0), 0);
  $("rateSummary").textContent = totalMins > 0
    ? "Lifetime: " + lifetime + " SB in " + totalMins + " min (" + Math.round(lifetime / (totalMins / 60)) + " SB/h)"
    : "Lifetime: " + lifetime + " SB";

  $("entries").innerHTML = state.entries.slice(-12).reverse().map((e, i) => {
    const realIdx = state.entries.length - 1 - i;
    const rate = e.minutes > 0 ? " · " + (e.sb / e.minutes).toFixed(1) + " SB/min" : "";
    return `<li><span>${e.date.slice(5)} · ${e.source} · <b>${e.sb} SB</b>${rate}</span><button class="del" data-i="${realIdx}">✕</button></li>`;
  }).join("");

  const sorted = [...state.queue].map((q, i) => ({ ...q, i, rate: q.sb / q.min }))
    .sort((a, b) => b.rate - a.rate);
  $("queue").innerHTML = sorted.map(q =>
    `<li><span><b>${q.sb} SB</b> / ${q.min} min · ${q.rate.toFixed(1)} SB/min ${q.note ? "· " + q.note : ""}</span><button class="del" data-q="${q.i}">✕</button></li>`
  ).join("");

  document.querySelectorAll("#entries .del").forEach(b => b.onclick = () => { state.entries.splice(+b.dataset.i, 1); save(); render(); });
  document.querySelectorAll("#queue .del").forEach(b => b.onclick = () => { state.queue.splice(+b.dataset.q, 1); save(); render(); });
}

$("saveGoal").onclick = () => { const v = parseInt($("goalInput").value, 10); if (v > 0) { state.goal = v; save(); render(); } };

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

chrome.storage.local.get("sbTracker", (res) => {
  if (res.sbTracker) state = res.sbTracker;
  render();
});
