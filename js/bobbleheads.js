// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// bobbleheads.js — 7 hidden bobbleheads scattered as tiny pixels across tabs.
// One per SPECIAL letter. Tracked in state.found_bobbleheads.

import { mutate, loadState } from "./state.js";
import { unlock, toast } from "./achievements.js";
import { play } from "./sound.js";

// Map letter → tab where the pixel hides.
export const HIDING_PLACES = {
  S: "stats",  // hidden in the SPECIAL section near the S stat
  P: "inv",    // hidden in the weapons header
  E: "data",   // hidden in the encrypted holotape
  C: "map",    // hidden near a city marker
  I: "radio",  // hidden in DJ ticker
  A: "stats",  // hidden in the perks block
  L: "data",   // hidden in achievements list
};

export function initBobbleheads() {
  // Wire up clicks via event delegation; tab modules emit pixels with data-bobble="X".
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-bobble]");
    if (!t) return;
    const letter = t.dataset.bobble;
    const s = loadState();
    if (s.found_bobbleheads.includes(letter)) return;
    mutate(st => {
      if (!st.found_bobbleheads.includes(letter)) {
        st.found_bobbleheads.push(letter);
      }
      // Each bobblehead also bumps the corresponding SPECIAL by +1 (lore).
      if (st.special && letter in st.special && st.special[letter] < 10) {
        st.special[letter]++;
      }
      st.caps += 50;
    });
    t.classList.add("found");
    play("achievement");
    toast("BOBBLEHEAD: " + letter, `+1 ${special_name(letter)}, +50 caps`);

    const found = loadState().found_bobbleheads.length;
    if (found === 7) {
      unlock("bobble_hunter", "ACHIEVEMENT", "Bobblehead Hunter — collected all seven");
    }
  });
}

function special_name(l) {
  return ({
    S: "STR", P: "PER", E: "END", C: "CHA", I: "INT", A: "AGI", L: "LCK",
  })[l] || l;
}

export function bobblePixel(letter) {
  // Helper for tab modules: returns an HTML string for a hidden pixel.
  const s = loadState();
  const found = s.found_bobbleheads.includes(letter);
  return `<span class="bobblepixel ${found ? "found" : ""}" data-bobble="${letter}" title="${found ? "" : "..."}"></span>`;
}
