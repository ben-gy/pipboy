// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// games/lockpick.js — Pip-Boy-style lockpicking.
//
// Mechanic (faithful to the games):
//  - The lock cylinder has a hidden "sweet" angle in the upper arc (9 → 3 o'clock).
//  - The bobby pin's angle is controlled by mouse-X / arrow keys / on-screen buttons.
//  - Hold SPACE (or the TURN button) to apply tension via the screwdriver.
//    - If the pin is INSIDE the sweet zone, the cylinder rotates toward unlock.
//    - If outside, the cylinder shudders and the pin takes damage.
//    - Far enough outside, repeated/held tension snaps the pin.
//  - Release SPACE to let the cylinder spring back.
//  - 5 pins per session. Score = sum of unlocked-lock rewards.
//  - Difficulties scale the sweet-zone width and the cap reward.

import { makeShell, onCleanup } from "./canvas-helpers.js";
import { play } from "../sound.js";
import { unlock } from "../achievements.js";
import { mutate } from "../state.js";

const DIFFS = [
  { id: 0, name: "VERY EASY", arc: 100, reward: 50,  hint: "Forgiving."  },
  { id: 1, name: "EASY",      arc: 60,  reward: 100, hint: "Manageable." },
  { id: 2, name: "AVERAGE",   arc: 36,  reward: 200, hint: "Steady hand."},
  { id: 3, name: "HARD",      arc: 18,  reward: 400, hint: "Precise."   },
  { id: 4, name: "VERY HARD", arc:  8,  reward: 800, hint: "Brutal."    },
];

const ARC_MIN = -180;  // 9 o'clock in atan2 terms
const ARC_MAX =    0;  // 3 o'clock
const VIEW = 480;      // SVG square viewBox

