"use strict";

/* Leonida Trophy Guide: checklist, roadmap, spoiler guard, export/import.
   Loads only its own files (data/trophies.json, data/roadmap.json) and
   keeps progress in localStorage. No network request is ever made. */

const EARNED_KEY = "gta6-trophy-guide-earned-v1";
const SPOILER_KEY = "gta6-trophy-guide-spoiler-v1";
const GRADE_TOTALS = { platinum: 1, gold: 2, silver: 6, bronze: 46 };
const GRADE_LABELS = { platinum: "Platinum", gold: "Gold", silver: "Silver", bronze: "Bronze" };

const state = {
  trophies: [],
  roadmap: null,
  earned: new Set(),
  spoilerOn: true,
  filter: "all",
  query: "",
  view: "list",
  openGuideId: null,
  byId: new Map(),
};

const $ = (id) => document.getElementById(id);

function readStoredEarned() {
  try {
    const raw = localStorage.getItem(EARNED_KEY);
    if (!raw) return new Set();
    const ids = JSON.parse(raw);
    return new Set(Array.isArray(ids) ? ids.filter((n) => Number.isInteger(n)) : []);
  } catch (err) {
    return new Set();
  }
}

function saveEarned() {
  try {
    localStorage.setItem(EARNED_KEY, JSON.stringify([...state.earned].sort((a, b) => a - b)));
  } catch (err) {
    /* Storage may be unavailable in a private window; progress still shows. */
  }
}

function readStoredSpoiler() {
  try {
    const raw = localStorage.getItem(SPOILER_KEY);
    return raw === null ? true : raw === "true";
  } catch (err) {
    return true;
  }
}

function saveSpoiler() {
  try {
    localStorage.setItem(SPOILER_KEY, String(state.spoilerOn));
  } catch (err) {
    /* Ignore storage failures; the toggle still works for this visit. */
  }
}

function applyUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  if (view === "roadmap" || view === "list") state.view = view;
  const filter = params.get("filter");
  if (["all", "story", "missable", "collectibles", "activities", "earned", "remaining"].includes(filter)) {
    state.filter = filter;
  }
  const spoiler = params.get("spoiler");
  if (spoiler === "on") state.spoilerOn = true;
  if (spoiler === "off") state.spoilerOn = false;
  const checked = params.get("checked");
  if (checked) {
    for (const part of checked.split(",")) {
      const id = Number.parseInt(part.trim(), 10);
      if (Number.isInteger(id)) state.earned.add(id);
    }
    saveEarned();
  }
  const trophy = params.get("trophy");
  if (trophy) {
    const id = Number.parseInt(trophy, 10);
    if (Number.isInteger(id)) state.openGuideId = id;
  }
}

function trophyIsSpoiled(trophy) {
  return state.spoilerOn && trophy.kind === "story" && !state.earned.has(trophy.id);
}

function trophyMatches(trophy) {
  const earned = state.earned.has(trophy.id);
  switch (state.filter) {
    case "story": if (trophy.kind !== "story") return false; break;
    case "missable": if (!trophy.missable) return false; break;
    case "collectibles": if (trophy.kind !== "collectibles") return false; break;
    case "activities": if (trophy.kind !== "activities") return false; break;
    case "earned": if (!earned) return false; break;
    case "remaining": if (earned) return false; break;
    default: break;
  }
  if (state.query) {
    const hay = (trophy.name + " " + trophy.description + " " + trophy.group).toLowerCase();
    if (!hay.includes(state.query)) return false;
  }
  return true;
}

function gradeBadge(trophy) {
  return '<span class="badge badge-' + trophy.grade + '">' + GRADE_LABELS[trophy.grade] + "</span>";
}

