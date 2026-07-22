// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// tabs/inv.js — INV tab. Categories, item rows, "use" actions.

import { loadState, mutate, subscribe } from "../state.js";
import { play } from "../sound.js";
import { bobblePixel } from "../bobbleheads.js";
import { toast } from "../achievements.js";
import { isGameRunning } from "../games/canvas-helpers.js";

const CATEGORIES = [
  { id: "weapons",  label: "WEAPONS"  },
  { id: "apparel",  label: "APPAREL"  },
  { id: "aid",      label: "AID"      },
  { id: "misc",     label: "MISC"     },
  { id: "ammo",     label: "AMMO"     },
  { id: "keys",     label: "KEYS"     },
];

let _activeCat = "weapons";
let _selected = 0;
let _unsub = null;

export function mount(el, ctx) {
  renderSubtabs(ctx.subtabs);
  render(el);
  _unsub = subscribe(() => { if (!isGameRunning()) render(el); });
}

export function unmount() {
  if (_unsub) _unsub();
  _unsub = null;
}

function renderSubtabs(subEl) {
  subEl.innerHTML = CATEGORIES.map(c => `
    <button class="subtab" data-cat="${c.id}" aria-selected="${_activeCat === c.id}" role="tab">${c.label}</button>
  `).join("");
  subEl.querySelectorAll(".subtab").forEach(b => {
    b.addEventListener("click", () => {
      _activeCat = b.dataset.cat;
      _selected = 0;
      subEl.querySelectorAll(".subtab").forEach(x =>
        x.setAttribute("aria-selected", x.dataset.cat === _activeCat));
      render(document.getElementById("content"));
      play("tab_click");
    });
  });
}

function render(el) {
  const s = loadState();
  const items = (s.inventory[_activeCat] || []);
  const sel = items[_selected];
  const bobbleAfter = _activeCat === "weapons";

  el.innerHTML = `
    <div class="split">
      <section style="overflow:auto">
        <h2 style="letter-spacing:3px;margin:0 0 6px">
          ${CATEGORIES.find(c => c.id === _activeCat).label}
          ${bobbleAfter ? bobblePixel("P") : ""}
        </h2>
        <ul class="list">
          ${items.length ? items.map((it, i) => `
            <li data-i="${i}" aria-selected="${i === _selected}">
              <span class="name">${escape(it.name)}${it.locked ? " 🔒" : ""}</span>
              <span class="badges">
                ${it.qty != null ? `<span class="badge">x${it.qty}</span>` : ""}
                ${it.dmg != null ? `<span class="badge">DMG ${it.dmg}</span>` : ""}
                ${it.dr  != null ? `<span class="badge">DR ${it.dr}</span>` : ""}
                ${it.weight != null ? `<span class="badge">WG ${it.weight}</span>` : ""}
                ${it.value != null ? `<span class="badge">$${it.value}</span>` : ""}
              </span>
            </li>`).join("") : `<li><span class="name">— empty —</span></li>`}
        </ul>
      </section>

      <section>
        ${sel ? `
          <div class="card">
            <h3>${escape(sel.name)}</h3>
            ${sel.condition != null ? `
              <div class="kv"><label>Condition</label><span>${Math.round(sel.condition*100)}%</span></div>
              <div class="bar2"><div class="f" style="width:${sel.condition*100}%"></div></div>
            ` : ""}
            <div class="kv"><label>Weight</label><span>${sel.weight ?? 0}</span></div>
            <div class="kv"><label>Value</label><span>${sel.value ?? 0}</span></div>
            ${sel.dmg != null ? `<div class="kv"><label>Damage</label><span>${sel.dmg}</span></div>` : ""}
            ${sel.dr  != null ? `<div class="kv"><label>Damage Resist</label><span>${sel.dr}</span></div>` : ""}
            ${sel.qty != null ? `<div class="kv"><label>Quantity</label><span>${sel.qty}</span></div>` : ""}
            ${sel.effect ? `<div class="kv"><label>Effect</label><span>${sel.effect}</span></div>` : ""}
            <div style="display:flex;gap:8px;margin-top:8px">
              ${canUse(sel) ? `<button class="btn" id="useBtn">${useLabel(_activeCat)}</button>` : ""}
              ${_activeCat === "apparel" && !sel.locked ? `<button class="btn" id="equipBtn">${sel.equipped ? "UNEQUIP" : "EQUIP"}</button>` : ""}
              ${_activeCat === "misc" || _activeCat === "keys" ? `<button class="btn" id="dropBtn">EXAMINE</button>` : ""}
              <button class="btn tiny danger" id="dropOne">DROP 1</button>
            </div>
            ${sel.locked ? `<p style="opacity:.7;font-size:14px;font-family:var(--font-mono)">REQUIRES Power Armor Training. Find a frame and a fusion core.</p>` : ""}
          </div>
        ` : ""}
      </section>
    </div>
  `;

  // Wire row clicks
  el.querySelectorAll(".list li").forEach(li => {
    li.addEventListener("click", () => {
      _selected = parseInt(li.dataset.i, 10);
      render(el);
      play("key_press");
    });
  });

  const use = el.querySelector("#useBtn");
  if (use) use.addEventListener("click", () => useItem(_activeCat, _selected));
  const eq = el.querySelector("#equipBtn");
  if (eq) eq.addEventListener("click", () => equipItem(_selected));
  const drop = el.querySelector("#dropOne");
  if (drop) drop.addEventListener("click", () => dropOne(_activeCat, _selected));
}