export function start(opts) {
  const shell = makeShell({ title: "ROBCO LOCKPICK", onExit: opts.onExit });

  // ----- DOM ----------------------------------------------------------------

  shell.body.innerHTML = `
    <div class="lockpick">
      <div class="stage">
        <svg viewBox="0 0 ${VIEW} ${VIEW}" id="lk" aria-label="Lock">
          <defs>
            <radialGradient id="lk-bezel-grad" cx="50%" cy="40%" r="60%">
              <stop offset="0%"  stop-color="currentColor" stop-opacity="0.35"/>
              <stop offset="60%" stop-color="currentColor" stop-opacity="0.10"/>
              <stop offset="100%" stop-color="currentColor" stop-opacity="0.0"/>
            </radialGradient>
            <radialGradient id="lk-cyl-grad" cx="50%" cy="40%" r="55%">
              <stop offset="0%"  stop-color="currentColor" stop-opacity="0.18"/>
              <stop offset="60%" stop-color="currentColor" stop-opacity="0.06"/>
              <stop offset="100%" stop-color="currentColor" stop-opacity="0.18"/>
            </radialGradient>
          </defs>

          <!-- Outer escutcheon plate with rivets -->
          <rect class="bezel" x="20" y="20" width="${VIEW-40}" height="${VIEW-40}" rx="22"
                fill="url(#lk-bezel-grad)" stroke="currentColor" stroke-width="2" opacity="0.85"/>
          <g fill="currentColor" opacity="0.7">
            <circle cx="40"        cy="40"        r="3"/>
            <circle cx="${VIEW-40}" cy="40"        r="3"/>
            <circle cx="40"        cy="${VIEW-40}" r="3"/>
            <circle cx="${VIEW-40}" cy="${VIEW-40}" r="3"/>
          </g>
          <text x="${VIEW/2}" y="44" text-anchor="middle"
                font-family="ShareTechMono, monospace" font-size="11" letter-spacing="3"
                fill="currentColor" opacity="0.6">ROBCO IND. — TUMBLER 88</text>

          <!-- Cylinder ring -->
          <g id="cyl-grp">
            <circle class="cylinder" cx="${VIEW/2}" cy="${VIEW/2}" r="160"
                    fill="url(#lk-cyl-grad)" stroke="currentColor" stroke-width="3"/>
            <circle cx="${VIEW/2}" cy="${VIEW/2}" r="148"
                    fill="none" stroke="currentColor" stroke-width="0.6" opacity="0.5"/>
            <!-- Tick marks every 15° in the upper arc -->
            <g stroke="currentColor" stroke-width="1" opacity="0.45">
              ${tickMarks(VIEW/2, VIEW/2, 160, 168)}
            </g>
            <!-- Cardinal labels -->
            <text x="${VIEW/2 - 170}" y="${VIEW/2 + 4}" text-anchor="end"
                  font-family="ShareTechMono, monospace" font-size="11" fill="currentColor" opacity="0.55">9</text>
            <text x="${VIEW/2 + 170}" y="${VIEW/2 + 4}" text-anchor="start"
                  font-family="ShareTechMono, monospace" font-size="11" fill="currentColor" opacity="0.55">3</text>
            <text x="${VIEW/2}" y="${VIEW/2 - 168}" text-anchor="middle"
                  font-family="ShareTechMono, monospace" font-size="11" fill="currentColor" opacity="0.55">12</text>
          </g>

          <!-- Keyhole + screwdriver group (rotates as cylinder turns) -->
          <g id="kh-grp">
            <!-- Keyhole shape: circle with a slit at the bottom -->
            <circle class="keyhole" cx="${VIEW/2}" cy="${VIEW/2}" r="48"
                    fill="currentColor" fill-opacity="0.35" stroke="currentColor" stroke-width="2"/>
            <rect x="${VIEW/2 - 6}" y="${VIEW/2}" width="12" height="80"
                  fill="currentColor" fill-opacity="0.45"/>
            <circle cx="${VIEW/2}" cy="${VIEW/2}" r="8" fill="currentColor"/>

            <!-- Screwdriver / tension wrench, inserted from below -->
            <g id="wrench" opacity="0.95">
              <rect x="${VIEW/2 - 5}" y="${VIEW/2 + 30}" width="10" height="50"
                    fill="currentColor" fill-opacity="0.6"/>
              <rect x="${VIEW/2 - 14}" y="${VIEW/2 + 80}" width="28" height="36"
                    fill="currentColor" fill-opacity="0.85"/>
              <rect x="${VIEW/2 - 18}" y="${VIEW/2 + 116}" width="36" height="60"
                    fill="currentColor" fill-opacity="0.55" stroke="currentColor" stroke-width="2"/>
              <line x1="${VIEW/2 - 12}" y1="${VIEW/2 + 130}" x2="${VIEW/2 + 12}" y2="${VIEW/2 + 130}"
                    stroke="currentColor" stroke-width="1.4" opacity="0.6"/>
              <line x1="${VIEW/2 - 12}" y1="${VIEW/2 + 150}" x2="${VIEW/2 + 12}" y2="${VIEW/2 + 150}"
                    stroke="currentColor" stroke-width="1.4" opacity="0.6"/>
            </g>
          </g>

          <!-- Bobby pin (rotates with pinAngle, independent of cylinder) -->
          <g id="pin-grp">
            <!-- A bent pin: thin shaft from cylinder edge inward, with a curl on the outer end -->
            <path class="pin" d="
              M ${VIEW/2} ${VIEW/2 - 30}
              L ${VIEW/2} ${VIEW/2 - 168}
              q  10 -10  6 -22
              q  -8 -10  -22 -8
              q  -12 8  -10 22
              " fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            <!-- Pin body shading: small rectangle along the shaft to imply 3D -->
            <line x1="${VIEW/2 - 1.4}" y1="${VIEW/2 - 30}"
                  x2="${VIEW/2 - 1.4}" y2="${VIEW/2 - 160}"
                  stroke="currentColor" stroke-width="0.8" opacity="0.5"/>
          </g>

          <!-- Tension intensity bar (left) -->
          <g id="tense-grp" opacity="0.9">
            <rect x="36" y="${VIEW/2 - 80}" width="8" height="160"
                  fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.6"/>
            <rect id="tense-fill" x="38" y="${VIEW/2 + 78}" width="4" height="0"
                  fill="currentColor" opacity="0.85"/>
            <text x="40" y="${VIEW/2 - 90}" text-anchor="middle"
                  font-family="ShareTechMono, monospace" font-size="9"
                  fill="currentColor" opacity="0.65">TENSION</text>
          </g>

          <!-- Pin health bar (right) -->
          <g id="health-grp" opacity="0.9">
            <rect x="${VIEW-44}" y="${VIEW/2 - 80}" width="8" height="160"
                  fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.6"/>
            <rect id="health-fill" x="${VIEW-42}" y="${VIEW/2 - 78}" width="4" height="156"
                  fill="currentColor" opacity="0.85"/>
            <text x="${VIEW-40}" y="${VIEW/2 - 90}" text-anchor="middle"
                  font-family="ShareTechMono, monospace" font-size="9"
                  fill="currentColor" opacity="0.65">PIN</text>
          </g>
        </svg>
      </div>

      <div class="panel">
        <h3>LOCKPICKING</h3>
        <div class="kv"><label>Difficulty</label><span id="diffname">${DIFFS[1].name}</span></div>
        <div class="kv"><label>Pins</label><span class="pins" id="pins"></span></div>
        <div class="kv"><label>Score</label><span id="score">0</span></div>
        <div class="kv"><label>Status</label><span id="status">READY</span></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
          ${DIFFS.map(d => `<button class="btn tiny" data-i="${d.id}">${d.name}</button>`).join("")}
        </div>
        <p style="font-size:14px;font-family:var(--font-mono);opacity:.8;margin:8px 0 0">
          MOVE: mouse / ←→ &nbsp;·&nbsp; TURN: hold SPACE
        </p>
        <div style="display:flex;gap:6px">
          <button class="btn tiny" id="restart">NEW LOCK</button>
        </div>
        <div class="touch-pad" style="position:static;display:flex;gap:8px;margin-top:8px">
          <button id="t-l" type="button" class="btn">←</button>
          <button id="t-r" type="button" class="btn">→</button>
          <button id="t-turn" type="button" class="btn">TURN</button>
        </div>
      </div>
    </div>
  `;

  // ----- references ---------------------------------------------------------

  const $ = (sel) => shell.body.querySelector(sel);
  const svg     = $("#lk");
  const cylGrp  = $("#cyl-grp");
  const khGrp   = $("#kh-grp");
  const pinGrp  = $("#pin-grp");
  const tenseFill  = $("#tense-fill");
  const healthFill = $("#health-fill");
  const diffName   = $("#diffname");
  const scoreEl    = $("#score");
  const pinsEl     = $("#pins");
  const statusEl   = $("#status");

  // ----- state --------------------------------------------------------------

  let diff       = 1;     // index in DIFFS
  let sweet      = 0;     // -180..0; randomized per lock
  let pinAngle   = -90;   // -180..0 (12 o'clock = -90)
  let cylRot     = 0;     // 0..90  -- angle the cylinder has progressed
  let pinHealth  = 1;     // 0..1
  let pinsLeft   = 5;
  let score      = 0;
  let phase      = "ready"; // "ready" | "turning" | "win" | "broken" | "gameover"
  let turning    = false;
  let pointerInside = false;
  let touchTurn  = false;
  let raf        = 0;
  let lastT      = performance.now();

  // ----- input --------------------------------------------------------------

  const keys = new Set();
  const onKeyDown = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      keys.add(e.key);
    } else if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      turning = true;
    }
  };
  const onKeyUp = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") keys.delete(e.key);
    if (e.key === " " || e.code === "Space") turning = false;
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup",   onKeyUp);

  const onPointerMove = (e) => {
    pointerInside = true;
    const r = svg.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top  + r.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    let a = Math.atan2(dy, dx) * 180 / Math.PI; // -180..180
    // Snap to top half. Below the horizontal stays at the nearer edge.
    if (a > 0) a = (a > 90) ? -180 : 0;
    pinAngle = Math.max(ARC_MIN, Math.min(ARC_MAX, a));
  };
  svg.addEventListener("pointermove", onPointerMove);

  // Touch buttons
  const tL  = $("#t-l"), tR = $("#t-r"), tTurn = $("#t-turn");
  const press = (btn, cb) => {
    btn.addEventListener("pointerdown", (e) => { e.preventDefault(); cb(true); });
    ["pointerup","pointerleave","pointercancel"].forEach(ev =>
      btn.addEventListener(ev, () => cb(false)));
  };
  let tHoldL = false, tHoldR = false;
  press(tL,    (down) => tHoldL = down);
  press(tR,    (down) => tHoldR = down);
  press(tTurn, (down) => touchTurn = down);

  // Difficulty + restart
  shell.body.querySelectorAll("[data-i]").forEach(b =>
    b.addEventListener("click", () => setDiff(parseInt(b.dataset.i, 10))));
  $("#restart").addEventListener("click", () => newLock());

  // ----- helpers ------------------------------------------------------------

  function setDiff(i) {
    diff = i;
    diffName.textContent = DIFFS[diff].name;
    score = 0; pinsLeft = 5;
    scoreEl.textContent = "0";
    renderPins();
    newLock();
  }

  function newLock() {
    // Sweet within ±70 degrees of straight up (-90)
    sweet = -90 + (Math.random() * 140 - 70);
    cylRot = 0;
    pinHealth = 1;
    phase = "ready";
    statusEl.textContent = "READY";
    cylGrp.setAttribute("transform", "");
    khGrp.setAttribute("transform", "");
    pinGrp.style.transition = "";
    play("holotape_insert");
  }

  function renderPins() {
    pinsEl.innerHTML = Array.from({ length: 5 }, (_, i) =>
      `<span class="p ${i < pinsLeft ? "" : "broken"}"></span>`).join("");
  }

  function showGameOver(msg) {
    phase = "gameover";
    const o = document.createElement("div");
    o.className = "game-over";
    o.innerHTML = `<div>${msg}<span class="sub">SCORE ${score}</span><br>
      <button class="btn" style="margin-top:18px" id="rt">TRY AGAIN</button></div>`;
    shell.body.appendChild(o);
    o.querySelector("#rt").addEventListener("click", () => {
      o.remove();
      pinsLeft = 5;
      score = 0;
      scoreEl.textContent = "0";
      renderPins();
      newLock();
    });
  }

  // ----- main loop ----------------------------------------------------------

  function tick(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;

    // Keyboard left/right adjust pin
    const stepRate = 90; // deg/sec
    if (keys.has("ArrowLeft") || tHoldL) pinAngle = Math.max(ARC_MIN, pinAngle - stepRate * dt);
    if (keys.has("ArrowRight") || tHoldR) pinAngle = Math.min(ARC_MAX, pinAngle + stepRate * dt);

    // Render pin rotation. SVG rotate(0) = pin pointing up. Map -90..0 → 0..90.
    const pinDeg = pinAngle + 90;
    pinGrp.setAttribute("transform", `rotate(${pinDeg.toFixed(2)} ${VIEW/2} ${VIEW/2})`);

    if (phase === "ready" || phase === "turning") {
      const D = DIFFS[diff];
      const half = D.arc / 2;
      const dist = Math.abs(pinAngle - sweet);
      const proximity = Math.max(0, 1 - dist / 90);
      const inZone = dist <= half;

      const isTurning = turning || touchTurn;
      const tensePct = isTurning ? Math.min(1, 0.4 + proximity * 0.6) : 0;
      // tension bar fills from bottom up
      const tH = tensePct * 156;
      tenseFill.setAttribute("y", String(VIEW/2 + 78 - tH));
      tenseFill.setAttribute("height", String(tH));

      if (isTurning && pinHealth > 0) {
        phase = "turning";
        if (inZone) {
          // Smooth advance
          cylRot = Math.min(90, cylRot + 110 * dt);
          // Pin breathes a tiny shake to feel alive
          const wobble = (Math.sin(now / 60) * 0.3);
          cylGrp.setAttribute("transform", `rotate(${(cylRot + wobble).toFixed(2)} ${VIEW/2} ${VIEW/2})`);
          khGrp .setAttribute("transform", `rotate(${(cylRot + wobble).toFixed(2)} ${VIEW/2} ${VIEW/2})`);
          statusEl.textContent = `TURNING ${Math.round(cylRot)}°`;
          if (cylRot >= 90 - 0.01) {
            // unlocked!
            phase = "win";
            statusEl.textContent = "UNLOCKED";
            score += D.reward;
            scoreEl.textContent = String(score);
            mutate(s => {
              s.caps = (s.caps || 0) + Math.floor(D.reward / 5);
              if ((s.high_scores.lockpick || 0) < score) s.high_scores.lockpick = score;
            });
            if (diff === 4) unlock("locksmith", "ACHIEVEMENT", "Locksmith — Very Hard lock cracked");
            play("unlock");
            // Final clack: snap to 90, then animate back over 700ms before next lock
            cylGrp.setAttribute("transform", `rotate(90 ${VIEW/2} ${VIEW/2})`);
            khGrp .setAttribute("transform", `rotate(90 ${VIEW/2} ${VIEW/2})`);
            setTimeout(() => {
              if (phase !== "win") return; // user moved on
              newLock();
            }, 900);
          }
        } else {
          // shaking — proportional to how far off
          const shake = (1 - proximity) * 6;
          const offset = (Math.random() - 0.5) * shake;
          cylGrp.setAttribute("transform", `rotate(${offset.toFixed(2)} ${VIEW/2} ${VIEW/2})`);
          khGrp .setAttribute("transform", `rotate(${offset.toFixed(2)} ${VIEW/2} ${VIEW/2})`);
          // damage pin
          const dmgRate = (1 - proximity) * 0.8 + 0.1; // 0.1..0.9
          pinHealth = Math.max(0, pinHealth - dmgRate * dt);
          statusEl.textContent = "BINDING";
          if (pinHealth <= 0) {
            // pin breaks
            play("pin_break");
            pinsLeft--;
            renderPins();
            // visual snap of the pin
            pinGrp.style.transition = "transform 200ms ease-out";
            const breakAngle = pinDeg + (Math.random() < 0.5 ? -25 : 25);
            pinGrp.setAttribute("transform", `rotate(${breakAngle} ${VIEW/2} ${VIEW/2})`);
            phase = "broken";
            statusEl.textContent = "PIN BROKEN";
            setTimeout(() => {
              if (pinsLeft <= 0) showGameOver("OUT OF PINS");
              else newLock();
            }, 600);
          }
        }
      } else {
        // Released tension — cylinder springs back proportionally.
        // Crucially we DO NOT reveal whether the pin is in the sweet zone here:
        // the only feedback is how the cylinder responds when tension is applied.
        if (cylRot > 0) {
          cylRot = Math.max(0, cylRot - 240 * dt);
        }
        cylGrp.setAttribute("transform", `rotate(${cylRot.toFixed(2)} ${VIEW/2} ${VIEW/2})`);
        khGrp .setAttribute("transform", `rotate(${cylRot.toFixed(2)} ${VIEW/2} ${VIEW/2})`);
        if (phase === "turning") phase = "ready";
        if (phase === "ready") statusEl.textContent = "READY";
      }

      // health bar
      const hH = pinHealth * 156;
      healthFill.setAttribute("y", String(VIEW/2 - 78 + (156 - hH)));
      healthFill.setAttribute("height", String(hH));
    }

    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  // ----- cleanup ------------------------------------------------------------

  onCleanup(shell, () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup",   onKeyUp);
  });

  // initialize
  setDiff(1);
}

function tickMarks(cx, cy, r1, r2) {
  let s = "";
  for (let deg = 180; deg <= 360; deg += 15) {
    const a = (deg) * Math.PI / 180;
    const x1 = cx + Math.cos(a) * r1;
    const y1 = cy + Math.sin(a) * r1;
    const x2 = cx + Math.cos(a) * r2;
    const y2 = cy + Math.sin(a) * r2;
    s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }
  return s;
}
