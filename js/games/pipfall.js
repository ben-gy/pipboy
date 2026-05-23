// games/pipfall.js — Pitfall clone.
// Goal: collect 5 bobbleheads in 300 seconds with 10 HP.

import { makeShell, makeCanvas, loop, input, touchPad, recordHighScore, gameOver } from "./canvas-helpers.js";
import { play } from "../sound.js";

const W = 320, H = 200;

export function start(opts) {
  const shell = makeShell({ title: "PIPFALL", onExit: opts.onExit });
  const canvas = makeCanvas(shell.body, W, H);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  const ctx = canvas.getContext("2d");
  const keys = input();
  const tp = touchPad(shell.body, { pad: ["←","→","↑"], actions: ["JMP"] });

  let player, scrolled, hp, bobbles, hazards, time, exitFlag, vines;

  function reset() {
    player = { x: 60, y: H - 60, w: 12, h: 16, vy: 0, onGround: true, swinging: null };
    scrolled = 0;
    hp = 10;
    bobbles = 0;
    time = 300;
    exitFlag = false;
    hazards = [];
    vines = [];
    // Pre-populate world segments out to 4000px
    for (let x = 200; x < 4200; x += 80 + Math.random() * 160) {
      const t = Math.random();
      if (t < 0.25) hazards.push({ type: "pit",   x, w: 24 + Math.random() * 22 });
      else if (t < 0.5) hazards.push({ type: "scorp", x, w: 14 });
      else if (t < 0.7) hazards.push({ type: "gas",   x, w: 22 });
      else if (t < 0.88) vines.push({ x, h: 70 });
      else hazards.push({ type: "bobble", x, w: 12 });
    }
  }
  reset();

  const stop = loop((dt) => {
    if (exitFlag) return;

    time -= dt;
    if (time <= 0) {
      recordHighScore("pipfall", bobbles);
      gameOver(shell.body, "TIMES UP", `${bobbles}/5 bobbleheads`, () => reset());
      exitFlag = true;
      return;
    }

    const left  = keys.has("ArrowLeft")  || tp.has("←");
    const right = keys.has("ArrowRight") || tp.has("→");
    const up    = keys.has("ArrowUp")    || tp.has("↑");
    const jump  = keys.has(" ") || tp.has("JMP");

    if (right) scrolled += 90 * dt;
    if (left)  scrolled = Math.max(0, scrolled - 90 * dt);

    if (jump && player.onGround && !player.swinging) {
      player.vy = -200;
      player.onGround = false;
      play("key_press");
    }

    if (player.swinging) {
      const v = player.swinging;
      v.t += dt;
      const ang = Math.sin(v.t * 2) * 0.8;
      player.x = v.x - scrolled + Math.sin(ang) * 50;
      player.y = 60 + Math.abs(Math.cos(ang)) * 80;
      if (jump) {
        player.swinging = null;
        player.vy = -150;
      }
    } else {
      player.vy += 600 * dt;
      player.y += player.vy * dt;
      // ground = pit-aware
      const groundY = H - 60;
      const ax = player.x + scrolled + player.w / 2;
      const inPit = hazards.some(h => h.type === "pit" && ax >= h.x && ax <= h.x + h.w);
      if (!inPit && player.y + player.h >= groundY) {
        player.y = groundY - player.h; player.vy = 0; player.onGround = true;
      } else if (inPit && player.y > H) {
        hp = 0;
      }
    }

    // Hazard collisions and pickups
    for (const h of hazards) {
      const sx = h.x - scrolled;
      if (sx < -40 || sx > W + 40) continue;
      const ax = player.x + player.w/2;
      const ay = player.y + player.h/2;
      if (h.type === "scorp" && Math.abs(ax - sx) < 8 && ay > H - 80) {
        if (!h.hit) { hp--; h.hit = true; play("error"); }
      }
      if (h.type === "gas" && Math.abs(ax - sx) < 12 && ay > H - 100) {
        if (!h.hit) { hp -= 2; h.hit = true; play("error"); }
      }
      if (h.type === "bobble" && Math.abs(ax - sx) < 10 && Math.abs(ay - (H - 80)) < 14) {
        if (!h.taken) { h.taken = true; bobbles++; play("achievement"); }
      }
    }

    // Vine grab
    if (!player.swinging && up) {
      for (const v of vines) {
        const sx = v.x - scrolled;
        if (Math.abs(sx - (player.x + player.w/2)) < 14 && player.y > 30 && player.y < 140) {
          player.swinging = { x: v.x, t: 0 };
          play("static_short");
          break;
        }
      }
    }

    if (hp <= 0 || bobbles >= 5) {
      recordHighScore("pipfall", bobbles);
      const won = bobbles >= 5;
      gameOver(shell.body, won ? "WIN!" : "DEAD",
               won ? `${bobbles} bobbleheads collected • ${Math.ceil(time)}s remaining` :
                     `${bobbles}/5 bobbleheads`,
               () => reset());
      exitFlag = true;
      return;
    }

    // Render
    ctx.fillStyle = "#0a1208"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#5fff66";
    // ground (with pits)
    ctx.fillRect(0, H - 60, W, 4);
    ctx.fillStyle = "#0a1208";
    for (const h of hazards) if (h.type === "pit") {
      const sx = h.x - scrolled;
      ctx.fillRect(sx, H - 60, h.w, 60);
    }
    ctx.fillStyle = "#5fff66";
    // hazards
    for (const h of hazards) {
      const sx = h.x - scrolled;
      if (sx < -40 || sx > W + 40) continue;
      if (h.type === "scorp") {
        if (h.hit) continue;
        ctx.fillRect(sx - 6, H - 70, 12, 6);
        ctx.fillRect(sx - 8, H - 67, 2, 4);
        ctx.fillRect(sx + 6, H - 67, 2, 4);
      } else if (h.type === "gas") {
        if (h.hit) continue;
        ctx.beginPath(); ctx.arc(sx, H - 80, 12, 0, Math.PI * 2); ctx.fill();
      } else if (h.type === "bobble") {
        if (h.taken) continue;
        ctx.fillRect(sx - 4, H - 90, 8, 12);
        ctx.beginPath(); ctx.arc(sx, H - 96, 6, 0, Math.PI * 2); ctx.fill();
      }
    }
    // vines
    ctx.strokeStyle = "#5fff66"; ctx.lineWidth = 1;
    for (const v of vines) {
      const sx = v.x - scrolled;
      if (sx < -40 || sx > W + 40) continue;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, 140); ctx.stroke();
    }
    // player
    ctx.fillRect(player.x, player.y, player.w, player.h);
    ctx.fillRect(player.x + 2, player.y - 4, 8, 4); // head

    // HUD
    shell.score.textContent = `BOBBLES ${bobbles}/5`;
    shell.extra.textContent = `HP ${hp} • TIME ${Math.ceil(time)}s`;
  });

  const orig = shell.cleanup;
  shell.cleanup = () => { stop(); keys.destroy(); orig(); };
  shell.wrap.querySelector("#g-eject").addEventListener("click", shell.cleanup);
}
