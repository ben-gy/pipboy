// games/hacking.js — ROBCO terminal hacking puzzle.
// Same-length words, Hamming-likeness feedback, clickable bracket pairs
// that either remove a dud or reset attempts.

import { makeShell, recordHighScore } from "./canvas-helpers.js";
import { play } from "../sound.js";
import { mutate, loadState } from "../state.js";
import { unlock } from "../achievements.js";
import { pipAlert } from "../modal.js";

const WORDS = {
  4: ["FREE","DEEP","WORD","HOLE","LOAD","CALM","TRAP","REAR","PASS","ROOM","SAFE","PORT","EVIL","NUKE","MASS","RUST","BARK","FOOT","BEAR"],
  5: ["ENTER","ADMIN","VAULT","RADIO","TRUST","MAGIC","BRAVE","PROBE","SCALE","HORDE","FROST","PRIME","DEATH","FAULT","LASER","GHOUL","ROBCO","ATOMS"],
  6: ["BUNKER","PROBED","ATOMIC","TANDEM","SECURE","PEPPER","PITTSB","FUTURE","DARING","FINGER","NUCLEI","GREASE","REPAIR","SQUARE","NIPSEY","NUKAID"],
  7: ["NUCLEAR","PROVING","BUNKERS","FALLOUT","CASCADE","CHAINED","PROCESS","TRINITY","HISTORY","ENCLAVE","WASTERS","REWRITE","BUILDER","COMPILE"],
  8: ["TERMINAL","ATTEMPTS","COMPLETE","DEMOCRAT","FREEDOMS","FRACTURE","ENERGIZE","DOWNLINK","SECURITY","INFINITY","FRACTION"],
};

const DIFFICULTIES = [
  { name: "VERY EASY", len: 4, count: 5,  attempts: 4 },
  { name: "EASY",      len: 5, count: 7,  attempts: 4 },
  { name: "AVERAGE",   len: 6, count: 9,  attempts: 4 },
  { name: "HARD",      len: 7, count: 10, attempts: 4 },
  { name: "VERY HARD", len: 8, count: 12, attempts: 4 },
];

const BRACKETS = ["()", "[]", "{}", "<>"];
const GARBAGE = "!@#$%^&*-+=/\\|:;,.~`?".split("");

let _diff = 2;
let _state = null;
let _shell = null;

export function start(opts) {
  _shell = makeShell({ title: opts.title || "ROBCO TERMLINK", onExit: opts.onExit });
  _shell.body.innerHTML = `
    <div class="hacking">
      <div class="grid" id="grid"></div>
      <div class="log">
        <div class="head">
          <strong>${opts.encrypted ? "DECRYPT" : "TERM-LINK"}</strong>
          <span class="difficulty" id="diffrow">${DIFFICULTIES.map((d, i) =>
            `<button data-i="${i}" class="${i === _diff ? "active" : ""}">${d.name}</button>`).join("")}</span>
        </div>
        <div class="lines" id="log">> Welcome to ROBCO Industries (TM) Termlink
> Password required.
> </div>
        <div class="attempts" id="attempts"></div>
      </div>
    </div>
  `;

  _shell.body.querySelectorAll("#diffrow button").forEach(b =>
    b.addEventListener("click", () => { _diff = parseInt(b.dataset.i, 10); newRound(opts); }));

  newRound(opts);
}

