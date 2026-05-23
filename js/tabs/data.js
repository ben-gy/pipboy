// tabs/data.js — DATA tab. Quests, Notes, Holotapes, Achievements.

import { loadState, mutate, subscribe } from "../state.js";
import { play } from "../sound.js";
import { bobblePixel } from "../bobbleheads.js";
import { unlock } from "../achievements.js";
import { isGameRunning } from "../games/canvas-helpers.js";
import { exists } from "../img.js";
import { pipConfirm } from "../modal.js";
import { LOCATIONS } from "../world-locations.js";

// Rich quest data — original parody/homage. Objectives are click-toggleable;
// when all objectives are checked, the quest can be marked complete and rewards
// are awarded. "loc_id" links to a real map marker so "Track on Map" works.
const QUEST_DEFS = {
  out_of_time: {
    name: "Out of Time",
    giver: "Codsworth",
    loc_id: "sanctuary",
    blurb: "You stepped out of cryosleep. Codsworth is the only friendly face left in Sanctuary, and he's been holding onto a story for two centuries.",
    objectives: [
      "Speak with Codsworth in Sanctuary",
      "Investigate the kidnapper's trail through Concord",
      "Find a clue at the Museum of Freedom",
    ],
    reward: { caps: 100, xp: 250 },
  },
  reillys: {
    name: "Reilly's Rangers",
    giver: "Reilly",
    loc_id: "rivet_city",
    blurb: "Reilly's mercenary squad is pinned down on top of the Statesman Hotel. Bring them home alive.",
    objectives: [
      "Talk to Reilly at the Underworld clinic",
      "Reach the Statesman Hotel rooftop",
      "Cover the squad's extraction",
    ],
    reward: { caps: 200, xp: 400 },
  },
  come_fly: {
    name: "Come Fly With Me",
    giver: "Jason Bright",
    loc_id: "newvegas",
    blurb: "The Bright Brotherhood at REPCONN want to fly to the Great Beyond. The rocket needs a serious tune-up.",
    objectives: [
      "Clear the REPCONN test site",
      "Recover the rocket fuel",
      "Watch the launch",
    ],
    reward: { caps: 250, xp: 500 },
  },
  silver_shroud: {
    name: "The Silver Shroud",
    giver: "Kent Connolly",
    loc_id: "goodneigh",
    blurb: "Become the Silver Shroud — a noir radio hero made flesh — and clean up Goodneighbor's worst.",
    objectives: [
      "Don the Silver Shroud costume",
      "Deliver justice in your best radio-drama voice",
    ],
    reward: { caps: 200, xp: 350 },
  },
  patrol_mojave: {
    name: "Patrolling the Mojave",
    giver: "NCR Trooper",
    loc_id: "mojave",
    blurb: "Patrolling the Mojave almost makes you wish for a nuclear winter.",
    objectives: [
      "Walk the perimeter at the Mojave Outpost",
    ],
    reward: { caps: 50, xp: 150 },
  },
  // Pre-completed lore quest
  first_steps: {
    name: "First Steps",
    giver: "Vault-Tec",
    loc_id: "vault111",
    blurb: "You opened the Vault door. The Wasteland is wide and unkind. Welcome to it.",
    objectives: ["Leave the Vault"],
    reward: { caps: 0, xp: 100 },
  },
};

let _selectedQuest = null;

const HOLOTAPES = [
  { id: "hacking",     name: "ROBCO TERM-LINK",     mod: () => import("../games/hacking.js"),     desc: "Authentic ROBCO terminal puzzle." },
  { id: "lockpick",    name: "LOCKPICKING",         mod: () => import("../games/lockpick.js"),    desc: "Bobby pin & screwdriver." },
  { id: "red-menace",  name: "RED MENACE",          mod: () => import("../games/red-menace.js"),  desc: "Climb the girders. Save the maiden." },
  { id: "atomic-cmd",  name: "ATOMIC COMMAND",      mod: () => import("../games/atomic-cmd.js"),  desc: "Defend eight cities." },
  { id: "zeta",        name: "ZETA INVADERS",       mod: () => import("../games/zeta.js"),        desc: "Repel the Zetan armada." },
  { id: "pipfall",     name: "PIPFALL",             mod: () => import("../games/pipfall.js"),     desc: "Vines, scorpions, bobbleheads." },
  { id: "encrypted",   name: "[ENCRYPTED]",         mod: () => import("../games/hacking.js"),     desc: "Source unknown.", encrypted: true },
];

const SUBTABS = [
  { id: "quests", label: "QUESTS" },
  { id: "notes",  label: "NOTES"  },
  { id: "holos",  label: "HOLOTAPES" },
  { id: "ach",    label: "ACHIEVEMENTS" },
  { id: "recs",   label: "WORKSHOP" },
];

let _sub = "quests";
let _unsub = null;

