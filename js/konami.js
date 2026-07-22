// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// konami.js — ↑↑↓↓←→←→BA Enter

import { mutate, loadState } from "./state.js";
import { play } from "./sound.js";
import { unlock, toast } from "./achievements.js";

const SEQ = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a","Enter"];

export function initKonami() {
  let buf = [];
  document.addEventListener("keydown", (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    buf.push(k);
    if (buf.length > SEQ.length) buf = buf.slice(-SEQ.length);
    if (buf.length === SEQ.length && buf.every((v, i) => v === SEQ[i])) {
      buf = [];
      activate();
    }
  });
}

function activate() {
  const s = loadState();
  if (!s.dev_unlocked) {
    mutate(st => {
      st.dev_unlocked = true;
      st.special = { S:10, P:10, E:10, C:10, I:10, A:10, L:10 };
      st.caps = Math.max(st.caps, 99999);
      st.found_bobbleheads = ["S","P","E","C","I","A","L"];
      st.perks = Array.from(new Set([...st.perks, "bloody_mess", "lone_wanderer", "mysterious_stranger", "black_widow", "mr_sandman", "cannibal", "wild_wasteland_perk"]));
    });
    unlock("konami_coder", "ACHIEVEMENT UNLOCKED", "Konami Coder — DEV ROOM accessed");
    showCodsworth();
    play("unlock");
  } else {
    // Nuclear Winter
    mutate(st => { st.nuclear_winter = !st.nuclear_winter; });
    document.documentElement.dataset.nuclear = loadState().nuclear_winter ? "1" : "";
    toast("NUCLEAR WINTER", loadState().nuclear_winter ? "PALETTE INVERTED — 30s" : "PALETTE RESTORED");
    play("error");
    if (loadState().nuclear_winter) {
      setTimeout(() => {
        mutate(st => { st.nuclear_winter = false; });
        document.documentElement.dataset.nuclear = "";
      }, 30_000);
    }
  }
}

const CODSWORTH_LINES = [
  "Sir/madam — top of the morning to you!",
  "I do hope the wasteland is treating you kindly.",
  "Shall I prepare a Salisbury steak? Oh — right.",
  "Affirmative, sir/madam, affirmative!",
  "It's a wonderful day in Sanctuary, isn't it?",
  "Do mind the radroaches, would you?",
  "The Mister Handy line was cutting-edge in 2077.",
];

function showCodsworth() {
  const el = document.getElementById("codsworth");
  let i = 0;
  el.textContent = "🤖 " + CODSWORTH_LINES[0];
  el.hidden = false;
  setInterval(() => {
    i = (i + 1) % CODSWORTH_LINES.length;
    el.textContent = "🤖 " + CODSWORTH_LINES[i];
  }, 12_000);
}
