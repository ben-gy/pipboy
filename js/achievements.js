// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// achievements.js — toast system + persistence.

import { loadState, mutate } from "./state.js";
import { play } from "./sound.js";

let _root = null;

export function initAchievements() {
  _root = document.getElementById("toasts");
}

export function unlock(id, title, sub) {
  const s = loadState();
  if (!_root) return;
  if (s.achievements.includes(id)) return;
  mutate(state => {
    if (!state.achievements.includes(id)) state.achievements.push(id);
  });
  toast(title, sub);
  play("achievement");
}

export function toast(title, sub) {
  if (!_root) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<div class="t-title">${title}</div>` + (sub ? `<div class="t-sub">${sub}</div>` : "");
  _root.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// short-form
export const t = toast;
