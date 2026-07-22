// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// boot.js — ROBCO startup sequence.
// Renders typewriter-style boot lines into #boot, then resolves.

import { play } from "./sound.js";

const VAULT_TEC_LOGO = String.raw`
        .--.
       / .. \
      |  ()  |   VAULT-TEC
       \/__\/    AMERICA'S FUTURE
       _||_      THANK YOU FOR
      |____|     CHOOSING US.
`.trimEnd();

const ROBCO_LOGO = String.raw`
   ____  ___  ____  __  ___    ___  _   _____
  / __ \/ _ \/ __ )/ / / _ \  /   |/ | / / _ \
 / /_/ / // / __  / /_/ , _/ / /| / |//  __/
 \____/\___/_____/\__/_/|_|  / /_/_/  \___/

       UNIFIED OPERATING SYSTEM
`.trimEnd();

const PRIME_LINES = [
  "DEMOCRACY... IS NON-NEGOTIABLE.",
  "COMMUNISM IS THE VERY DEFINITION OF FAILURE.",
  "OBSTRUCTION DETECTED. ANALYZING.",
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function typeLine(el, text, speed = 12) {
  for (let i = 0; i < text.length; i++) {
    el.textContent += text[i];
    if (i % 4 === 0) play("key_press");
    await sleep(speed);
  }
  el.appendChild(document.createElement("br"));
}

function rawLine(parent, text, cls = "") {
  const div = document.createElement("div");
  if (cls) div.className = cls;
  div.textContent = text;
  parent.appendChild(div);
  return div;
}

export async function runBoot(rootEl, opts = {}) {
  rootEl.innerHTML = "";
  rootEl.hidden = false;

  const screen = document.getElementById("screen");
  screen.classList.add("poweron");

  // power-on flash
  await sleep(300);
  screen.classList.remove("poweron");
  play("boot_chime");

  // ROBCO header
  const head = rawLine(rootEl, "", "ascii");
  head.textContent = ROBCO_LOGO;
  await sleep(500);

  const lines = [
    "ROBCO IND. (TM) TERMLINK PROTOCOL",
    "(C) 2075 ROBCO INDUSTRIES",
    "PIP-OS(R) v7.1.0.8 — UNIFIED OPERATING SYSTEM",
    "",
    "MEMORY CHECK: 131,072 BYTES FREE.",
    "BOOTING...",
    "",
    "INITIALIZING TANDI........................[ OK ]",
    "MOUNTING /vault/sys.....................[ OK ]",
    "STARTUP SEQUENCE COMPLETE.",
    "",
  ];
  for (const l of lines) {
    const div = document.createElement("div");
    rootEl.appendChild(div);
    await typeLine(div, l, 8);
  }

  // Liberty Prime quote ~25%
  if (Math.random() < 0.25) {
    const lp = document.createElement("div");
    lp.style.color = "var(--phosphor)";
    rootEl.appendChild(lp);
    await typeLine(lp, "[LIBERTY PRIME] " + PRIME_LINES[Math.floor(Math.random() * PRIME_LINES.length)], 18);
    await sleep(400);
  }

  await sleep(300);

  // Vault-Tec logo
  const vt = rawLine(rootEl, "", "ascii");
  vt.textContent = VAULT_TEC_LOGO;
  await sleep(500);

  // The opening line
  const war = document.createElement("div");
  war.style.fontSize = "26px";
  war.style.letterSpacing = "4px";
  war.style.marginTop = "12px";
  rootEl.appendChild(war);
  await typeLine(war, "WAR. WAR NEVER CHANGES.", 60);

  await sleep(900);

  // ready
  const ready = document.createElement("div");
  rootEl.appendChild(ready);
  ready.classList.add("cursor");
  ready.textContent = "> WELCOME, " + (opts.handle || "DWELLER").toUpperCase() + ". ";
  await sleep(800);

  // hand-off
  rootEl.style.transition = "opacity 380ms";
  rootEl.style.opacity = "0";
  await sleep(420);
  rootEl.hidden = true;
  rootEl.style.opacity = "";
}

export async function quickBoot(rootEl) {
  // Used after first session — much shorter
  rootEl.innerHTML = "";
  rootEl.hidden = false;
  const screen = document.getElementById("screen");
  screen.classList.add("poweron");
  await sleep(220);
  screen.classList.remove("poweron");
  play("boot_chime");
  const div = document.createElement("div");
  rootEl.appendChild(div);
  await typeLine(div, "ROBCO TERMLINK [READY] PIP-OS v7.1.0.8", 10);
  await sleep(300);
  rootEl.hidden = true;
}
