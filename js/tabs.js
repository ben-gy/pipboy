// tabs.js — top-level tab router. Lazy-loads each tab module.
// Each tab module exports: mount(el, ctx) and unmount().

import { play } from "./sound.js";
import { mutate, loadState } from "./state.js";

const TAB_MODS = {
  stats: () => import("./tabs/stats.js"),
  inv:   () => import("./tabs/inv.js"),
  data:  () => import("./tabs/data.js"),
  map:   () => import("./tabs/map.js"),
  radio: () => import("./tabs/radio.js"),
};

let _current = null;
let _currentMod = null;

export async function switchTo(name) {
  if (!TAB_MODS[name]) return;
  if (_current === name) return;

  const content = document.getElementById("content");
  const subtabs = document.getElementById("subtabs");

  // Unmount old
  if (_currentMod && _currentMod.unmount) {
    try { _currentMod.unmount(); } catch (e) { console.warn(e); }
  }
  content.innerHTML = "";
  subtabs.innerHTML = "";

  // Update tab visuals
  document.querySelectorAll(".tabs .tab").forEach(b => {
    b.setAttribute("aria-selected", b.dataset.tab === name ? "true" : "false");
  });

  // Mount new
  const mod = await TAB_MODS[name]();
  _currentMod = mod;
  _current = name;
  mod.mount(content, { subtabs });

  mutate(s => { s.last_tab = name; });
  play("tab_click");
}

export function init() {
  document.querySelectorAll(".tabs .tab").forEach(b => {
    b.addEventListener("click", () => switchTo(b.dataset.tab));
  });
  // restore last tab
  const s = loadState();
  switchTo(s.last_tab || "stats");

  // Keyboard tab navigation: 1-5
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea")) return;
    const map = { "1": "stats", "2": "inv", "3": "data", "4": "map", "5": "radio" };
    if (map[e.key]) switchTo(map[e.key]);
  });
}

export function current() { return _current; }
