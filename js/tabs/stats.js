// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// tabs/stats.js — STATS tab.
// SPECIAL grid w/ in-page detail panel, name/sex/class, Vault Boy, HP/AP/RAD, perks, karma, RANDOMISE.

import { loadState, mutate, subscribe, karmaTitle, randomiseEverything } from "../state.js";
import { play } from "../sound.js";
import { bobblePixel } from "../bobbleheads.js";
import { unlock } from "../achievements.js";
import { isGameRunning } from "../games/canvas-helpers.js";
import { exists } from "../img.js";

const SPECIAL_INFO = {
  S: { name: "STRENGTH",     desc: "Raw physical power. Carry weight + melee damage." },
  P: { name: "PERCEPTION",   desc: "Environmental awareness. VATS accuracy at range." },
  E: { name: "ENDURANCE",    desc: "Health, healing rate, radiation/poison resistance." },
  C: { name: "CHARISMA",     desc: "Likability. Barter and speech bonuses." },
  I: { name: "INTELLIGENCE", desc: "Skill points per level; science/repair/medicine." },
  A: { name: "AGILITY",      desc: "Quickness. AP pool used in V.A.T.S." },
  L: { name: "LUCK",         desc: "Boosts all skills. Critical chance with weapons." },
};

const PERKS = [
  // Currently-owned perks (filled from state.perks)
  { id: "wanderer",            name: "Lone Wanderer",       max_rank: 3, req: { L: 3 },
    desc: "Solitude is its own reward. While travelling without a human companion, you take less damage and carry more loot.",
    ranks: ["+15% damage. +50 carry weight.", "+25% damage. +75 carry weight.", "+30% damage. +100 carry weight; faster move speed."],
    source: "Pre-war survivalist pamphlet" },
  { id: "bloody_mess",         name: "Bloody Mess",         max_rank: 3, req: { L: 3 },
    desc: "Enemies sometimes explode in a satisfying mist. Cosmetic, mostly.",
    ranks: ["+5% all damage; +5% gore.", "+10% damage; nearby enemies briefly stagger when one bursts.", "+15% damage; gore spreads further."],
    source: "Childhood viewing of late-night vault TV" },
  { id: "mysterious_stranger", name: "Mysterious Stranger", max_rank: 4, req: { L: 1 },
    desc: "When you most need it (and sometimes when you least expect it) the Stranger appears in V.A.T.S. and ends the encounter on your behalf.",
    ranks: ["~5% chance per V.A.T.S. action.", "~7% chance.", "~10% chance.", "~12% chance, plus a chance of a critical kill."],
    source: "Folklore. He has a coat. He has a gun." },
  { id: "black_widow",         name: "Black Widow",         max_rank: 3, req: { C: 5 },
    desc: "You handle people who weren't expecting you to handle them at all.",
    ranks: ["+10% damage; new dialogue options.", "Better barter prices.", "Companion affinity gains accelerate."],
    source: "A long story involving a casino and a tax bracket" },
  { id: "mr_sandman",          name: "Mister Sandman",      max_rank: 3, req: { A: 4 },
    desc: "An assassin's perk. Quiet kills, on quiet targets, in quiet places.",
    ranks: ["+15% damage with silenced weapons.", "Instant-kill sleeping NPCs.", "Bonus XP per silent takedown."],
    source: "Six months at a reading retreat that wasn't" },
  { id: "cannibal",            name: "Cannibal",            max_rank: 3, req: { E: 3 },
    desc: "Restore HP by feeding on corpses. People will be unsettled. So will you, eventually.",
    ranks: ["Eat fresh corpses for HP.", "Eat ghoul corpses without penalty.", "Eat super-mutant corpses too."],
    source: "Long winter at the Sierra Madre" },
  { id: "wild_wasteland_perk", name: "Wild Wasteland",      max_rank: 1, req: { L: 1 },
    desc: "You embrace the absurd. Some encounters become extremely strange. Some loot is, well, you'll see.",
    ranks: ["Active. Reality is now negotiable."],
    source: "A Vault-Tec advertising mistake" },
  // Locked / aspirational perks — discoverable in the panel even before unlock
  { id: "intense_training",    name: "Intense Training",    max_rank: 10, req: { I: 1 },
    desc: "Add one point to a chosen SPECIAL stat. Learnable repeatedly until you cap out.",
    ranks: Array.from({length: 10}, (_,i) => `+1 to one SPECIAL (rank ${i+1}/10).`),
    source: "Reflection over a long walk", lore_locked: true },
  { id: "comprehension",       name: "Comprehension",       max_rank: 1, req: { I: 4 },
    desc: "Each Pip-Boy holotape and skill book grants more progress than the last.",
    ranks: ["+1 skill point per book/holotape used."],
    source: "A library you found mostly intact", lore_locked: true },
  { id: "swift_learner",       name: "Swift Learner",       max_rank: 3, req: { I: 4 },
    desc: "You retain everything the wasteland is willing to teach you.",
    ranks: ["+5% XP gain.", "+10% XP gain.", "+20% XP gain."],
    source: "An Overseer who never quite figured you out", lore_locked: true },
  { id: "bobblehead_hunter",   name: "Bobblehead Hunter",   max_rank: 1, req: { L: 4 },
    desc: "You sense Vault-Tec promotional materials at greater range. Find them all.",
    ranks: ["Bobbleheads occasionally pulse on the Pip-Boy compass."],
    source: "A persistent itch", lore_locked: true },
];