function canUse(it) {
  if (it.locked) return false;
  return Boolean(it.effect) || it.id === "fusion_core" || it.id === "bottlecap_mine";
}

function useLabel(cat) {
  if (cat === "aid")  return "USE";
  if (cat === "ammo") return "INSPECT";
  return "EXAMINE";
}

function useItem(cat, i) {
  mutate(s => {
    const it = s.inventory[cat][i];
    if (!it) return;
    if (it.effect) {
      applyEffect(s, it.effect);
      if (it.qty != null) {
        it.qty -= 1;
        if (it.qty <= 0) s.inventory[cat].splice(i, 1);
      }
    } else if (it.id === "fusion_core") {
      s.battery_pct = 100;
      it.qty -= 1;
      if (it.qty <= 0) s.inventory.misc.splice(i, 1);
      toast("FUSION CELL", "fully charged");
    } else if (it.id === "bottlecap_mine") {
      s.caps += 5;
      it.qty -= 1;
      if (it.qty <= 0) s.inventory.misc.splice(i, 1);
      toast("BOOM", "+5 caps recovered from shrapnel");
    }
  });
  play("beep");
}

function applyEffect(s, eff) {
  for (const part of eff.split(",")) {
    const m = part.match(/^([a-z]+)([+-])(\d+)$/i);
    if (!m) continue;
    const [, key, sign, val] = m;
    const v = parseInt(val, 10) * (sign === "+" ? 1 : -1);
    if (key === "hp")  s.hp = clamp(s.hp + v, 0, s.hp_max);
    else if (key === "ap") s.ap = clamp(s.ap + v, 0, s.ap_max);
    else if (key === "rad") s.rad = clamp(s.rad + v, 0, s.rad_max);
  }
}

function equipItem(i) {
  mutate(s => {
    const arr = s.inventory.apparel;
    const it = arr[i];
    if (!it || it.locked) return;
    if (it.equipped) { it.equipped = false; return; }
    arr.forEach(a => a.equipped = false);
    it.equipped = true;
  });
  play("tab_click");
}

function dropOne(cat, i) {
  mutate(s => {
    const it = s.inventory[cat][i];
    if (!it) return;
    if (it.qty != null) {
      it.qty -= 1;
      if (it.qty <= 0) s.inventory[cat].splice(i, 1);
    } else {
      s.inventory[cat].splice(i, 1);
    }
  });
  play("error");
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function escape(s) { return String(s).replace(/[<>&]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;"}[c])); }
