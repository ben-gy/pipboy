// state.js — single source of truth for the Pip-Boy.
// One localStorage key. Defensive parse. Subscribers notified on mutate.

const KEY = "pipboy:state";

const VAULTS = [13, 15, 22, 34, 76, 87, 92, 101, 108, 111, 112];

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "u-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Demographic banks for RANDOMISE. Original lists, evocative-of-Fallout but not copies.
const FIRST_NAMES = [
  "Atom", "Nora", "Nate", "Mac", "Sam", "Pip", "Ada", "Cass", "Reno", "Vega",
  "Junie", "Cole", "Wren", "Hudson", "Bellamy", "Quinn", "Marlow", "Sutter",
  "Holt", "Gus", "Echo", "Bryn", "Sol", "Moxie", "Tilda", "Ozzy", "Rye",
  "Beck", "Cypress", "Briar", "Dustin", "Hatch", "Onyx", "Verve",
];
const LAST_NAMES = [
  "Dweller", "Six", "Tenpenny", "Hawthorne", "Crane", "Ashlock", "Vance",
  "Holloway", "Brixton", "Decker", "Riggs", "Larkin", "Mott", "Pettigrew",
  "Quill", "Salvas", "Tundra", "Wexley", "Ashford", "Cobb", "Drexler",
  "Granger", "Halloway", "Marsh", "Polk", "Rourke", "Strand", "Vance",
  "Wheelock", "Yates", "Zeller",
];
const SEX_OPTIONS  = ["Yes", "Affirmative", "Probably", "Mysterious", "—", "M", "F", "Other", "Sure", "Classified"];
const CLASS_OPTIONS = [
  "Wanderer", "Drifter", "Survivor", "Vault Dweller", "Courier", "Sole Survivor",
  "Lone Wanderer", "Ranger", "Outsider", "Mercenary", "Settler", "Caravan Hand",
  "Scavver", "Atom Cat", "Reclaimer", "Tribal", "Prospector", "Provisioner",
];