// Module-level selection state for the perks panel
let _perkFocus = null;

let _unsub = null;
// Selected/hovered SPECIAL stat for the inline detail panel. Persists across renders.
let _statFocus = "S";

export function mount(el) {
  render(el);
  _unsub = subscribe(() => { if (!isGameRunning()) render(el); });
}

export function unmount() {
  if (_unsub) _unsub();
  _unsub = null;
}

function render(el) {
  const s = loadState();
  const wild = s.wild_wasteland;
  const focus = SPECIAL_INFO[_statFocus] || SPECIAL_INFO.S;
  const focusVal = s.special?.[_statFocus] ?? 0;

  el.innerHTML = `
    <div class="split">
      <section>
        <h2 style="letter-spacing:3px;margin:0 0 6px;display:flex;align-items:baseline;gap:10px">
          STATS <span style="font-size:14px;color:var(--phosphor-dim);letter-spacing:2px">— ${escape(s.name || "DWELLER")}</span>
        </h2>

        <div class="card">
          <h3>S.P.E.C.I.A.L. ${bobblePixel("S")}</h3>
          <div class="special">
            ${["S","P","E","C","I","A","L"].map(k => `
              <div class="stat ${_statFocus === k ? "focus" : ""}" data-stat="${k}" tabindex="0">
                <div class="l">${k}</div>
                <div class="v">${s.special[k]}</div>
                <div class="nm">${SPECIAL_INFO[k].name.slice(0,3)}</div>
              </div>
            `).join("")}
          </div>
          <div class="special-detail" id="stat-detail">
            <span class="sd-name">${escape(focus.name)} <span class="sd-val">[${focusVal}]</span></span>
            <span class="sd-desc">${escape(focus.desc)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;font-family:var(--font-mono);font-size:13px;color:var(--phosphor-dim);margin-top:6px">
            <span>${s.dev_unlocked ? "[DEV ROOM ENABLED]" : "Hover or click a stat for details."}</span>
            <span style="display:flex;gap:6px">
              <button id="randall" class="btn tiny" title="Randomise all character data">RANDOMISE</button>
            </span>
          </div>
        </div>

        <div class="card">
          <h3>STATUS</h3>
          <div class="kv"><label>Health</label><span>${s.hp}/${s.hp_max}</span></div>
          <div class="kv"><label>Action Points</label><span>${s.ap}/${s.ap_max}</span></div>
          <div class="kv"><label>Radiation</label><span>${s.rad}/${s.rad_max}</span></div>
          <div class="kv"><label>Level</label><span>${s.level} (${s.xp || 0} XP)</span></div>
          <div class="kv"><label>Caps</label><span>${s.caps}</span></div>
          <div class="kv"><label>Status</label><span>${statusFlavor(s, wild)}</span></div>
        </div>

        <div class="card karma">
          <h3>KARMA</h3>
          <div class="kv"><label>Title</label><span>${karmaTitle(s.karma)}</span></div>
          <div class="kv"><label>Score</label><span>${s.karma >= 0 ? "+" : ""}${s.karma}</span></div>
          <div class="track" aria-hidden="true">
            <div class="indicator" style="left:${karmaPct(s.karma)}%"></div>
          </div>
          <div class="lbls"><span>VERY EVIL</span><span>NEUTRAL</span><span>SAINT</span></div>
        </div>
      </section>

      <section>
        <div class="card vbox">
          <div id="vbslot"></div>
          <div class="meta">
            <div class="kv"><label>Name</label><span>${escape(s.name || "DWELLER")}</span></div>
            <div class="kv"><label>Vault</label><span>${s.vault_number}</span></div>
            <div class="kv"><label>Sex</label><span>${escape(s.sex || "—")}</span></div>
            <div class="kv"><label>Class</label><span>${escape((s.klass || "WANDERER").toUpperCase())}</span></div>
            <div class="kv"><label>Plays</label><span>${prettySeconds(s.play_seconds)}</span></div>
            <p style="font-size:14px;font-family:var(--font-mono);opacity:.75;margin:6px 0 0">
              ${wild ? "[WILD WASTELAND] You feel a strange tingle." : "Stay positive! Vault-Tec believes in you."}
            </p>
          </div>
        </div>

        <div class="card perks-card">
          <h3>PERKS ${bobblePixel("A")}</h3>
          ${renderPerksUI(s)}
        </div>
      </section>
    </div>
  `;

  // Perks: row click → select; RANK UP button if requirements met
  el.querySelectorAll("[data-perk]").forEach(li => {
    li.addEventListener("click", () => {
      _perkFocus = li.dataset.perk;
      play("key_press");
      render(el);
    });
  });
  const rankBtn = el.querySelector("#perk-rankup");
  if (rankBtn) rankBtn.addEventListener("click", () => {
    const id = _perkFocus;
    const def = PERKS.find(p => p.id === id);
    if (!def) return;
    mutate(st => {
      st.perk_ranks = st.perk_ranks || {};
      const cur = st.perk_ranks[id] || (st.perks.includes(id) ? 1 : 0);
      if (cur >= def.max_rank) return;
      // Take the perk if not already
      if (!st.perks.includes(id)) st.perks.push(id);
      st.perk_ranks[id] = cur + 1;
    });
    play("achievement");
    unlock("perk_ranked", "PERK ACQUIRED", `${PERKS.find(p => p.id === id).name} ranked up`);
  });

  // SPECIAL: hover + click + keyboard focus updates the detail panel.
  el.querySelectorAll("[data-stat]").forEach(cell => {
    const k = cell.dataset.stat;
    const setFocus = () => {
      _statFocus = k;
      el.querySelectorAll("[data-stat]").forEach(c => c.classList.toggle("focus", c.dataset.stat === k));
      const d = el.querySelector("#stat-detail");
      if (d) {
        const info = SPECIAL_INFO[k];
        d.querySelector(".sd-name").innerHTML = `${escape(info.name)} <span class="sd-val">[${loadState().special[k]}]</span>`;
        d.querySelector(".sd-desc").textContent = info.desc;
      }
    };
    cell.addEventListener("mouseenter", setFocus);
    cell.addEventListener("focus", setFocus);
    cell.addEventListener("click", () => { setFocus(); play("key_press"); });
  });

  // Insert Vault Boy: image override if /assets/img/vault-boy.png exists, else SVG fallback.
  const slot = el.querySelector("#vbslot");
  exists("vault-boy.png").then(useImg => {
    if (useImg) {
      slot.innerHTML = `<img src="./assets/img/vault-boy.png" alt="Vault dweller" style="width:160px;height:auto;display:block;cursor:pointer;filter:drop-shadow(0 0 6px var(--phosphor-glow));"/>`;
      slot.querySelector("img").addEventListener("click", onVbClick);
      return;
    }
    fetch("./assets/svg/vault-boy.svg").then(r => r.text()).then(svgStr => {
      slot.innerHTML = svgStr;
      const num = slot.querySelector(".vb-num");
      if (num) num.textContent = String(s.vault_number).padStart(3, "0");
      const svgEl = slot.querySelector("svg");
      if (svgEl) svgEl.addEventListener("click", onVbClick);
    });
  });

  function onVbClick() {
    mutate(st => { st.click_counts.vault_boy = (st.click_counts.vault_boy || 0) + 1; });
    play("key_press");
    const c = loadState().click_counts.vault_boy;
    if (c === 100) {
      unlock("vb_clicker", "ACHIEVEMENT", "Bobblehead Spawned — clicked Vault Boy 100 times");
      mutate(st => {
        if (!st.found_bobbleheads.includes("L")) st.found_bobbleheads.push("L");
        st.special.L = Math.min(10, st.special.L + 1);
      });
    }
    const eye = slot.querySelector(".wink-eye");
    if (eye) {
      eye.style.transition = "opacity 100ms";
      eye.style.opacity = "0";
      setTimeout(() => eye.style.opacity = "1", 200);
    }
  }

  // RANDOMISE — wipes name/vault/sex/class/SPECIAL/karma to a fresh roll.
  el.querySelector("#randall").addEventListener("click", () => {
    randomiseEverything();
    play("unlock");
  });
}

