// games/atomic-cmd.js — Missile Command clone defending 8 cities.

import { makeShell, makeCanvas, loop, recordHighScore, gameOver, phosphor } from "./canvas-helpers.js";
import { play } from "../sound.js";

const W = 480, H = 320;
const CITIES = ["NEW YORK","D.C.","SEATTLE","VEGAS","S.F.","ST.LOUIS","RUSHMORE","BOSTON"];

export function start(opts) {
  const shell = makeShell({ title: "ATOMIC COMMAND", onExit: opts.onExit });
  const canvas = makeCanvas(shell.body, W, H);
  canvas.style.cursor = "crosshair";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  const ctx = canvas.getContext("2d");

  const cities = CITIES.map((n, i) => ({
    x: 60 + i * (W - 120) / 7,
    y: H - 16,
    name: n,
    alive: true,
  }));
  const batteries = [
    { x: 20,    y: H - 14, ammo: 10 },
    { x: W/2,   y: H - 14, ammo: 10 },
    { x: W-20,  y: H - 14, ammo: 10 },
  ];
  let mouse = { x: W/2, y: H/2 };
  const incoming = [];
  const friendlies = [];
  const explosions = [];
  let score = 0;
  let wave = 1;
  let waveTimer = 0;
  let waveSpawned = 0;
  let waveCount = 6;
  let exitFlag = false;

  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width * W;
    mouse.y = (e.clientY - r.top)  / r.height * H;
  });
  canvas.addEventListener("pointerdown", () => fire());

  function fire() {
    // Pick the closest battery with ammo
    let best = null;
    for (const b of batteries) {
      if (!b.ammo) continue;
      const d = Math.hypot(b.x - mouse.x, b.y - mouse.y);
      if (!best || d < best.d) best = { b, d };
    }
    if (!best) return;
    best.b.ammo--;
    friendlies.push({ x: best.b.x, y: best.b.y, tx: mouse.x, ty: mouse.y, t: 0, dur: 0.6 });
    play("beep");
  }

  const stop = loop((dt) => {
    if (exitFlag) return;

    // Spawn incoming missiles for this wave
    waveTimer -= dt;
    if (waveSpawned < waveCount && waveTimer <= 0) {
      const x = Math.random() * W;
      const target = (Math.random() < 0.7)
        ? cities[Math.floor(Math.random() * cities.length)]
        : batteries[Math.floor(Math.random() * batteries.length)];
      const speed = 18 + wave * 4;
      const dx = (target.x - x);
      const dy = (target.y - 0);
      const d  = Math.hypot(dx, dy);
      incoming.push({
        x, y: 0,
        vx: dx / d * speed,
        vy: dy / d * speed,
        target,
      });
      waveSpawned++;
      waveTimer = 0.8 - wave * 0.04;
    }

    // Update incoming
    for (const m of incoming) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      // collision with explosions
      for (const e of explosions) {
        if (Math.hypot(m.x - e.x, m.y - e.y) < e.r) {
          m.dead = true;
          score += 25;
          play("static_short");
          break;
        }
      }
    }

    // Friendly missiles travel towards their target then explode
    for (const f of friendlies) {
      f.t += dt;
      if (f.t >= f.dur) {
        explosions.push({ x: f.tx, y: f.ty, t: 0, max: 0.7, r: 4 });
        play("achievement");
        f.done = true;
      }
    }

    // Update explosions
    for (const e of explosions) {
      e.t += dt;
      e.r = 4 + (e.t / e.max) * 26;
      if (e.t >= e.max) e.done = true;
    }

    // Filter
    for (let i = incoming.length - 1; i >= 0; i--) {
      const m = incoming[i];
      if (m.dead) { incoming.splice(i, 1); continue; }
      // hit ground
      if (m.y >= H - 18) {
        // Did it hit a city or battery?
        for (const c of cities) if (c.alive && Math.abs(c.x - m.x) < 12) c.alive = false;
        for (const b of batteries) if (Math.abs(b.x - m.x) < 12) b.ammo = 0;
        explosions.push({ x: m.x, y: H - 14, t: 0, max: 0.6, r: 4 });
        play("error");
        incoming.splice(i, 1);
      }
    }
    for (let i = friendlies.length - 1; i >= 0; i--) if (friendlies[i].done) friendlies.splice(i, 1);
    for (let i = explosions.length - 1; i >= 0; i--) if (explosions[i].done) explosions.splice(i, 1);

    // Wave end?
    if (waveSpawned >= waveCount && incoming.length === 0) {
      const surviving = cities.filter(c => c.alive).length;
      if (surviving === 0) {
        recordHighScore("atomic-cmd", score);
        gameOver(shell.body, "ALL CITIES LOST", `SCORE ${score}`, () => location.reload());
        exitFlag = true;
        return;
      }
      // bonus
      score += surviving * 50 + batteries.reduce((a, b) => a + b.ammo * 5, 0);
      wave++;
      waveCount += 2;
      waveSpawned = 0;
      waveTimer = 1.2;
      for (const b of batteries) b.ammo = 10;
    }

    // Render
    const FG = phosphor("fg");
    const DIM = phosphor("dim");
    const BG = phosphor("deep");
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = FG; ctx.fillStyle = FG; ctx.lineWidth = 1;
    // ground
    ctx.beginPath(); ctx.moveTo(0, H - 12); ctx.lineTo(W, H - 12); ctx.stroke();
    // cities
    for (const c of cities) {
      if (c.alive) {
        ctx.fillRect(c.x - 16, H - 26, 32, 12);
        // small antennas
        ctx.fillRect(c.x - 12, H - 30, 2, 4);
        ctx.fillRect(c.x +  4, H - 32, 2, 6);
      } else {
        ctx.fillStyle = DIM;
        ctx.fillRect(c.x - 14, H - 18, 28, 4);
        ctx.fillStyle = FG;
      }
      ctx.font = "8px ShareTechMono, monospace";
      ctx.fillText(c.name, c.x - 16, H - 1);
    }
    // batteries
    for (const b of batteries) {
      ctx.fillRect(b.x - 8, b.y - 8, 16, 8);
      ctx.font = "10px ShareTechMono, monospace";
      ctx.fillText(b.ammo, b.x - 4, b.y - 12);
    }
    // friendly trails — solid bright phosphor
    ctx.lineWidth = 1.5;
    for (const f of friendlies) {
      const t = f.t / f.dur;
      const x = f.x + (f.tx - f.x) * t;
      const y = f.y + (f.ty - f.y) * t;
      ctx.strokeStyle = FG;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    // incoming trails — dim + dashed (Pip-Boy stays monochrome; pattern signals threat)
    ctx.strokeStyle = DIM;
    ctx.setLineDash([3, 3]);
    for (const m of incoming) {
      ctx.beginPath();
      ctx.moveTo(m.x - m.vx * 0.5, m.y - m.vy * 0.5);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // explosions
    for (const e of explosions) {
      ctx.strokeStyle = FG;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // crosshair
    ctx.strokeStyle = FG;
    ctx.beginPath();
    ctx.moveTo(mouse.x - 6, mouse.y); ctx.lineTo(mouse.x + 6, mouse.y);
    ctx.moveTo(mouse.x, mouse.y - 6); ctx.lineTo(mouse.x, mouse.y + 6);
    ctx.stroke();

    shell.score.textContent = `SCORE ${score}`;
    shell.extra.textContent = `WAVE ${wave} • CITIES ${cities.filter(c => c.alive).length}/8`;
  });

  const orig = shell.cleanup;
  shell.cleanup = () => { stop(); orig(); };
  shell.wrap.querySelector("#g-eject").addEventListener("click", shell.cleanup);
}