function randomName() {
  const f = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const l = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${f} ${l}`;
}
function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomKarma() {
  // Bias toward neutral but allow extremes
  const r = Math.random();
  if (r < 0.5) return Math.floor((Math.random() - 0.5) * 200);          // -100..+100 most often
  if (r < 0.85) return Math.floor((Math.random() - 0.5) * 800);          // wider band
  return Math.floor((Math.random() * 2 - 1) * 1000);                     // full -1000..+1000
}

export function randomDemographics() {
  return {
    name: randomName(),
    sex:  randomFrom(SEX_OPTIONS),
    klass: randomFrom(CLASS_OPTIONS),
    karma: randomKarma(),
  };
}

function rollSpecial() {
  // Sum-21 distribution-ish, leaning average-ish to feel earned not flat.
  const out = { S: 0, P: 0, E: 0, C: 0, I: 0, A: 0, L: 0 };
  for (const k of Object.keys(out)) out[k] = 3 + Math.floor(Math.random() * 6); // 3..8
  // bonus point swing
  const keys = Object.keys(out);
  for (let i = 0; i < 4; i++) out[keys[Math.floor(Math.random() * 7)]]++;
  for (const k of keys) out[k] = Math.max(1, Math.min(10, out[k]));
  return out;
}

function vaultFromId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return VAULTS[h % VAULTS.length];
}

function defaults() {
  const id = uuid();
  const demo = randomDemographics();
  return {
    user_id: id,
    name: demo.name,
    sex: demo.sex,
    klass: demo.klass,
    vault_number: vaultFromId(id),
    special: rollSpecial(),
    karma: demo.karma,
    caps: 42,
    hp: 100, hp_max: 100,
    ap: 100, ap_max: 100,
    rad: 0,  rad_max: 1000,
    level: 1,
    xp: 0,
    perks: ["wanderer"],
    found_bobbleheads: [],
    achievements: [],
    high_scores: {
      hacking: 0, lockpick: 0, "red-menace": 0,
      "atomic-cmd": 0, zeta: 0, pipfall: 0,
    },
    inventory: defaultInventory(),
    quests: defaultQuests(),
    theme: "green",
    last_tab: "stats",
    wild_wasteland: false,
    dev_unlocked: false,
    nuclear_winter: false,
    encrypted_decoded: false,
    click_counts: { vault_boy: 0 },
    play_seconds: 0,
    battery_pct: 100,
    last_seen: 0,
    radroach_kills: 0,
    // Map state — coordinates are in the wasteland-map SVG viewBox (800 × 500).
    player_pos: { x: 140, y: 180 },          // default: Vault 111
    destination: null,                        // { id, name, x, y } or null
    map_view: { x: 0, y: 0, w: 800, h: 500 }, // current viewBox (zoom + pan)
    known_locations: ["vault111"],            // ids the player has visited
  };
}

function defaultInventory() {
  return {
    weapons: [
      { id: "pistol_10mm", name: "10mm Pistol", weight: 3, value: 250, condition: 0.85, dmg: 16 },
      { id: "laser_rifle", name: "Laser Rifle", weight: 8, value: 1000, condition: 0.70, dmg: 23 },
      { id: "plasma_caster", name: "Plasma Caster", weight: 18, value: 4500, condition: 0.50, dmg: 60 },
      { id: "fat_man", name: "Fat Man (loaded)", weight: 30, value: 5000, condition: 0.95, dmg: 1500 },
      { id: "lincolns", name: "Lincoln's Repeater", weight: 7, value: 2200, condition: 0.90, dmg: 50 },
      { id: "pickmans_blade", name: "Pickman's Blade", weight: 1, value: 600, condition: 0.95, dmg: 22 },
      { id: "alien_blaster", name: "Alien Blaster", weight: 1, value: 5000, condition: 1.00, dmg: 100 },
    ],
    apparel: [
      { id: "vault_jumpsuit", name: "Vault Jumpsuit", weight: 1, value: 25, condition: 0.95, dr: 1, equipped: true },
      { id: "t51_armor", name: "T-51 Power Armor", weight: 45, value: 12000, condition: 0.30, dr: 40, locked: true },
      { id: "ncr_combat", name: "NCR Ranger Combat Armor", weight: 22, value: 4000, condition: 0.55, dr: 22 },
      { id: "sunset_cap", name: "Sunset Sarsaparilla Cap", weight: 0, value: 5, condition: 1.00, dr: 0 },
    ],
    aid: [
      { id: "stimpak", name: "Stimpak", weight: 0, value: 75, qty: 6, effect: "hp+25" },
      { id: "radaway", name: "RadAway", weight: 1, value: 60, qty: 3, effect: "rad-150" },
      { id: "radx", name: "Rad-X", weight: 0, value: 40, qty: 4, effect: "radres+25" },
      { id: "nuka", name: "Nuka-Cola", weight: 1, value: 20, qty: 5, effect: "hp+10,rad+1" },
      { id: "nuka_quantum", name: "Nuka-Cola Quantum", weight: 1, value: 100, qty: 2, effect: "hp+20,ap+20,rad+10" },
      { id: "fancy_lads", name: "Fancy Lads Snack Cakes", weight: 0, value: 20, qty: 3, effect: "hp+5" },
      { id: "dirty_wast", name: "Dirty Wastelander", weight: 1, value: 25, qty: 1, effect: "hp-5,ap+50" },
      { id: "cram", name: "Cram", weight: 1, value: 15, qty: 4, effect: "hp+5" },
      { id: "instamash", name: "InstaMash", weight: 0, value: 10, qty: 2, effect: "hp+3" },
    ],
    misc: [
      { id: "prewar_money", name: "Pre-War Money", weight: 0, value: 5, qty: 84 },
      { id: "bottlecap_mine", name: "Bottlecap Mine", weight: 1, value: 200, qty: 2 },
      { id: "teddy_bear", name: "Teddy Bear", weight: 0, value: 1, qty: 1 },
      { id: "tin_can", name: "Tin Can", weight: 0, value: 1, qty: 11 },
      { id: "fusion_core", name: "Fusion Core", weight: 4, value: 200, qty: 1 },
    ],
    ammo: [
      { id: "10mm",   name: "10mm Round",        weight: 0, value: 1, qty: 240 },
      { id: "ec",     name: "Electron Charge Pack", weight: 0, value: 2, qty: 86 },
      { id: "minNuk", name: "Mini Nuke",          weight: 12, value: 400, qty: 1 },
      { id: "alien",  name: "Alien Power Cell",   weight: 0, value: 8, qty: 17 },
      { id: ".44",    name: ".44 Magnum",         weight: 0, value: 6, qty: 32 },
    ],
    keys: [
      { id: "key_megaton",  name: "Key to Megaton House", weight: 0, value: 0, qty: 1 },
      { id: "key_v13",      name: "Vault 13 Door Key",     weight: 0, value: 0, qty: 1 },
      { id: "chip_sm",      name: "Sierra Madre Casino Chip", weight: 0, value: 100, qty: 12 },
    ],
  };
}

function defaultQuests() {
  return {
    active: [
      { id: "out_of_time",   objectives_done: [false, false, false] },
      { id: "reillys",       objectives_done: [false, false, false] },
      { id: "come_fly",      objectives_done: [false, false, false] },
      { id: "silver_shroud", objectives_done: [false, false] },
      { id: "patrol_mojave", objectives_done: [false] },
    ],
    completed: [
      { id: "first_steps", completed_at: 0 },
    ],
    tracked_id: null,
  };
}

let _state = null;
const _subs = new Set();

export function loadState() {
  if (_state) return _state;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      _state = { ...defaults(), ...parsed };
      // backfill any sub-objects added in newer versions
      _state.inventory = parsed.inventory ?? defaultInventory();
      _state.quests = parsed.quests ?? defaultQuests();
      _state.high_scores = { ...defaults().high_scores, ...(parsed.high_scores ?? {}) };
      _state.click_counts = { ...{ vault_boy: 0 }, ...(parsed.click_counts ?? {}) };
    } else {
      _state = defaults();
    }
  } catch (e) {
    console.warn("[state] reset due to parse error", e);
    _state = defaults();
  }
  return _state;
}

export function saveState() {
  if (!_state) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(_state));
  } catch (e) {
    console.warn("[state] save failed", e);
  }
}

export function mutate(fn) {
  loadState();
  const before = JSON.stringify(_state);
  fn(_state);
  if (JSON.stringify(_state) !== before) {
    saveState();
    _subs.forEach((s) => { try { s(_state); } catch (e) { console.error(e); } });
  }
}

export function subscribe(fn) {
  _subs.add(fn);
  return () => _subs.delete(fn);
}

export function reset() {
  localStorage.removeItem(KEY);
  _state = null;
  loadState();
  _subs.forEach((s) => s(_state));
}

export function rerollSpecial() {
  mutate((s) => { s.special = rollSpecial(); });
}

/** Randomise the entire character profile: SPECIAL, name, sex, class, vault, karma. */
export function randomiseEverything() {
  mutate((s) => {
    const demo = randomDemographics();
    s.special = rollSpecial();
    s.name  = demo.name;
    s.sex   = demo.sex;
    s.klass = demo.klass;
    s.karma = demo.karma;
    // Pick a fresh vault from the canon list
    s.vault_number = VAULTS[Math.floor(Math.random() * VAULTS.length)];
    // Reset HP/AP so the new build feels fresh
    s.hp = s.hp_max;
    s.ap = s.ap_max;
    s.rad = 0;
  });
}

// Karma title from numeric value
export function karmaTitle(k) {
  if (k >= 750) return "SAINT";
  if (k >= 250) return "VERY GOOD";
  if (k >= 100) return "GOOD";
  if (k <= -750) return "DEVIL";
  if (k <= -250) return "VERY EVIL";
  if (k <= -100) return "EVIL";
  return "NEUTRAL";
}

export const VAULT_LIST = VAULTS;