function trophyCard(trophy) {
  const earned = state.earned.has(trophy.id);
  const spoiled = trophyIsSpoiled(trophy);
  const open = state.openGuideId === trophy.id;
  const name = spoiled ? "Hidden story trophy" : trophy.name;
  const desc = spoiled ? "Earn this trophy to reveal its name and description." : trophy.description;
  const nameClass = spoiled ? "trophy-name masked" : "trophy-name";
  const descClass = spoiled ? "trophy-desc masked" : "trophy-desc";
  const countTag = trophy.count === null ? "" :
    '<span class="tag tag-count">Target: ' + trophy.count.toLocaleString("en-US") + "</span>";
  const missableTag = trophy.missable ?
    '<span class="tag tag-missable">⚠ Missable</span>' : "";
  const hiddenTag = trophy.hidden ?
    '<span class="tag">Hidden on PS5</span>' : "";
  const sources = trophy.sources.map((s) => s).join(", ");
  const guideBox = open ?
    '<div class="guide-box"><h4>Guide</h4><p>' + trophy.guide + "</p>" +
    '<p class="guide-sources"><strong>Sources:</strong> ' + sources + ".</p></div>" : "";
  const item = document.createElement("li");
  item.className = "trophy-card" + (earned ? " is-earned" : "") + (open ? " is-open" : "");
  item.id = "trophy-" + trophy.id;
  item.innerHTML =
    '<input type="checkbox" class="trophy-check" data-id="' + trophy.id + '"' +
    (earned ? " checked" : "") + ' aria-label="Mark ' + name + ' earned">' +
    '<div><div class="trophy-head">' + gradeBadge(trophy) +
    '<h3 class="' + nameClass + '">' + name + "</h3></div>" +
    '<p class="' + descClass + '">' + desc + "</p>" +
    '<div class="trophy-head"><span class="tag">' + trophy.group + "</span>" +
    countTag + missableTag + hiddenTag +
    '<button type="button" class="guide-btn" data-id="' + trophy.id + '">' +
    (open ? "Hide guide" : "Show guide") + "</button></div>" +
    guideBox + "</div>";
  return item;
}

function renderList() {
  const list = $("trophyList");
  list.textContent = "";
  const shown = state.trophies.filter(trophyMatches);
  for (const trophy of shown) list.appendChild(trophyCard(trophy));
  $("emptyNote").hidden = shown.length !== 0;
  $("countLine").textContent =
    "Showing " + shown.length + " of " + state.trophies.length + " trophies" +
    (state.filter === "missable" ? " — only Positive Mental Attitude is possibly missable." : "");
}

function renderProgress() {
  const total = state.trophies.length || 55;
  const earnedCount = state.earned.size;
  const pct = total ? Math.round((earnedCount / total) * 100) : 0;
  $("progressCount").textContent = earnedCount + " / " + total + " earned";
  $("progressPct").textContent = pct + "%";
  $("progressFill").style.width = pct + "%";
  const byGrade = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  for (const trophy of state.trophies) {
    if (state.earned.has(trophy.id)) byGrade[trophy.grade] += 1;
  }
  $("gradeLine").textContent =
    "Platinum " + byGrade.platinum + "/" + GRADE_TOTALS.platinum +
    " · Gold " + byGrade.gold + "/" + GRADE_TOTALS.gold +
    " · Silver " + byGrade.silver + "/" + GRADE_TOTALS.silver +
    " · Bronze " + byGrade.bronze + "/" + GRADE_TOTALS.bronze;
}

function renderRoadmap() {
  if (!state.roadmap) return;
  $("roadmapEstimate").textContent = state.roadmap.estimate;
  const list = $("roadmapList");
  list.textContent = "";
  for (const stage of state.roadmap.stages) {
    const done = stage.trophies.filter((id) => state.earned.has(id)).length;
    const item = document.createElement("li");
    item.className = "roadmap-step";
    const chips = stage.trophies.map((id) => {
      const trophy = state.byId.get(id);
      const label = trophy ? trophy.name : "Trophy " + id;
      return '<span class="roadmap-trophy' + (state.earned.has(id) ? " done" : "") + '">' + label + "</span>";
    }).join("");
    item.innerHTML =
      "<h3><span class=\"step-num\">" + stage.step + "</span>" + stage.title + "</h3>" +
      '<p class="roadmap-meta">' + stage.hours + " · " + done + " of " + stage.trophies.length + " trophies earned</p>" +
      "<p>" + stage.text + "</p>" +
      '<div class="roadmap-trophies">' + chips + "</div>";
    list.appendChild(item);
  }
}