function renderPerksUI(s) {
  const owned = PERKS.filter(p => s.perks.includes(p.id));
  const locked = PERKS.filter(p => !s.perks.includes(p.id));
  const ranks = s.perk_ranks || {};
  if (!_perkFocus) _perkFocus = owned[0]?.id || locked[0]?.id || null;
  const def = PERKS.find(p => p.id === _perkFocus);
  const curRank = def ? (ranks[def.id] || (s.perks.includes(def.id) ? 1 : 0)) : 0;
  const meetsReq = def ? Object.entries(def.req || {}).every(([k, v]) => (s.special?.[k] || 0) >= v) : false;
  const canRankUp = def && curRank < def.max_rank && meetsReq;

  return `
    <div class="perks-split">
      <div class="perks-lists">
        <div class="perks-group">
          <h4 class="perks-h">OWNED <span class="perks-count">${owned.length}</span></h4>
          <ul class="perks-list">
            ${owned.map(p => perkRow(p, ranks[p.id] || 1, s)).join("") || `<li class="empty">— none yet —</li>`}
          </ul>
        </div>
        <div class="perks-group">
          <h4 class="perks-h">AVAILABLE <span class="perks-count">${locked.length}</span></h4>
          <ul class="perks-list locked">
            ${locked.map(p => perkRow(p, 0, s)).join("") || `<li class="empty">— all acquired —</li>`}
          </ul>
        </div>
      </div>

      <div class="perks-detail">
        ${def ? renderPerkDetail(def, curRank, meetsReq, canRankUp, s) : `<p style="opacity:.7">Select a perk for details.</p>`}
      </div>
    </div>
  `;
}

