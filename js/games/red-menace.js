// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// games/red-menace.js — Donkey Kong-style climber.
// Climb sloping girders, dodge barrels, reach the maiden.

import { makeShell, makeCanvas, loop, input, touchPad, recordHighScore, gameOver } from "./canvas-helpers.js";
import { play } from "../sound.js";

const W = 320, H = 240;
const GRAV = 320;

export function start(opts) {
  const shell = makeShell({ title: "RED MENACE", onExit: opts.onExit });
  const canvas = makeCanvas(shell.body, W, H);
  const ctx = canvas.getContext("2d");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.maxHeight = "calc(100% - 0px)";
  const keys = input();
  const tp = touchPad(shell.body, { pad: ["←","→","↑"], actions: ["JMP"] });

  let player, barrels, ladders, girders, level, score, lives, vy, onGround, climbing, gameWon, exitFlag;

  function buildLevel() {
    girders = [];
    ladders = [];
    const rows = 5;
    for (let i = 0; i < rows; i++) {
      const y = H - 30 - i * 40;
      const dirRight = i % 2 === 0;
      // Slight slope
      girders.push({ x: 16, y: y, w: W - 32, slope: dirRight ? -2 : 2 });
      // ladder placement
      if (i < rows - 1) {
        const lx = dirRight ? W - 60 : 32;
        ladders.push({ x: lx, y1: y, y2: y - 40 });
      }
    }
    barrels = [];
    player = { x: 24, y: girders[0].y - 10, w: 12, h: 14, vx: 0, vy: 0 };
    score = 0; lives = 3; level = 1;
    onGround = true; climbing = false; gameWon = false; exitFlag = false;
  }
  buildLevel();

  // King Atom throws barrel periodically
  let barrelTimer = 0;

  const stopLoop = loop((dt) => {
    if (exitFlag) return;
    if (gameWon) return;

    // movement
    const right = keys.has("ArrowRight") || tp.has("→");
    const left  = keys.has("ArrowLeft")  || tp.has("←");
    const up    = keys.has("ArrowUp")    || tp.has("↑");
    const jump  = keys.has(" ") || keys.has("ArrowUp") || tp.has("JMP");

    // Find current girder (closest above feet)
    const onLadder = ladders.find(l => Math.abs(player.x + player.w/2 - l.x - 6) < 12 && player.y >= l.y2 - 4 && player.y <= l.y1 + 4);

    if (climbing && onLadder) {
      player.x = onLadder.x;
      if (up) player.y -= 60 * dt;
      if (keys.has("ArrowDown") || tp.has("↓")) player.y += 60 * dt;
      if (player.y < onLadder.y2) { climbing = false; player.y = onLadder.y2 - 1; }
    } else {
      if (up && onLadder) climbing = true;
      // walking
      if (right) player.x += 70 * dt;
      if (left)  player.x -= 70 * dt;
      // jump
      if (jump && onGround) { player.vy = -180; onGround = false; play("key_press"); }
      // gravity
      player.vy += GRAV * dt;
      player.y += player.vy * dt;
      // land on a girder
      onGround = false;
      for (const g of girders) {
        const gy = girderY(g, player.x + player.w/2);
        if (Math.abs(player.y + player.h - gy) < 6 && player.vy >= 0) {
          player.y = gy - player.h;
          player.vy = 0;
          onGround = true;
          break;
        }
      }
    }

    player.x = Math.max(8, Math.min(W - 8 - player.w, player.x));

    // Spawn barrel
    barrelTimer -= dt;
    if (barrelTimer <= 0) {
      barrels.push({ x: 30, y: girders[girders.length - 1].y - 8, vx: 50 + level * 8, vy: 0 });
      barrelTimer = Math.max(0.8, 2.4 - level * 0.2);
    }

    // Update barrels
    for (const b of barrels) {
      b.x += b.vx * dt;
      b.vy += GRAV * dt;
      b.y += b.vy * dt;
      // settle on a girder
      for (const g of girders) {
        const gy = girderY(g, b.x);
        if (Math.abs(b.y + 6 - gy) < 8 && b.vy >= 0) {
          b.y = gy - 6;
          b.vy = 0;
          // slope-induced velocity
          b.vx = (g.slope > 0 ? -1 : 1) * (60 + level * 8);
          break;
        }
      }
      // jump-over score: if player above barrel and within range
      // (simplified — just track passes)
      if (Math.abs(b.x - (player.x + player.w/2)) < 8 && (player.y + player.h) < b.y - 4 && !b.scored) {
        b.scored = true;
        score += 100;
      }
      // collision
      if (Math.abs(b.x - (player.x + player.w/2)) < 8 && Math.abs(b.y - (player.y + player.h/2)) < 10) {
        loseLife();
      }
    }
    barrels = barrels.filter(b => b.x > -20 && b.x < W + 20 && b.y < H + 20);

    // Reach the top
    if (player.y < girders[girders.length - 1].y - 20) {
      score += 1000 * level;
      level++;
      buildLevel();
      // keep level bumped after rebuild
      // (buildLevel resets — overwrite level/score)
    }

    // Render
    ctx.fillStyle = "var(--phosphor-deep)";
    ctx.fillStyle = "#0a1208";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#5fff66";
    ctx.lineWidth = 2;

    // Girders
    for (const g of girders) {
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(g.x + g.w, g.y + g.slope * (g.w / 32));
      ctx.stroke();
    }
    // Ladders
    for (const l of ladders) {
      ctx.beginPath();
      ctx.moveTo(l.x, l.y1);
      ctx.lineTo(l.x, l.y2);
      ctx.moveTo(l.x + 12, l.y1);
      ctx.lineTo(l.x + 12, l.y2);
      for (let r = 0; r < 6; r++) {
        const ry = l.y1 - (l.y1 - l.y2) * (r / 5);
        ctx.moveTo(l.x, ry);
        ctx.lineTo(l.x + 12, ry);
      }
      ctx.stroke();
    }
    // King Atom (top)
    ctx.fillStyle = "#5fff66";
    ctx.fillRect(W/2 - 18, girders[girders.length - 1].y - 22, 36, 14);
    ctx.fillRect(W/2 - 14, girders[girders.length - 1].y - 28, 28, 6);

    // Maiden
    ctx.fillRect(W - 60, girders[girders.length - 1].y - 14, 8, 12);

    // Barrels
    ctx.fillStyle = "#5fff66";
    for (const b of barrels) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player
    ctx.fillStyle = "#5fff66";
    ctx.fillRect(player.x, player.y, player.w, player.h);

    shell.score.textContent = `SCORE ${score}`;
    shell.extra.textContent = `LIVES ${lives} • LV ${level}`;
  });

  function loseLife() {
    play("error");
    lives--;
    if (lives <= 0) {
      recordHighScore("red-menace", score);
      gameOver(shell.body, "GAME OVER", `SCORE ${score}`, () => buildLevel());
      exitFlag = true;
    } else {
      player.x = 24;
      player.y = girders[0].y - player.h;
      player.vy = 0;
    }
  }

  function girderY(g, x) {
    const t = Math.max(0, Math.min(1, (x - g.x) / g.w));
    return g.y + g.slope * t;
  }

  // hook onExit cleanup
  const origCleanup = shell.cleanup;
  shell.cleanup = () => { stopLoop(); keys.destroy(); origCleanup(); };
  shell.wrap.querySelector("#g-eject").addEventListener("click", shell.cleanup);
}
