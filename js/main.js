// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// main.js — entry point. Boot → state hydrate → tabs → easter eggs.

import { loadState, saveState, mutate, subscribe, karmaTitle } from "./state.js";
import { runBoot, quickBoot } from "./boot.js";
import { play, setVolume } from "./sound.js";
import * as tabs from "./tabs.js";
import { initKonami } from "./konami.js";
import { initConsole } from "./console.js";
import { initStranger } from "./stranger.js";
import { initBobbleheads } from "./bobbleheads.js";
import { initAchievements, unlock } from "./achievements.js";
import { setBgVar, exists } from "./img.js";

const $ = (s) => document.querySelector(s);

function setTheme(theme) {
  document.documentElement.dataset.theme = theme === "green" ? "" : theme;
  if (theme === "green") delete document.documentElement.dataset.theme;
}

function refreshStatusBar(state) {
  $("#bar-hp").style.width  = (state.hp / state.hp_max * 100) + "%";
  $("#num-hp").textContent  = state.hp;
  $("#bar-ap").style.width  = (state.ap / state.ap_max * 100) + "%";
  $("#num-ap").textContent  = state.ap;
  $("#bar-rad").style.width = (state.rad / state.rad_max * 100) + "%";
  $("#num-rad").textContent = state.rad;
  $("#num-caps").textContent = state.caps;
  $("#num-lvl").textContent  = state.level;

  // weight calc
  let wgt = 0;
  for (const cat of Object.values(state.inventory || {})) {
    for (const it of cat) {
      const q = it.qty ?? 1;
      wgt += (it.weight || 0) * q;
    }
  }
  const cap = 150 + (state.special?.S || 5) * 10;
  $("#num-wgt").textContent = `${Math.round(wgt)}/${cap}`;
  $("#vault-tag").textContent = `VAULT ${String(state.vault_number).padStart(3, "0")}`;
}

function refreshBattery(state) {
  const el = $("#battery");
  if (!el) return;
  el.style.setProperty("--bv", state.battery_pct + "%");
  el.querySelector(".bv").textContent = state.battery_pct + "%";
}

function batteryDrain() {
  const tick = () => {
    mutate(s => { s.battery_pct = Math.max(0, s.battery_pct - 1); });
    refreshBattery(loadState());
  };
  setInterval(tick, 60_000);
  // tap → recharge
  $("#battery").addEventListener("click", () => {
    mutate(s => { s.battery_pct = 100; });
    refreshBattery(loadState());
    play("achievement");
    unlock("fusion_charge", "FUSION CELL CHARGED", "+1 generosity");
  });
}

function aboutDialog() {
  const dlg = $("#about-dialog");
  $("#about-btn").addEventListener("click", () => dlg.showModal());
  $("#about-close").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => {
    const r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
      dlg.close();
    }
  });
}

function themeCycle() {
  const order = ["green", "amber", "blue", "white"];
  const click = () => {
    const s = loadState();
    const idx = order.indexOf(s.theme);
    const next = order[(idx + 1) % order.length];
    setTheme(next);
    mutate(st => { st.theme = next; });
    play("tab_click");
  };
  $("#theme-cycle").addEventListener("click", click);
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "p") {
      e.preventDefault();
      click();
    }
  });
}

function radroachLoop() {
  const screen = $("#screen");
  const spawn = () => {
    if (Math.random() < 0.5) return; // 50% per tick
    const w = screen.clientWidth;
    const h = screen.clientHeight;

    // Keep the roach in the content band: below the tabs (~70px) and above
    // the status bar (~50px). Also keep a small horizontal margin off-screen
    // for the spawn so it crawls in.
    const TOP_BAND  = 80;
    const BOT_BAND  = h - 70;
    const y = TOP_BAND + Math.random() * Math.max(40, BOT_BAND - TOP_BAND);

    const fromLeft = Math.random() < 0.5;
    let x = fromLeft ? -30 : w + 30;
    const dx = fromLeft ? 1.4 : -1.4;

    const r = document.createElement("div");
    r.className = "radroach";
    r.style.top = y + "px";
    r.style.left = x + "px";
    if (!fromLeft) r.style.transform = "scaleX(-1)";
    screen.appendChild(r);
    play("radroach");

    let alive = true;
    r.addEventListener("click", () => {
      alive = false;
      r.remove();
      mutate(s => { s.caps += 1; s.radroach_kills = (s.radroach_kills || 0) + 1; });
      play("achievement");
      refreshStatusBar(loadState());
      if (loadState().radroach_kills === 10) {
        unlock("exterminator", "ACHIEVEMENT", "Exterminator — 10 radroaches squashed");
      }
    }, { once: true });

    const step = () => {
      if (!alive) return;
      x += dx;
      r.style.left = x + "px";
      if (x < -60 || x > w + 60) {
        r.remove();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  setInterval(spawn, 25_000);
}

function screensaver() {
  const ss = $("#screensaver");
  let timer = null;
  const reset = () => {
    if (ss.hidden === false) ss.hidden = true;
    clearTimeout(timer);
    timer = setTimeout(() => { ss.hidden = false; }, 60_000);
  };
  ["pointermove", "keydown", "click", "touchstart"].forEach(ev =>
    document.addEventListener(ev, reset, { passive: true })
  );
  reset();
}

async function start() {
  const state = loadState();
  setTheme(state.theme || "green");
  if (state.nuclear_winter) document.documentElement.dataset.nuclear = "1";

  // Set CSS background vars: prefer real PNGs from /assets/img/ when present,
  // fall back to original SVG art shipped with the project.
  setBgVar("--vault-boy-svg",  "vault-boy.png",  "vault-boy");
  setBgVar("--mr-handy-svg",   "mister-handy.png", "vault-boy"); // re-used as fallback
  setBgVar("--radroach-svg",   "radroach.png",   null);

  // Boot
  const bootEl = $("#boot");
  const isReturning = !!state.last_seen && (Date.now() - state.last_seen < 1000 * 60 * 60 * 8);
  if (isReturning) {
    await quickBoot(bootEl);
  } else {
    await runBoot(bootEl, { handle: "DWELLER " + state.vault_number });
  }
  mutate(s => { s.last_seen = Date.now(); });

  // Reveal UI
  $("#ui").hidden = false;
  refreshStatusBar(loadState());
  refreshBattery(loadState());
  subscribe(refreshStatusBar);

  // Init systems
  tabs.init();
  initKonami();
  initConsole();
  initStranger();
  initBobbleheads();
  initAchievements();
  aboutDialog();
  themeCycle();
  batteryDrain();
  radroachLoop();
  screensaver();

  // First-run achievement
  if (!state.achievements.includes("first_steps")) {
    unlock("first_steps", "ACHIEVEMENT UNLOCKED", "First Steps — Leave the Vault");
  }

  // Save play time
  setInterval(() => {
    mutate(s => { s.play_seconds = (s.play_seconds || 0) + 30; });
  }, 30_000);

  // Save on unload
  addEventListener("beforeunload", () => {
    mutate(s => { s.last_seen = Date.now(); });
    saveState();
  });
}

start().catch(err => {
  console.error(err);
  document.body.innerHTML = `<pre style="color:var(--phosphor);background:var(--phosphor-deep);padding:24px;font-family:monospace;border:2px dashed var(--phosphor);">FATAL ERROR\n\n${err.stack || err.message}</pre>`;
});