function perkRow(p, rank, s) {
  const isFocus = _perkFocus === p.id;
  const meetsReq = Object.entries(p.req || {}).every(([k, v]) => (s.special?.[k] || 0) >= v);
  const isOwned = s.perks.includes(p.id);
  return `
    <li data-perk="${p.id}" class="${isFocus ? "sel" : ""} ${isOwned ? "owned" : "locked"} ${meetsReq ? "ready" : "blocked"}">
      <span class="p-bullet">${isOwned ? "◆" : (meetsReq ? "◇" : "·")}</span>
      <span class="p-name">${escape(p.name)}</span>
      <span class="p-rank">${isOwned ? rankStars(rank, p.max_rank) : reqLabel(p.req)}</span>
    </li>
  `;
}

function rankStars(cur, max) {
  return Array.from({ length: max }, (_, i) => i < cur ? "★" : "☆").join("");
}

function reqLabel(req) {
  return Object.entries(req || {}).map(([k, v]) => `${k}${v}`).join(" ");
}

function renderPerkDetail(def, rank, meetsReq, canRankUp, s) {
  const reqs = Object.entries(def.req || {});
  return `
    <article class="perk-card">
      <header>
        <h3 class="p-title">${escape(def.name)}</h3>
        <div class="p-sub">
          ${reqs.length ? `
            <span>REQ:</span>
            ${reqs.map(([k, v]) => `<span class="p-req ${(s.special[k] || 0) >= v ? "ok" : "no"}">${k} ${v}</span>`).join(" ")}
          ` : ""}
          ${def.max_rank > 1 ? `<span>·</span><span>Rank ${rank}/${def.max_rank}</span>` : ""}
        </div>
      </header>
      <p class="p-blurb">${escape(def.desc)}</p>

      <h4 class="p-h">RANKS</h4>
      <ul class="p-ranks">
        ${def.ranks.map((r, i) => `
          <li class="${i < rank ? "have" : ""} ${i === rank ? "next" : ""}">
            <span class="p-rk">${i + 1}</span>
            <span class="p-rd">${escape(r)}</span>
          </li>
        `).join("")}
      </ul>

      ${def.source ? `<p class="p-source">SOURCE: <em>${escape(def.source)}</em></p>` : ""}

      <div class="p-actions">
        ${canRankUp
          ? `<button class="btn tiny" id="perk-rankup">${rank === 0 ? "TAKE PERK" : "RANK UP"}</button>`
          : (rank >= def.max_rank
              ? `<button class="btn tiny" disabled>MAX RANK</button>`
              : `<button class="btn tiny" disabled>REQUIREMENTS NOT MET</button>`)
        }
      </div>
    </article>
  `;
}

function karmaPct(k) {
  const p = (k + 1000) / 2000 * 100;
  return Math.max(0, Math.min(100, p));
}

function statusFlavor(s, wild) {
  if (s.rad > s.rad_max * 0.6) return "HEAVILY IRRADIATED";
  if (s.rad > s.rad_max * 0.2) return "Slightly Irradiated";
  if (s.hp < s.hp_max * 0.3) return "Critical condition";
  if (wild) return "Wild Wasteland tickling the synapses";
  const flavors = ["Well Rested", "Steady", "Reasonably Functional", "Hopeful", "Slightly thirsty"];
  return flavors[(new Date().getMinutes()) % flavors.length];
}

function prettySeconds(t) {
  const m = Math.floor((t || 0) / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m/60)}h ${m % 60}m`;
}

function escape(s) {
  return String(s).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
}
