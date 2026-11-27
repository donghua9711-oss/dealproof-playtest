// DealProof wiring: hash routing, the search and filter controls, and the
// board render. Filter state lives in the hash (#/?cat=TVs&store=Walmart),
// so every view is a link you can share or bookmark.
import { deals } from "./data.js";
import { filterDeals, sortDeals } from "./logic.js";
import { renderBoard, renderPriceChecks, renderDetail, renderTop5 } from "./views.js";

const boardEl = document.getElementById("board");
const compareEl = document.getElementById("compare");
const controlsEl = document.getElementById("controls");
const searchEl = document.getElementById("search");
const storeEl = document.getElementById("store-select");
const minEl = document.getElementById("min-select");
const sortEl = document.getElementById("sort-select");
const chipsEl = document.getElementById("cat-chips");
const countEl = document.getElementById("result-count");
const top5El = document.getElementById("top5");

// The shopper's shortlist, kept on this device only.
const saved = new Set();
try {
  for (const id of JSON.parse(localStorage.getItem("dealproof.saved") ?? "[]")) saved.add(id);
} catch {
  // Storage unavailable (private mode, sandbox): the shortlist just won't persist.
}
function toggleSave(id) {
  if (saved.has(id)) saved.delete(id);
  else saved.add(id);
  try {
    localStorage.setItem("dealproof.saved", JSON.stringify([...saved]));
  } catch {
    // Non-fatal: saving still works for this visit.
  }
  render();
}

const categories = [...new Set(deals.map((d) => d.category))].sort();
const stores = [...new Set(deals.map((d) => d.store))].sort();

for (const store of stores) {
  const opt = document.createElement("option");
  opt.value = store;
  opt.textContent = store;
  storeEl.append(opt);
}

function chip(label, value, active) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = active ? "chip chip-active" : "chip";
  b.textContent = label;
  b.dataset.cat = value;
  b.setAttribute("aria-pressed", active ? "true" : "false");
  b.addEventListener("click", () => updateHash({ cat: value }));
  return b;
}

function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, query = ""] = raw.split("?");
  const params = new URLSearchParams(query);
  return {
    path,
    state: {
      q: params.get("q") ?? "",
      cat: params.get("cat") ?? "",
      store: params.get("store") ?? "",
      min: Number(params.get("min") ?? 0),
      sort: params.get("sort") ?? "score",
      saved: params.get("saved") ?? "",
    },
  };
}

function updateHash(patch) {
  const { state } = parseHash();
  const next = { ...state, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.cat) params.set("cat", next.cat);
  if (next.store) params.set("store", next.store);
  if (next.min) params.set("min", String(next.min));
  if (next.saved) params.set("saved", next.saved);
  if (next.sort && next.sort !== "score") params.set("sort", next.sort);
  const qs = params.toString();
  location.hash = qs ? `/?${qs}` : "/";
}

function render() {
  const { path, state } = parseHash();

  const dealMatch = path.match(/^\/deal\/(.+)$/);
  if (dealMatch) {
    const deal = deals.find((d) => d.id === dealMatch[1]);
    controlsEl.hidden = true;
    compareEl.hidden = true;
    top5El.hidden = true;
    if (deal) {
      renderDetail(boardEl, deal, deals);
      countEl.textContent = "";
    } else {
      boardEl.replaceChildren();
      const p = document.createElement("p");
      p.className = "empty-state";
      p.textContent = "That deal is not on the board. It may have sold out or been replaced.";
      boardEl.append(p);
    }
    return;
  }

  controlsEl.hidden = false;
  compareEl.hidden = false;

  searchEl.value = state.q;
  storeEl.value = state.store;
  minEl.value = String(state.min);
  sortEl.value = state.sort;

  chipsEl.replaceChildren(
    chip("All categories", "", state.cat === "" && state.saved !== "1"),
    ...categories.map((c) => chip(c, c, state.cat === c)),
  );
  const shortlistChip = document.createElement("button");
  shortlistChip.type = "button";
  shortlistChip.className = state.saved === "1" ? "chip chip-active" : "chip";
  shortlistChip.textContent = `★ Shortlist (${saved.size})`;
  shortlistChip.setAttribute("aria-pressed", state.saved === "1" ? "true" : "false");
  shortlistChip.addEventListener("click", () =>
    updateHash({ saved: state.saved === "1" ? "" : "1", cat: "" }),
  );
  chipsEl.append(shortlistChip);

  // The Top 5 strip fronts the unfiltered board only.
  const unfiltered = !state.q && !state.cat && !state.store && !state.min && state.saved !== "1";
  top5El.hidden = !unfiltered;
  if (unfiltered) renderTop5(top5El, deals);

  let filtered = filterDeals(deals, {
    q: state.q,
    category: state.cat,
    store: state.store,
    minDiscount: state.min,
  });
  if (state.saved === "1") filtered = filtered.filter((d) => saved.has(d.id));
  const list = sortDeals(filtered, state.sort);
  countEl.textContent =
    list.length === deals.length
      ? `Showing all ${list.length} deals, best score first`
      : `Showing ${list.length} of ${deals.length} deals`;
  renderBoard(boardEl, list, { saved, onToggleSave: toggleSave });
  renderPriceChecks(compareEl, deals);
}

searchEl.addEventListener("input", () => updateHash({ q: searchEl.value }));
storeEl.addEventListener("change", () => updateHash({ store: storeEl.value }));
minEl.addEventListener("change", () => updateHash({ min: Number(minEl.value) }));
sortEl.addEventListener("change", () => updateHash({ sort: sortEl.value }));
window.addEventListener("hashchange", render);

render();