export function mount(el, ctx) {
  const restore = sessionStorage.getItem("pipboy:data:sub");
  if (restore && SUBTABS.some(s => s.id === restore)) _sub = restore;

  ctx.subtabs.innerHTML = SUBTABS.map(s => `
    <button class="subtab" data-sub="${s.id}" aria-selected="${_sub === s.id}" role="tab">${s.label}</button>
  `).join("");
  ctx.subtabs.querySelectorAll(".subtab").forEach(b => {
    b.addEventListener("click", () => {
      _sub = b.dataset.sub;
      sessionStorage.setItem("pipboy:data:sub", _sub);
      ctx.subtabs.querySelectorAll(".subtab").forEach(x =>
        x.setAttribute("aria-selected", x.dataset.sub === _sub));
      render(el);
      play("tab_click");
    });
  });

  render(el);
  _unsub = subscribe(() => { if (!isGameRunning()) render(el); });
}

export function unmount() {
  if (_unsub) _unsub();
  _unsub = null;
}

function render(el) {
  const s = loadState();
  if (_sub === "quests") return renderQuests(el, s);
  if (_sub === "notes")  return renderNotes(el, s);
  if (_sub === "holos")  return renderHolotapes(el, s);
  if (_sub === "ach")    return renderAchievements(el, s);
  if (_sub === "recs")   return renderRecs(el, s);
}

function renderQuests(el, s) {
  // Default selection: tracked quest, else first active
  const tracked = s.quests.tracked_id;
  if (!_selectedQuest) {
    _selectedQuest = tracked || s.quests.active[0]?.id || s.quests.completed[0]?.id || null;
  }
  // If selection no longer exists, reset
  const allIds = [...s.quests.active.map(q => q.id), ...s.quests.completed.map(q => q.id)];
  if (!allIds.includes(_selectedQuest)) _selectedQuest = allIds[0] || null;

  const sel = _selectedQuest;
  const selDef = sel ? QUEST_DEFS[sel] : null;
  const isActive = sel && s.quests.active.some(q => q.id === sel);
  const isComplete = sel && s.quests.completed.some(q => q.id === sel);
  const activeRec = isActive ? s.quests.active.find(q => q.id === sel) : null;
  const objectives = activeRec?.objectives_done || [];
  const allObjectivesDone = isActive && selDef && objectives.length > 0 && objectives.every(Boolean);
  const trackedHere = tracked === sel;
  const loc = selDef ? LOCATIONS[selDef.loc_id] : null;

  el.innerHTML = `
    <div class="quests-split">
      <section class="quests-list">
        <div class="quests-section">
          <h3 class="qh">ACTIVE <span class="qcount">${s.quests.active.length}</span></h3>
          <ul class="quests-ul">
            ${s.quests.active.map(q => questRow(q, sel, tracked)).join("") || emptyRow()}
          </ul>
        </div>
        <div class="quests-section">
          <h3 class="qh">COMPLETED <span class="qcount">${s.quests.completed.length}</span></h3>
          <ul class="quests-ul completed">
            ${s.quests.completed.map(q => questRow(q, sel, tracked, true)).join("") || emptyRow()}
          </ul>
        </div>
      </section>

      <section class="quests-detail">
        ${selDef ? renderQuestDetail(selDef, sel, isActive, isComplete, objectives, allObjectivesDone, trackedHere, loc) : `<p style="opacity:.7">Select a quest from the list.</p>`}
      </section>
    </div>
  `;

  // Row clicks
  el.querySelectorAll("[data-qid]").forEach(li => {
    li.addEventListener("click", () => {
      _selectedQuest = li.dataset.qid;
      play("key_press");
      render(el);
    });
  });

  if (!selDef) return;

  // Objective toggles
  el.querySelectorAll("[data-obj]").forEach(box => {
    box.addEventListener("click", (e) => {
      e.stopPropagation();
      const i = parseInt(box.dataset.obj, 10);
      mutate(st => {
        const q = st.quests.active.find(x => x.id === sel);
        if (!q) return;
        if (!Array.isArray(q.objectives_done) || q.objectives_done.length !== selDef.objectives.length) {
          q.objectives_done = new Array(selDef.objectives.length).fill(false);
        }
        q.objectives_done[i] = !q.objectives_done[i];
      });
      play(box.classList.contains("done") ? "tab_click" : "achievement");
    });
  });

  // Track on Map
  const trackBtn = el.querySelector("#q-track");
  if (trackBtn) trackBtn.addEventListener("click", () => {
    mutate(st => {
      if (st.quests.tracked_id === sel) {
        st.quests.tracked_id = null;
        st.destination = null;
      } else {
        st.quests.tracked_id = sel;
        if (loc) st.destination = { id: selDef.loc_id, name: loc.name, x: loc.x, y: loc.y };
      }
    });
    play("achievement");
  });

  // Mark complete
  const compBtn = el.querySelector("#q-complete");
  if (compBtn) compBtn.addEventListener("click", async () => {
    if (!allObjectivesDone) return;
    const ok = await pipConfirm(
      "MARK QUEST COMPLETE",
      `<p>Finish "<strong>${escape(selDef.name)}</strong>"?</p>
       <p style="font-family:var(--font-mono);font-size:14px;opacity:.85">
         Reward: <strong>+${selDef.reward.caps} caps</strong>, +${selDef.reward.xp} XP
       </p>`,
      { confirmLabel: "TURN IN" }
    );
    if (!ok) return;
    mutate(st => {
      const idx = st.quests.active.findIndex(q => q.id === sel);
      if (idx === -1) return;
      st.quests.active.splice(idx, 1);
      st.quests.completed.unshift({ id: sel, completed_at: Date.now() });
      st.caps = (st.caps || 0) + (selDef.reward.caps || 0);
      st.xp   = (st.xp   || 0) + (selDef.reward.xp   || 0);
      // level up at every 1000 xp
      while (st.xp >= st.level * 1000) st.level = (st.level || 1) + 1;
      // Untrack if this was tracked
      if (st.quests.tracked_id === sel) { st.quests.tracked_id = null; st.destination = null; }
    });
    play("unlock");
  });

  // Reactivate (move from completed back to active)
  const reactBtn = el.querySelector("#q-reactivate");
  if (reactBtn) reactBtn.addEventListener("click", () => {
    mutate(st => {
      const idx = st.quests.completed.findIndex(q => q.id === sel);
      if (idx === -1) return;
      st.quests.completed.splice(idx, 1);
      st.quests.active.unshift({ id: sel, objectives_done: new Array(selDef.objectives.length).fill(false) });
    });
    play("tab_click");
  });
}

