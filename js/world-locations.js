// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// world-locations.js — single source of truth for map locations.
// Coordinates are in the wasteland-map SVG viewBox (800 × 500).
// Imported by both the MAP tab and the DATA → Quests panel so a quest's
// "Track on Map" button can pin its destination accurately.

export const LOCATIONS = {
  sanctuary:  { name: "Sanctuary Hills",  x: 120, y: 120, blurb: "A quiet pre-war suburb. Smells like radroach." },
  megaton:    { name: "Megaton",          x: 220, y: 180, blurb: "Built around a live atomic bomb. The mayor wants it disarmed." },
  rivet_city: { name: "Rivet City",       x: 300, y: 220, blurb: "A floating settlement made from a beached aircraft carrier." },
  diamond:    { name: "Diamond City",     x: 420, y: 210, blurb: "Boston's great green jewel. Mayor McDonough is suspicious." },
  goodneigh:  { name: "Goodneighbor",     x: 480, y: 250, blurb: "Of the people, for the people. Hancock approves." },
  vault111:   { name: "Vault 111",        x: 140, y: 180, blurb: "Cryogenic storage facility. Population: ONE (cold)." },
  vault76:    { name: "Vault 76",         x: 380, y:  80, blurb: "Reclamation Day vault. Pack your duffle." },
  newvegas:   { name: "New Vegas",        x: 640, y: 260, blurb: "House always wins. Roulette closes at midnight." },
  mojave:     { name: "Mojave Outpost",   x: 720, y: 300, blurb: "Two big statues holding a flag. Charming." },
  nukaworld:  { name: "Nuka-World",       x: 580, y: 140, blurb: "Theme park in the wasteland. Surprisingly bloody." },
  farharbor:  { name: "Far Harbor",       x: 580, y:  80, blurb: "Foggy island. Children of Atom say hello." },
  oasis:      { name: "Oasis",            x: 220, y: 400, blurb: "A pocket of green. The Treeminder welcomes you." },
};

export function getLocation(id) {
  return LOCATIONS[id] || null;
}