function renderAll() {
  renderProgress();
  renderList();
  renderRoadmap();
  $("spoilerBox").checked = state.spoilerOn;
  $("spoilerNote").textContent = state.spoilerOn ?
    "Spoiler guard is on: story trophies stay masked until you tick them earned. Turn it off to reveal every name." :
    "Spoiler guard is off: every story trophy name and description is visible.";
  for (const btn of document.querySelectorAll(".filter-btn")) {
    btn.classList.toggle("is-active", btn.dataset.filter === state.filter);
  }
  for (const btn of document.querySelectorAll(".view-btn")) {
    btn.classList.toggle("is-active", btn.dataset.view === state.view);
  }
  $("listView").hidden = state.view !== "list";
  $("roadmapView").hidden = state.view !== "roadmap";
}

function setView(view) {
  state.view = view;
  renderAll();
}

function exportProgress() {
  const payload = {
    guide: "GTA 6 Trophy Guide — Leonida Trophy Guide",
    exportedAt: new Date().toISOString(),
    earned: [...state.earned].sort((a, b) => a - b),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "gta6-trophy-progress.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importProgressFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      const ids = Array.isArray(data) ? data : data.earned;
      if (!Array.isArray(ids)) throw new Error("No earned list in file");
      const next = new Set();
      for (const id of ids) {
        if (Number.isInteger(id) && state.byId.has(id)) next.add(id);
      }
      state.earned = next;
      saveEarned();
      renderAll();
    } catch (err) {
      window.alert("That file is not a progress export from this guide.");
    }
  };
  reader.readAsText(file);
}

function bindEvents() {
  $("trophyList").addEventListener("change", (event) => {
    const box = event.target;
    if (!box.classList || !box.classList.contains("trophy-check")) return;
    const id = Number.parseInt(box.dataset.id, 10);
    if (box.checked) state.earned.add(id); else state.earned.delete(id);
    saveEarned();
    renderAll();
  });
  $("trophyList").addEventListener("click", (event) => {
    const btn = event.target.closest(".guide-btn");
    if (!btn) return;
    const id = Number.parseInt(btn.dataset.id, 10);
    state.openGuideId = state.openGuideId === id ? null : id;
    renderList();
  });
  $("searchBox").addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderList();
  });
  $("filterBar").addEventListener("click", (event) => {
    const btn = event.target.closest(".filter-btn");
    if (!btn) return;
    state.filter = btn.dataset.filter;
    renderAll();
  });
  document.querySelector(".views").addEventListener("click", (event) => {
    const btn = event.target.closest(".view-btn");
    if (!btn) return;
    setView(btn.dataset.view);
  });
  $("spoilerBox").addEventListener("change", (event) => {
    state.spoilerOn = event.target.checked;
    saveSpoiler();
    renderAll();
  });
  $("exportBtn").addEventListener("click", exportProgress);
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", (event) => {
    if (event.target.files && event.target.files[0]) importProgressFile(event.target.files[0]);
    event.target.value = "";
  });
  $("resetBtn").addEventListener("click", () => {
    if (window.confirm("Clear all earned ticks?")) {
      state.earned = new Set();
      saveEarned();
      renderAll();
    }
  });
}

async function loadGuideData() {
  const trophyResponse = await fetch("./data/trophies.json");
  const trophyData = await trophyResponse.json();
  state.trophies = trophyData.trophies;
  for (const trophy of state.trophies) state.byId.set(trophy.id, trophy);
  const roadmapResponse = await fetch("./data/roadmap.json");
  state.roadmap = await roadmapResponse.json();
}

async function startGuide() {
  state.earned = readStoredEarned();
  state.spoilerOn = readStoredSpoiler();
  applyUrlParams();
  bindEvents();
  await loadGuideData();
  renderAll();
  /* No automatic scrolling: a trophy opened from a link is shown by the
     list itself (a filtered view puts it at the top), so the page never
     lands on empty space below the content. */
}

document.addEventListener("DOMContentLoaded", () => {
  startGuide().catch(() => {
    $("countLine").textContent = "Could not load the trophy data. Check that data/trophies.json sits beside this page.";
  });
});
