// console.js — ~ developer console, command registry.

import { mutate, loadState, reset, rerollSpecial, VAULT_LIST } from "./state.js";
import { play } from "./sound.js";
import { unlock, toast } from "./achievements.js";
import { pipConfirm } from "./modal.js";

let _open = false;

const COMMANDS = {
  help() {
    return "Available: tgm, tcl, showracemenu, player.additem caps N, coc qasmoke, goto N, kill, wildwasteland, nuclear, reset, help";
  },
  tgm() {
    const s = loadState();
    const next = !s.dev_unlocked;
    mutate(st => { st.dev_unlocked = next; });
    let banner = document.querySelector(".godmode-banner");
    if (next) {
      if (!banner) {
        banner = document.createElement("div");
        banner.className = "godmode-banner";
        banner.textContent = "GOD MODE ENABLED";
        document.getElementById("screen").appendChild(banner);
      }
    } else if (banner) {
      banner.remove();
    }
    return next ? "GOD MODE ENABLED" : "god mode disabled.";
  },
  tcl() { toast("NOCLIP", "engaged"); return "noclip engaged. terrain is a suggestion."; },
  showracemenu() { rerollSpecial(); return "SPECIAL re-rolled."; },
  "coc"(arg) {
    if (arg && arg.toLowerCase() === "qasmoke") {
      mutate(st => {
        st.dev_unlocked = true;
        st.caps = Math.max(st.caps, 99999);
        st.found_bobbleheads = ["S","P","E","C","I","A","L"];
        st.special = { S:10, P:10, E:10, C:10, I:10, A:10, L:10 };
      });
      unlock("qa_smoke", "ACHIEVEMENT", "QA Smoke — Dev room accessed");
      return "Welcome to QA Smoke. All items unlocked.";
    }
    return "coc <cell> — try qasmoke";
  },
  "player.additem"(...args) {
    const item = args[0];
    const n = parseInt(args[1], 10) || 1;
    if (item === "caps") {
      mutate(st => { st.caps += n; });
      return `+${n} caps`;
    }
    return "unknown item";
  },
  goto(arg) {
    const n = parseInt(arg, 10);
    if (!Number.isFinite(n)) return "goto <vault-number>";
    if (VAULT_LIST.includes(n)) {
      toast("VAULT " + n, "highlighted on map");
      return `Vault ${n} found in the database.`;
    }
    return `Vault ${n} not in database.`;
  },
  kill() { return "TARGET INVALID. (this is a fan site, friend)"; },
  wildwasteland() {
    mutate(st => { st.wild_wasteland = !st.wild_wasteland; });
    const on = loadState().wild_wasteland;
    if (on) unlock("wild_wasteland", "WILD WASTELAND", "Goofy mode engaged");
    return on ? "Wild Wasteland: ON" : "Wild Wasteland: off";
  },
  nuclear() {
    mutate(st => { st.nuclear_winter = !st.nuclear_winter; });
    document.documentElement.dataset.nuclear = loadState().nuclear_winter ? "1" : "";
    return "Palette toggle.";
  },
  reset() {
    pipConfirm(
      "RESET PIP-OS",
      "<p>This will erase all SPECIAL stats, caps, achievements and high scores.</p><p>This cannot be undone.</p>",
      { confirmLabel: "WIPE STATE", danger: true }
    ).then(ok => {
      if (ok) { reset(); location.reload(); }
    });
    return "(awaiting confirmation)";
  },
};

export function initConsole() {
  const el = document.getElementById("console");
  const inp = document.getElementById("console-input");
  const out = document.getElementById("console-out");

  document.addEventListener("keydown", (e) => {
    if (e.target === inp) return;
    if (e.key === "`" || e.key === "~") {
      e.preventDefault();
      _open = !_open;
      el.hidden = !_open;
      if (_open) inp.focus();
      play("beep");
    } else if (e.key === "Escape" && _open) {
      _open = false;
      el.hidden = true;
    }
  });

  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const line = inp.value.trim();
      inp.value = "";
      if (!line) return;
      const result = run(line);
      out.textContent += `> ${line}\n${result}\n`;
      out.scrollTop = out.scrollHeight;
    } else if (e.key === "Escape") {
      _open = false;
      el.hidden = true;
    }
  });
}

function run(line) {
  const parts = line.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);
  const fn = COMMANDS[cmd];
  if (!fn) return `unknown command: ${cmd}`;
  try { return fn(...args) || ""; }
  catch (e) { return "error: " + e.message; }
}