function questRow(q, selectedId, trackedId, completed = false) {
  const def = QUEST_DEFS[q.id];
  if (!def) return "";
  const total = def.objectives.length;
  const done  = (q.objectives_done || []).filter(Boolean).length;
  const isTracked = trackedId === q.id;
  const isSel = selectedId === q.id;
  return `
    <li data-qid="${q.id}" class="${isSel ? "sel" : ""} ${completed ? "done" : ""}">
      <span class="q-bullet">${completed ? "✓" : (done === total && total > 0) ? "◉" : "▶"}</span>
      <span class="q-name">${escape(def.name)}</span>
      ${isTracked ? `<span class="q-tag">TRACK</span>` : ""}
      ${!completed ? `<span class="q-prog">${done}/${total}</span>` : ""}
    </li>`;
}

function emptyRow() {
  return `<li class="empty"><span class="q-bullet">·</span><span class="q-name" style="opacity:.5">— none —</span></li>`;
}

function renderQuestDetail(def, id, isActive, isComplete, objectives, allDone, tracked, loc) {
  return `
    <article class="quest-card">
      <header>
        <h3 class="q-title">${escape(def.name)}</h3>
        <div class="q-sub">
          <span>FROM <strong>${escape(def.giver)}</strong></span>
          <span>·</span>
          <span>${loc ? escape(loc.name) : "—"}</span>
        </div>
      </header>
      <p class="q-blurb">${escape(def.blurb)}</p>

      <h4 class="q-h">OBJECTIVES</h4>
      <ul class="q-objs">
        ${def.objectives.map((o, i) => {
          const done = isActive ? !!objectives[i] : isComplete;
          return `
            <li class="${done ? "done" : ""}">
              ${isActive
                ? `<button class="q-check ${done ? "done" : ""}" data-obj="${i}" aria-label="${done ? "Uncheck" : "Check"} objective"></button>`
                : `<span class="q-check ${done ? "done" : ""}" aria-hidden="true"></span>`}
              <span class="q-text">${escape(o)}</span>
            </li>`;
        }).join("")}
      </ul>

      <div class="q-rewards">
        REWARD: <strong>+${def.reward.caps} caps</strong> · +${def.reward.xp} XP
      </div>

      <div class="q-actions">
        ${isActive ? `
          ${loc ? `<button class="btn tiny" id="q-track">${tracked ? "UNTRACK" : "TRACK ON MAP"}</button>` : ""}
          <button class="btn tiny" id="q-complete" ${allDone ? "" : "disabled"}>
            ${allDone ? "TURN IN" : `MARK COMPLETE (${objectives.filter(Boolean).length}/${def.objectives.length})`}
          </button>
        ` : ""}
        ${isComplete ? `<button class="btn tiny ghost" id="q-reactivate">REACTIVATE</button>` : ""}
      </div>
    </article>
  `;
}

