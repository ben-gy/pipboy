// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// canvas-helpers.js — tiny shared utilities for canvas mini-games.

import { play } from "../sound.js";
import { mutate, loadState } from "../state.js";

// While true, tab modules should suppress re-renders so the game doesn't get clobbered.
export let gameRunning = false;

export function makeShell({ title, onExit }) {
  const wrap = document.createElement("div");
  wrap.className = "game";
  wrap.innerHTML = `
    <div class="game-header">
      <span class="title">${title}</span>
      <span class="meta">
        <span id="g-score">SCORE 0</span>
        <span id="g-extra"></span>
      </span>
      <button class="eject" id="g-eject">EJECT</button>
    </div>
    <div class="game-body" id="g-body"></div>
  `;
  // Append to #screen so the game overlays the entire Pip-Boy display.
  document.getElementById("screen").appendChild(wrap);
  gameRunning = true;

  const shell = {
    wrap,
    body: wrap.querySelector("#g-body"),
    score: wrap.querySelector("#g-score"),
    extra: wrap.querySelector("#g-extra"),
    // Mutable cleanup. Game modules can wrap this to add tear-down (rAF cancel, listeners).
    cleanup() {
      if (!wrap.isConnected) return;
      wrap.remove();
      gameRunning = false;
      onExit?.();
    },
  };

  // ESC + Eject both go through shell.cleanup so wrapping by callers takes effect.
  const onKey = (e) => { if (e.key === "Escape") shell.cleanup(); };
  document.addEventListener("keydown", onKey);
  wrap.querySelector("#g-eject").addEventListener("click", () => shell.cleanup());

  // Always remove the ESC listener when shell tears down.
  const baseCleanup = shell.cleanup.bind(shell);
  shell.cleanup = () => {
    document.removeEventListener("keydown", onKey);
    baseCleanup();
  };

  return shell;
}

// Helper: append additional teardown work (e.g. cancelAnimationFrame) onto shell.cleanup.
export function onCleanup(shell, fn) {
  const prev = shell.cleanup.bind(shell);
  shell.cleanup = () => { try { fn(); } catch (e) { console.warn(e); } prev(); };
}

export function isGameRunning() { return gameRunning; }

// Read the current phosphor color (theme-aware) for canvas drawing.
// `level` can be: "fg" (full), "dim", "deep", "mid", "line".
export function phosphor(level = "fg") {
  const map = {
    fg:   "--phosphor",
    dim:  "--phosphor-dim",
    deep: "--phosphor-deep",
    mid:  "--phosphor-mid",
    line: "--phosphor-line",
  };
  const v = getComputedStyle(document.documentElement).getPropertyValue(map[level] || "--phosphor").trim();
  return v || "#5fff66";
}

export function makeCanvas(parent, w, h) {
  const wrap = document.createElement("div");
  wrap.className = "game-canvas-wrap";
  const c = document.createElement("canvas");
  c.className = "game-canvas";
  c.width = w; c.height = h;
  wrap.appendChild(c);
  parent.appendChild(wrap);
  return c;
}

export function loop(fn) {
  let raf = 0;
  let last = performance.now();
  let stopped = false;
  const tick = (now) => {
    if (stopped) return;
    const dt = Math.min(50, now - last) / 1000;
    last = now;
    fn(dt);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => { stopped = true; cancelAnimationFrame(raf); };
}

export function input() {
  const keys = new Set();
  const ondown = (e) => { keys.add(e.key); };
  const onup   = (e) => { keys.delete(e.key); };
  window.addEventListener("keydown", ondown);
  window.addEventListener("keyup",   onup);
  return {
    has: (k) => keys.has(k),
    any: (...ks) => ks.some(k => keys.has(k)),
    destroy() {
      window.removeEventListener("keydown", ondown);
      window.removeEventListener("keyup",   onup);
    },
  };
}

export function touchPad(parent, opts = {}) {
  const pad = document.createElement("div");
  pad.className = "touch-pad";
  pad.innerHTML = `
    <div class="group dpad">
      ${(opts.pad || ["←","→","↑","↓"]).map(l => `<button data-k="${l}">${l}</button>`).join("")}
    </div>
    <div class="group">
      ${(opts.actions || ["A"]).map(l => `<button data-k="${l}">${l}</button>`).join("")}
    </div>
  `;
  parent.appendChild(pad);
  const pressed = new Set();
  pad.querySelectorAll("button").forEach(b => {
    const k = b.dataset.k;
    const down = (e) => { e.preventDefault(); pressed.add(k); };
    const up   = (e) => { e.preventDefault(); pressed.delete(k); };
    b.addEventListener("pointerdown", down);
    b.addEventListener("pointerup",   up);
    b.addEventListener("pointercancel", up);
    b.addEventListener("pointerleave", up);
  });
  return {
    has: (k) => pressed.has(k),
    pad,
  };
}

export function recordHighScore(gameId, score) {
  mutate(s => {
    if ((s.high_scores[gameId] || 0) < score) s.high_scores[gameId] = score;
    s.caps += Math.max(1, Math.floor(score / 10));
  });
}

export function gameOver(parent, message, sub, onAgain) {
  const o = document.createElement("div");
  o.className = "game-over";
  o.innerHTML = `
    <div>${message}<span class="sub">${sub}</span><br><button class="btn" style="margin-top:18px" id="again">PLAY AGAIN</button></div>
  `;
  parent.appendChild(o);
  o.querySelector("#again").addEventListener("click", () => { o.remove(); onAgain?.(); });
  play("error");
}
