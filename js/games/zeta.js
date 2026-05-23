// games/zeta.js — Space Invaders clone with Zetan aliens.

import { makeShell, makeCanvas, loop, input, touchPad, recordHighScore, gameOver, phosphor } from "./canvas-helpers.js";
import { play } from "../sound.js";

const W = 320, H = 240;

export function start(opts) {
  const shell = makeShell({ title: "ZETA INVADERS", onExit: opts.onExit });
  const canvas = makeCanvas(shell.body, W, H);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  const ctx = canvas.getContext("2d");
  const keys = input();
  const tp = touchPad(shell.body, { pad: ["←","→"], actions: ["FIRE"] });

  let player, aliens, dx, dropTick, bullets, eBullets, mother, score, lives, exitFlag;
  let bunkers;

  function reset() {
    player = { x: W/2 - 8, y: H - 24, w: 16, h: 8, cd: 0 };
    aliens = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 11; c++) {
        aliens.push({ x: 24 + c * 22, y: 24 + r * 18, alive: true, row: r });
      }
    }
    dx = 12;
    dropTick = 0;
    bullets = [];
    eBullets = [];
    mother = null;
    score = 0;
    lives = 3;
    exitFlag = false;
    bunkers = [];
    for (let i = 0; i < 4; i++) {
      const bx = 30 + i * 70;
      const by = H - 60;
      const cells = [];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) cells.push({ r, c, alive: true });
      bunkers.push({ x: bx, y: by, cells });
    }
  }
  reset();

  let stepTimer = 0;
  let stepInterval = 0.6;

  const stop = loop((dt) => {
    if (exitFlag) return;

    // input
    const left  = keys.has("ArrowLeft")  || tp.has("←");
    const right = keys.has("ArrowRight") || tp.has("→");
    const fire  = keys.has(" ") || keys.has("ArrowUp") || tp.has("FIRE");

    if (left)  player.x -= 80 * dt;
    if (right) player.x += 80 * dt;
    player.x = Math.max(8, Math.min(W - 8 - player.w, player.x));

    player.cd -= dt;
    if (fire && player.cd <= 0 && bullets.length < 1) {
      bullets.push({ x: player.x + player.w/2, y: player.y, vy: -180 });
      player.cd = 0.35;
      play("beep");
    }

    // Step the swarm
    stepTimer -= dt;
    if (stepTimer <= 0) {
      const liveAliens = aliens.filter(a => a.alive);
      const minX = Math.min(...liveAliens.map(a => a.x));
      const maxX = Math.max(...liveAliens.map(a => a.x));
      let drop = false;
      if ((dx > 0 && maxX > W - 24) || (dx < 0 && minX < 16)) {
        dx = -dx; drop = true;
      }
      for (const a of liveAliens) { a.x += dx; if (drop) a.y += 8; }
      stepTimer = stepInterval;
      stepInterval = Math.max(0.08, 0.6 * (liveAliens.length / 55));
      play("static_short");
    }

    // Mothership
    if (!mother && Math.random() < 0.0015) {
      mother = { x: -20, y: 12, vx: 60 };
    }
    if (mother) {
      mother.x += mother.vx * dt;
      if (mother.x > W + 20) mother = null;
    }

    // Alien fire
    if (Math.random() < 0.02 + 0.0006 * (60 - aliens.filter(a => a.alive).length)) {
      const live = aliens.filter(a => a.alive);
      if (live.length) {
        const a = live[Math.floor(Math.random() * live.length)];
        eBullets.push({ x: a.x, y: a.y + 6, vy: 80 + Math.random() * 50 });
      }
    }

    // Update bullets
    for (const b of bullets) {
      b.y += b.vy * dt;
      // hit alien
      for (const a of aliens) if (a.alive && Math.abs(a.x - b.x) < 8 && Math.abs(a.y - b.y) < 6) {
        a.alive = false; b.dead = true;
        score += [40, 30, 20, 10, 10][a.row] || 10;
        play("achievement");
      }
      // hit mother
      if (mother && b.x > mother.x - 14 && b.x < mother.x + 14 && b.y < mother.y + 6 && b.y > mother.y - 6) {
        score += 200;
        b.dead = true;
        mother = null;
        play("unlock");
      }
      // hit bunker
      hitBunker(b, false);
      if (b.y < 0) b.dead = true;
    }
    for (const b of eBullets) {
      b.y += b.vy * dt;
      // hit player
      if (b.x > player.x && b.x < player.x + player.w && b.y > player.y && b.y < player.y + player.h) {
        b.dead = true;
        lives--;
        play("error");
        if (lives <= 0) {
          recordHighScore("zeta", score);
          gameOver(shell.body, "DESTROYED", `SCORE ${score}`, () => reset());
          exitFlag = true;
          return;
        }
      }
      hitBunker(b, true);
      if (b.y > H) b.dead = true;
    }
    bullets = bullets.filter(b => !b.dead);
    eBullets = eBullets.filter(b => !b.dead);

    // Aliens reach ground
    if (aliens.some(a => a.alive && a.y > H - 36)) {
      recordHighScore("zeta", score);
      gameOver(shell.body, "INVADED", `SCORE ${score}`, () => reset());
      exitFlag = true;
      return;
    }

    // Wave clear
    if (aliens.every(a => !a.alive)) {
      score += 500;
      reset();
      return;
    }

    // Render — phosphor for player/friendlies, dim phosphor for hostile elements.
    const FG = phosphor("fg");
    const DIM = phosphor("dim");
    const BG = phosphor("deep");
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = FG;
    // player
    ctx.fillRect(player.x, player.y, player.w, player.h);
    ctx.fillRect(player.x + 6, player.y - 4, 4, 4);
    // aliens (dim — they're "the other side")
    ctx.fillStyle = DIM;
    for (const a of aliens) if (a.alive) {
      ctx.fillRect(a.x - 6, a.y - 4, 12, 8);
      ctx.fillRect(a.x - 8, a.y - 2, 2, 4);
      ctx.fillRect(a.x + 6, a.y - 2, 2, 4);
    }
    // bunkers (bright)
    ctx.fillStyle = FG;
    for (const b of bunkers) {
      for (const cell of b.cells) {
        if (cell.alive) ctx.fillRect(b.x + cell.c * 4, b.y + cell.r * 4, 4, 4);
      }
    }
    // friendly bullets (bright, slim)
    for (const b of bullets)  ctx.fillRect(b.x - 1, b.y, 2, 6);
    // enemy bullets (dim, double-segment to read as different visually)
    ctx.fillStyle = DIM;
    for (const b of eBullets) {
      ctx.fillRect(b.x - 1, b.y, 2, 3);
      ctx.fillRect(b.x - 1, b.y + 4, 2, 3);
    }
    ctx.fillStyle = FG;
    // mother
    if (mother) ctx.fillRect(mother.x - 14, mother.y - 4, 28, 8);

    shell.score.textContent = `SCORE ${score}`;
    shell.extra.textContent = `LIVES ${lives}`;
  });

  function hitBunker(b, fromAbove) {
    for (const bn of bunkers) {
      if (b.x < bn.x - 4 || b.x > bn.x + 32 || b.y < bn.y - 4 || b.y > bn.y + 16) continue;
      const cells = bn.cells.filter(c => c.alive);
      const hit = cells.find(c => b.x >= bn.x + c.c * 4 && b.x < bn.x + c.c * 4 + 4
                                 && b.y >= bn.y + c.r * 4 && b.y < bn.y + c.r * 4 + 4);
      if (hit) {
        hit.alive = false;
        b.dead = true;
        return;
      }
    }
  }

  const orig = shell.cleanup;
  shell.cleanup = () => { stop(); keys.destroy(); orig(); };
  shell.wrap.querySelector("#g-eject").addEventListener("click", shell.cleanup);
}