const NOTES_BANK = [
  {
    id: "eyebot_broadcast",
    title: "Eyebot Broadcast",
    author: "Eyebot 7G",
    date_template: "2287-MM-DD",      // today's MM-DD filled in dynamically
    tag: "BROADCAST",
    body: (s, wild) => `> EYEBOT BROADCAST 2287-{MD}
> Tandi sends greetings to all wandering souls. The new caravan
> route through the Hub is open. ROBCO IND. terminals received
> firmware 7.1.0.8 — please re-cycle your Pip-Boy at next idle.
${wild ? "> P.S. The geckos are speaking French again.\n" : ""}> End of broadcast.`,
  },
  {
    id: "vault_tec_memo",
    title: "Vault-Tec Memo — Experimental Protocol",
    author: "Asst. Director Holloway",
    date: "2076-10-21",
    tag: "MEMO",
    body: (s) => `> VAULT-TEC MEMO — 2076-10-21
> Re: Vault ${s.vault_number} Experimental Protocol
>
> [REDACTED] [REDACTED] [REDACTED]. Subject is to be told
> that the experiment was [REDACTED]. Refer all complaints
> to the Overseer.
>
> THANK YOU FOR CHOOSING VAULT-TEC.`,
  },
  {
    id: "three_dog_log",
    title: "GNR Programme Log",
    author: "Three Dog",
    date: "2287-08-03",
    tag: "RADIO",
    body: () => `> THREE DOG, GNR — log entry
> Children, out there in the great wide wasteland —
> keep your chins up. Eat your radroach jerky.
> And don't trust anyone wearing power armour
> that smells like Enclave. Owooo!`,
  },
  {
    id: "moriarty_ledger",
    title: "Moriarty's Saloon — Ledger Page",
    author: "Colin Moriarty",
    date: "2277-06-12",
    tag: "LEDGER",
    body: () => `> SALOON LEDGER — Megaton
>
> Whiskey:     16 bottles received, 14 sold.
> Mole rat:    "fresh," 11 plates moved.
> Rumours:     three new, two sold to caravans.
> Mister Burke: paid in full, terms accepted.
> Note: stop watering down Gob's drinks. It's noticeable.`,
  },
  {
    id: "nuka_promo",
    title: "Nuka-Cola Promotional Insert",
    author: "Nuka-Cola Corp.",
    date: "2076-07-04",
    tag: "AD",
    body: () => `> COLLECT ALL TWELVE!
>
> Now in NEW NUKA-COLA QUANTUM — the radioactive
> sparkle in every sip. Twice the calories of an
> ordinary cola. Three times the Strontium!*
>
> *Strontium is a metal. Consult your physician.`,
  },
  {
    id: "lost_pip_password",
    title: "Pip-Boy Lost-Password Recovery",
    author: "ROBCO Customer Care",
    date: "2076-04-15",
    tag: "SUPPORT",
    body: () => `> Dear valued customer,
>
> If you have forgotten your Pip-Boy password,
> please reverse-engineer your local ROBCO
> terminal using a small steel bracket and a
> firm understanding of "likeness". Good luck.
>
> Yours in solidarity,
> ROBCO IND. (TM) Customer Care`,
  },
  {
    id: "field_notes",
    title: "Field Notes — Wanderer Unknown",
    author: "?",
    date: "????-??-??",
    tag: "FIELD",
    body: (s) => `> ${escape(s.name || "DWELLER")}: do not trust the talking
> radroach. It WILL ask you for caps.
>
> Other notes:
> - Lockpicking is mostly listening.
> - Hacking is mostly counting.
> - Karma is mostly an opinion.
> - Vault Boy never blinks first.`,
  },
];

let _noteFocus = null;