function newRound(opts) {
  const D = DIFFICULTIES[_diff];
  const pool = WORDS[D.len].slice();
  shuffle(pool);
  const words = pool.slice(0, D.count);
  const target = words[Math.floor(Math.random() * words.length)];

  const grid = document.getElementById("grid");
  const log  = document.getElementById("log");
  const att  = document.getElementById("attempts");
  document.getElementById("diffrow").querySelectorAll("button").forEach((b, i) =>
    b.classList.toggle("active", i === _diff));

  // Build the two columns of memory dump + scattered words and brackets
  const ROWS = 16;
  const COLS = 2;
  const ROW_W = 12; // chars per row
  const lines = [];
  for (let i = 0; i < ROWS * COLS; i++) {
    let line = "";
    for (let j = 0; j < ROW_W; j++) line += GARBAGE[Math.floor(Math.random() * GARBAGE.length)];
    lines.push(line);
  }
  // Place words at random positions (no overlap)
  const placed = []; // { word, row, start, end }
  for (const w of words) {
    let tries = 0;
    while (tries++ < 100) {
      const r = Math.floor(Math.random() * lines.length);
      const start = Math.floor(Math.random() * (ROW_W - w.length));
      const overlap = placed.some(p => p.row === r && !(start + w.length <= p.start || start >= p.end));
      if (overlap) continue;
      lines[r] = lines[r].slice(0, start) + w + lines[r].slice(start + w.length);
      placed.push({ word: w, row: r, start, end: start + w.length });
      break;
    }
  }

  // Place a couple of bracket pairs in remaining garbage
  const bracketSpans = [];
  for (let k = 0; k < 4; k++) {
    const r = Math.floor(Math.random() * lines.length);
    const pair = BRACKETS[Math.floor(Math.random() * BRACKETS.length)];
    const open = lines[r].indexOf(pair[0]);
    if (open < 0) {
      const pos = Math.floor(Math.random() * (ROW_W - 4));
      const close = pos + 2 + Math.floor(Math.random() * 4);
      if (close >= ROW_W) continue;
      // Ensure span doesn't overlap a placed word
      const overlap = placed.some(p => p.row === r && !(close + 1 <= p.start || pos >= p.end));
      if (overlap) continue;
      lines[r] = lines[r].slice(0, pos) + pair[0]
        + Array.from({length: close - pos - 1}, () => GARBAGE[Math.floor(Math.random() * GARBAGE.length)]).join("")
        + pair[1] + lines[r].slice(close + 1);
      bracketSpans.push({ row: r, start: pos, end: close + 1 });
    }
  }

  // Render
  let html = "";
  let baseAddr = 0xF0CA;
  for (let c = 0; c < COLS; c++) {
    html += `<div class="col">`;
    for (let r = 0; r < ROWS; r++) {
      const row = c * ROWS + r;
      const addr = (baseAddr + row * ROW_W).toString(16).toUpperCase().padStart(4, "0");
      const tokens = tokenizeRow(row, lines[row], placed, bracketSpans);
      html += `<div class="addr">0x${addr}</div><div class="row">${tokens}</div>`;
    }
    html += `</div>`;
  }
  grid.innerHTML = html;

  // Attempt pips
  const setPips = (n, max) => {
    att.innerHTML = "ATTEMPTS REMAINING: " +
      Array.from({length: max}, (_, i) => `<span class="pip ${i < n ? "" : "lost"}"></span>`).join("");
  };
  let attempts = D.attempts;
  setPips(attempts, D.attempts);

  // Click handlers
  let bracketsUsed = new Set();
  let dudsRemoved = new Set();

  grid.addEventListener("click", (e) => {
    const t = e.target.closest(".tok");
    if (!t) return;
    if (t.classList.contains("dud")) return;

    if (t.dataset.kind === "word") {
      const w = t.dataset.word;
      attemptWord(w);
    } else if (t.dataset.kind === "bracket") {
      const id = t.dataset.brid;
      if (bracketsUsed.has(id)) return;
      bracketsUsed.add(id);
      // 70% remove a dud, 30% replenish attempts
      if (Math.random() < 0.7 || attempts === D.attempts) {
        const remaining = placed.filter(p => p.word !== target && !dudsRemoved.has(p.word));
        if (remaining.length) {
          const dud = remaining[Math.floor(Math.random() * remaining.length)];
          dudsRemoved.add(dud.word);
          // mark all tokens with this word as dud
          grid.querySelectorAll(`[data-word="${dud.word}"]`).forEach(el => el.classList.add("dud"));
          appendLog(`> Dud removed: ${dud.word}`);
          play("beep");
        } else {
          attempts = D.attempts;
          setPips(attempts, D.attempts);
          appendLog("> Attempts replenished.");
          play("unlock");
        }
      } else {
        attempts = D.attempts;
        setPips(attempts, D.attempts);
        appendLog("> Attempts replenished.");
        play("unlock");
      }
      // disable that bracket cluster
      grid.querySelectorAll(`[data-brid="${id}"]`).forEach(el => el.classList.add("dud"));
    }
  });

  function attemptWord(w) {
    const likeness = countLikeness(w, target);
    appendLog(`> ${w}\n  Entry denied. Likeness=${likeness}/${target.length}`);
    play("error");
    attempts--;
    setPips(attempts, D.attempts);

    if (w === target) {
      appendLog("\n> Exact match.\n> Access granted.\n");
      win();
      return;
    }
    if (attempts <= 0) {
      appendLog("\n> Terminal locked. Please contact administrator.");
      lose();
    }
  }

  function appendLog(msg) {
    log.textContent += msg + "\n";
    log.scrollTop = log.scrollHeight;
  }

  function win() {
    const score = D.attempts - (D.attempts - attempts) + _diff * 2;
    recordHighScore("hacking", score);
    play("achievement");

    const s = loadState();
    if (opts.encrypted && !s.encrypted_decoded) {
      mutate(st => { st.encrypted_decoded = true; });
      unlock("decoded", "DECODED", "VAULT-TEC PRESIDENT MEMO unlocked");
      setTimeout(() => pipAlert(
        "VAULT-TEC PRESIDENT — RECORDED 2076",
        `<p style="font-family:var(--font-mono);font-size:16px;line-height:1.4;opacity:0.9">
          &gt; …the experiments aren't really for science. They're advertising.
          Each Vault is a focus group with the lights on. Don't tell the boys
          upstairs I said that.
        </p>`
      ), 400);
    }

    if (((s.achievements || []).filter(a => a === "robco_run").length + 1) >= 5) {
      unlock("robco_hacker", "ACHIEVEMENT", "ROBCO Hacker — 5 successful runs");
    }
    mutate(st => { st.achievements.push("robco_run"); });

    setTimeout(() => newRound(opts), 1400);
  }

  function lose() {
    play("error");
    setTimeout(() => newRound(opts), 1800);
  }
}

function tokenizeRow(row, raw, placed, bracketSpans) {
  // Build token spans for bracketed clusters and words; everything else is text.
  const ranges = [];
  for (const p of placed.filter(x => x.row === row)) ranges.push({ ...p, kind: "word" });
  for (let i = 0; i < bracketSpans.length; i++) {
    const b = bracketSpans[i];
    if (b.row === row) ranges.push({ ...b, kind: "bracket", brid: "b" + i });
  }
  ranges.sort((a, b) => a.start - b.start);

  let html = "";
  let cur = 0;
  for (const r of ranges) {
    html += escape(raw.slice(cur, r.start));
    const slice = raw.slice(r.start, r.end);
    if (r.kind === "word") {
      html += `<span class="tok" data-kind="word" data-word="${r.word}">${escape(slice)}</span>`;
    } else {
      html += `<span class="tok" data-kind="bracket" data-brid="${r.brid}">${escape(slice)}</span>`;
    }
    cur = r.end;
  }
  html += escape(raw.slice(cur));
  return html;
}

function countLikeness(a, b) {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) n++;
  return n;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function escape(s) {
  return String(s).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
}