function renderNotes(el, s) {
  const today = new Date();
  const md = `${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const wild = s.wild_wasteland;
  const readSet = new Set(s.read_notes || []);

  if (!_noteFocus || !NOTES_BANK.some(n => n.id === _noteFocus)) _noteFocus = NOTES_BANK[0].id;
  const sel = NOTES_BANK.find(n => n.id === _noteFocus);
  const selDate = sel.date || sel.date_template?.replace("MM-DD", md) || "—";
  const body = (typeof sel.body === "function" ? sel.body(s, wild) : sel.body).replace("{MD}", md);

  const unread = NOTES_BANK.filter(n => !readSet.has(n.id)).length;

  el.innerHTML = `
    <div class="notes-head">
      <span class="notes-count">${NOTES_BANK.length - unread}/${NOTES_BANK.length} READ</span>
      <button class="btn tiny ghost" id="mark-all-read">MARK ALL READ</button>
    </div>

    <div class="notes-split">
      <ul class="notes-list">
        ${NOTES_BANK.map(n => `
          <li data-note="${n.id}" class="${_noteFocus === n.id ? "sel" : ""} ${readSet.has(n.id) ? "read" : "unread"}">
            <span class="n-bullet">${readSet.has(n.id) ? "·" : "•"}</span>
            <span class="n-title">${escape(n.title)}</span>
            <span class="n-tag">${n.tag}</span>
          </li>
        `).join("")}
      </ul>

      <article class="notes-reader">
        <header>
          <h3 class="n-h">${escape(sel.title)}</h3>
          <div class="n-sub">
            <span>FROM ${escape(sel.author)}</span>
            <span>·</span>
            <span>${escape(selDate)}</span>
            <span>·</span>
            <span class="n-tag-big">${sel.tag}</span>
          </div>
        </header>
        <pre class="n-body">${escape(body)} ${sel.id === "vault_tec_memo" ? bobblePixel("E") : ""}</pre>
      </article>
    </div>

    <div class="card karma-actions">
      <h3>SOCIAL ACTIONS</h3>
      <p style="font-size:14px;font-family:var(--font-mono);margin-bottom:6px">Choices have weight. Karma is watching.</p>
      <button class="btn tiny" id="kgive">Give a beggar 5 caps (+karma)</button>
      <button class="btn tiny danger" id="kbad">Detonate Megaton (large −karma)</button>
    </div>
  `;

  // Note selection → mark as read
  el.querySelectorAll("[data-note]").forEach(li => {
    li.addEventListener("click", () => {
      _noteFocus = li.dataset.note;
      mutate(st => {
        st.read_notes = st.read_notes || [];
        if (!st.read_notes.includes(_noteFocus)) st.read_notes.push(_noteFocus);
      });
      play("key_press");
    });
  });

  // Mark all read
  el.querySelector("#mark-all-read").addEventListener("click", () => {
    mutate(st => { st.read_notes = NOTES_BANK.map(n => n.id); });
    play("tab_click");
  });

  // Karma actions
  el.querySelector("#kgive").addEventListener("click", () => {
    mutate(st => { st.karma = Math.min(1000, st.karma + 25); st.caps = Math.max(0, st.caps - 5); });
    play("achievement");
  });
  el.querySelector("#kbad").addEventListener("click", async () => {
    const ok = await pipConfirm(
      "DETONATE MEGATON",
      "<p>Mister Burke would be very pleased.</p><p>This action is irrevocably evil. Karma will take a substantial hit.</p>",
      { confirmLabel: "PUSH THE BUTTON", danger: true }
    );
    if (!ok) return;
    mutate(st => { st.karma = Math.max(-1000, st.karma - 200); });
    document.getElementById("standby").hidden = false;
    play("error");
    setTimeout(() => { document.getElementById("standby").hidden = true; }, 2200);
    unlock("megaton_boom", "ACHIEVEMENT", "The Power of the Atom — −karma incoming");
  });
}

function renderHolotapes(el, s) {
  el.innerHTML = `
    <p style="opacity:.8;font-family:var(--font-mono);font-size:14px">Insert holotape to play. Press ESC or EJECT to return.</p>
    <div class="holotapes">
      ${HOLOTAPES.map(h => `
        <div class="holotape" data-id="${h.id}">
          <span class="art" data-art="holotape"></span>
          <span class="lbl">${h.encrypted && !s.encrypted_decoded ? "[ENCRYPTED]" : escape(h.name)}</span>
          <small style="font-size:11px;opacity:.6">HI: ${s.high_scores[h.id === "encrypted" ? "hacking" : h.id] || 0}</small>
        </div>
      `).join("")}
    </div>
  `;

  // Hydrate holotape art slots
  exists("holotape.png").then(useImg => {
    const slots = el.querySelectorAll('[data-art="holotape"]');
    if (useImg) {
      slots.forEach(sl => sl.innerHTML = `<img src="./assets/img/holotape.png" alt="Holotape" style="width:80px;height:auto;display:block;margin:0 auto"/>`);
      return;
    }
    fetch("./assets/svg/holotape.svg").then(r => r.text()).then(svgStr => {
      slots.forEach(sl => sl.innerHTML = svgStr);
    });
  });

  el.querySelectorAll(".holotape").forEach(t => {
    t.addEventListener("click", async () => {
      const def = HOLOTAPES.find(h => h.id === t.dataset.id);
      play("holotape_insert");
      const mod = await def.mod();
      mod.start({
        title: def.encrypted ? "DECRYPTING…" : def.name,
        encrypted: !!def.encrypted,
        onExit: () => render(document.getElementById("content")),
      });
    });
  });
}

const ACHIEVEMENTS = [
  { id: "first_steps",      name: "First Steps",        cat: "lore",   short: "Leave the Vault.",
    desc: "Every dweller's first scrap of independence. You stepped through the Vault door and into the wasteland.",
    hint: "Boot the Pip-Boy for the first time." },
  { id: "fusion_charge",    name: "Fusion Cell",        cat: "device", short: "Recharge the Pip-Boy battery.",
    desc: "You found the device drawing power; you returned it to full.",
    hint: "Tap the battery indicator in the top bar." },
  { id: "bobble_hunter",    name: "Bobblehead Hunter",  cat: "collect", short: "Collect all 7 bobbleheads.",
    desc: "Seven tiny pixels scattered across the Pip-Boy, each granting a SPECIAL boost.",
    hint: "Hover everywhere. Especially around card headers." },
  { id: "konami_coder",     name: "Konami Coder",       cat: "secret", short: "Enter the cheat code of legend.",
    desc: "Up Up Down Down Left Right Left Right B A Enter. Old gods recognise old gestures.",
    hint: "You already know this one." },
  { id: "qa_smoke",         name: "QA Smoke",           cat: "secret", short: "Visit the dev room.",
    desc: "Every Vault has a back door for the testers. You found yours.",
    hint: "Open the console with ~ and ask politely." },
  { id: "wild_wasteland",   name: "Wild Wasteland",     cat: "secret", short: "Engage absurdity.",
    desc: "Reality bends a few degrees off-true. Some descriptions get goofier. You'll know.",
    hint: "There's a single-word console toggle for this." },
  { id: "stranger_friend",  name: "Mysterious Friend",  cat: "story",  short: "Sight the Stranger thrice.",
    desc: "He shows up when he feels like it. Three sightings is friendship in his book.",
    hint: "Stand still on the Pip-Boy for a while. He likes idle terminals." },
  { id: "megaton_boom",     name: "Power of the Atom",  cat: "evil",   short: "Detonate Megaton.",
    desc: "Mister Burke would be so pleased. Karma will not be.",
    hint: "Visit DATA → NOTES. The button is right there." },
  { id: "vb_clicker",       name: "Bobblehead Spawner", cat: "secret", short: "100 Vault Boy clicks.",
    desc: "He bobbles when poked. Poke him a hundred times and he gives up a bobblehead.",
    hint: "Click the Vault Boy on the STATS page. A lot." },
  { id: "exterminator",     name: "Exterminator",       cat: "device", short: "Squash 10 radroaches.",
    desc: "Periodically a radroach scuttles across the screen. Click to squash; one cap per kill.",
    hint: "Idle on any tab — they appear roughly every 25 seconds." },
  { id: "robco_hacker",     name: "ROBCO Hacker",       cat: "play",   short: "Win 5 hacking runs.",
    desc: "You can read the terminals now. Likeness pattern? Bracket prizes? Trivial.",
    hint: "DATA → HOLOTAPES → ROBCO TERM-LINK." },
  { id: "locksmith",        name: "Locksmith",          cat: "play",   short: "Pop a Very Hard lock.",
    desc: "The bobby pin doesn't lie. Sweet spot under 10°? You found it anyway.",
    hint: "DATA → HOLOTAPES → LOCKPICKING → Very Hard." },
  { id: "bottlecap_tycoon", name: "Bottlecap Tycoon",   cat: "wealth", short: "Hold 1000 caps.",
    desc: "An ounce of bottlecap is worth two ounces of pre-war silver, fact.",
    hint: "Complete quests, win mini-games, click radroaches." },
  { id: "decoded",          name: "DECODED",            cat: "secret", short: "Crack the encrypted holotape.",
    desc: "A pre-war Vault-Tec memo. Surprisingly candid for the company line.",
    hint: "DATA → HOLOTAPES → [ENCRYPTED]." },
  { id: "perk_ranked",      name: "Perk Acquired",      cat: "play",   short: "Rank up any perk.",
    desc: "Pick up your first perk rank — or push an old favourite higher.",
    hint: "STATS → PERKS → select a perk → RANK UP." },
  { id: "fast_traveller",   name: "Fast Traveller",     cat: "travel", short: "Fast-travel to 5 locations.",
    desc: "The wasteland gets a lot smaller when you stop walking everywhere.",
    hint: "MAP → click a marker → FAST TRAVEL." },
];

const ACH_CATS = {
  lore: "LORE", device: "DEVICE", collect: "COLLECT", secret: "SECRET",
  story: "STORY", evil: "EVIL", play: "PLAY", wealth: "WEALTH", travel: "TRAVEL",
};

let _achFocus = null;
let _achFilter = "all";  // "all" | "unlocked" | "locked"

function renderAchievements(el, s) {
  const got = (a) => s.achievements.includes(a.id);
  const filtered = ACHIEVEMENTS.filter(a =>
    _achFilter === "all" ||
    (_achFilter === "unlocked" && got(a)) ||
    (_achFilter === "locked" && !got(a)));

  if (!_achFocus || !ACHIEVEMENTS.some(a => a.id === _achFocus)) {
    _achFocus = filtered[0]?.id || ACHIEVEMENTS[0].id;
  }
  const sel = ACHIEVEMENTS.find(a => a.id === _achFocus);
  const selGot = got(sel);

  const unlocked = ACHIEVEMENTS.filter(got).length;
  const total = ACHIEVEMENTS.length;
  const pct = Math.round(unlocked / total * 100);

  el.innerHTML = `
    <div class="ach-head">
      <div class="ach-counter">
        <span class="ach-num">${unlocked}/${total}</span>
        <span class="ach-bar"><span class="ach-fill" style="width:${pct}%"></span></span>
        <span class="ach-pct">${pct}%</span>
      </div>
      <div class="ach-filters">
        ${["all","unlocked","locked"].map(f => `
          <button class="btn tiny ${_achFilter === f ? "active" : ""}" data-filter="${f}">${f.toUpperCase()}</button>
        `).join("")}
      </div>
    </div>

    <div class="ach-split">
      <ul class="ach-list">
        ${filtered.length ? filtered.map(a => `
          <li data-ach="${a.id}" class="${_achFocus === a.id ? "sel" : ""} ${got(a) ? "got" : "pending"}">
            <span class="ach-mark">${got(a) ? "★" : "☆"}</span>
            <span class="ach-name">${escape(a.name)}</span>
            <span class="ach-cat">${ACH_CATS[a.cat] || a.cat.toUpperCase()}</span>
          </li>
        `).join("") : `<li class="empty">— no achievements in this filter —</li>`}
      </ul>

      <article class="ach-detail">
        <header>
          <h3 class="ach-title">${escape(sel.name)}</h3>
          <div class="ach-sub">
            <span class="ach-cat">${ACH_CATS[sel.cat] || sel.cat.toUpperCase()}</span>
            <span>·</span>
            <span class="ach-status ${selGot ? "got" : ""}">${selGot ? "UNLOCKED" : "LOCKED"}</span>
          </div>
        </header>
        <p class="ach-blurb">${escape(sel.desc)}</p>
        ${!selGot ? `<p class="ach-hint"><strong>HINT:</strong> ${escape(sel.hint)}</p>` : `<p class="ach-hint got">DONE</p>`}
      </article>
    </div>
    <div style="margin-top:6px;font-family:var(--font-mono);font-size:11px;opacity:.6">
      ★ unlocked  ☆ pending  ${bobblePixel("L")}
    </div>
  `;

  el.querySelectorAll("[data-ach]").forEach(li => {
    li.addEventListener("click", () => {
      _achFocus = li.dataset.ach;
      play("key_press");
      render(el);
    });
  });
  el.querySelectorAll("[data-filter]").forEach(b => {
    b.addEventListener("click", () => {
      _achFilter = b.dataset.filter;
      play("tab_click");
      render(el);
    });
  });
}

// Real crafting recipes. Each ingredient references an item by id; quantities
// are consumed from INV when crafted. Output appears in the target category.
const RECIPES = [
  {
    id: "diy_stimpak",
    name: "Stimpak (DIY)",
    blurb: "Inadvisable but effective. Wear gloves.",
    ingredients: [
      { id: "nuka",     cat: "aid",  qty: 1 },
      { id: "cram",     cat: "aid",  qty: 1 },
      { id: "tin_can",  cat: "misc", qty: 2 },
    ],
    output: { id: "stimpak", cat: "aid", name: "Stimpak", weight: 0, value: 75, qty: 2, effect: "hp+25" },
  },
  {
    id: "make_bcmine",
    name: "Bottlecap Mine",
    blurb: "An old wasteland favourite. Goes BOOM, returns +5 caps.",
    cost_caps: 25,
    ingredients: [
      { id: "tin_can", cat: "misc", qty: 1 },
    ],
    output: { id: "bottlecap_mine", cat: "misc", name: "Bottlecap Mine", weight: 1, value: 200, qty: 1 },
  },
  {
    id: "dirty_wast",
    name: "Dirty Wastelander",
    blurb: "Mostly bottle. Lightly cola. Don't ask about the colour.",
    ingredients: [
      { id: "nuka",          cat: "aid",  qty: 1 },
      { id: "prewar_money",  cat: "misc", qty: 2 },
    ],
    output: { id: "dirty_wast", cat: "aid", name: "Dirty Wastelander", weight: 1, value: 25, qty: 1, effect: "hp-5,ap+50" },
  },
  {
    id: "knockoff_quantum",
    name: "Nuka-Cola Quantum (Knock-off)",
    blurb: "Mostly blue. Mostly safe. Mostly.",
    ingredients: [
      { id: "nuka",         cat: "aid",  qty: 2 },
      { id: "fusion_core",  cat: "misc", qty: 1 },
    ],
    output: { id: "nuka_quantum", cat: "aid", name: "Nuka-Cola Quantum", weight: 1, value: 100, qty: 1, effect: "hp+20,ap+20,rad+10" },
  },
  {
    id: "instamash_batch",
    name: "InstaMash Batch",
    blurb: "Four cans of dehydrated whatever yield one cup of mostly-food.",
    ingredients: [
      { id: "tin_can", cat: "misc", qty: 4 },
    ],
    output: { id: "instamash", cat: "aid", name: "InstaMash", weight: 0, value: 10, qty: 1, effect: "hp+3" },
  },
  {
    id: "fancy_lads",
    name: "Fancy Lads Snack Cakes",
    blurb: "Pre-war preservatives are doing the heavy lifting here.",
    ingredients: [
      { id: "tin_can",      cat: "misc", qty: 1 },
      { id: "prewar_money", cat: "misc", qty: 1 },
    ],
    output: { id: "fancy_lads", cat: "aid", name: "Fancy Lads Snack Cakes", weight: 0, value: 20, qty: 1, effect: "hp+5" },
  },
];

let _recFocus = null;

function renderRecs(el, s) {
  if (!_recFocus || !RECIPES.some(r => r.id === _recFocus)) _recFocus = RECIPES[0].id;
  const sel = RECIPES.find(r => r.id === _recFocus);
  const cost = sel.cost_caps || 0;
  const haveCaps = s.caps >= cost;
  const ingredientStatus = sel.ingredients.map(ing => {
    const owned = (s.inventory[ing.cat] || []).find(i => i.id === ing.id);
    const have = owned?.qty ?? 0;
    return { ...ing, have, ok: have >= ing.qty, name: owned?.name || ing.id };
  });
  const allMet = ingredientStatus.every(i => i.ok) && haveCaps;

  el.innerHTML = `
    <h3 style="letter-spacing:2px;margin:0 0 6px">WORKSHOP — CRAFTING</h3>

    <div class="rec-split">
      <ul class="rec-list">
        ${RECIPES.map(r => {
          const stat = r.ingredients.map(ing => {
            const have = (s.inventory[ing.cat] || []).find(i => i.id === ing.id)?.qty ?? 0;
            return have >= ing.qty;
          });
          const costOk = !r.cost_caps || s.caps >= r.cost_caps;
          const ok = stat.every(Boolean) && costOk;
          return `
            <li data-rec="${r.id}" class="${_recFocus === r.id ? "sel" : ""} ${ok ? "ready" : "blocked"}">
              <span class="rec-bullet">${ok ? "◆" : "◇"}</span>
              <span class="rec-name">${escape(r.name)}</span>
            </li>
          `;
        }).join("")}
      </ul>

      <article class="rec-detail">
        <header>
          <h3 class="rec-title">${escape(sel.name)}</h3>
          <p class="rec-blurb">${escape(sel.blurb)}</p>
        </header>

        <h4 class="rec-h">INGREDIENTS</h4>
        <ul class="rec-ings">
          ${ingredientStatus.map(i => `
            <li class="${i.ok ? "ok" : "no"}">
              <span class="rec-pip">${i.ok ? "✓" : "✗"}</span>
              <span class="rec-iname">${escape(i.name)}</span>
              <span class="rec-iqty">${i.have} / ${i.qty}</span>
            </li>
          `).join("")}
          ${sel.cost_caps ? `
            <li class="${haveCaps ? "ok" : "no"}">
              <span class="rec-pip">${haveCaps ? "✓" : "✗"}</span>
              <span class="rec-iname">Caps</span>
              <span class="rec-iqty">${s.caps} / ${sel.cost_caps}</span>
            </li>` : ""}
        </ul>

        <h4 class="rec-h">YIELDS</h4>
        <div class="rec-yield">
          <span class="rec-yname">${escape(sel.output.name)}</span>
          <span class="rec-yqty">×${sel.output.qty}</span>
        </div>

        <div class="rec-actions">
          <button class="btn" id="craft-btn" ${allMet ? "" : "disabled"}>${allMet ? "CRAFT" : "MISSING INGREDIENTS"}</button>
        </div>
      </article>
    </div>
  `;

  el.querySelectorAll("[data-rec]").forEach(li => {
    li.addEventListener("click", () => {
      _recFocus = li.dataset.rec;
      play("key_press");
      render(el);
    });
  });

  const cb = el.querySelector("#craft-btn");
  if (cb) cb.addEventListener("click", () => {
    if (cb.disabled) return;
    mutate(st => {
      // consume caps
      if (sel.cost_caps) st.caps = Math.max(0, st.caps - sel.cost_caps);
      // consume ingredients
      for (const ing of sel.ingredients) {
        const arr = st.inventory[ing.cat];
        if (!arr) continue;
        const idx = arr.findIndex(i => i.id === ing.id);
        if (idx === -1) continue;
        arr[idx].qty -= ing.qty;
        if (arr[idx].qty <= 0) arr.splice(idx, 1);
      }
      // emit output: merge into existing stack or push new
      const outCat = st.inventory[sel.output.cat] = st.inventory[sel.output.cat] || [];
      const existing = outCat.find(i => i.id === sel.output.id);
      if (existing) {
        existing.qty = (existing.qty || 1) + sel.output.qty;
      } else {
        outCat.push({ ...sel.output });
      }
    });
    play("achievement");
    unlock("crafter_first", "CRAFTED", `+${sel.output.qty} ${sel.output.name}`);
  });
}

function escape(s) { return String(s).replace(/[<>&]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;"}[c])); }
