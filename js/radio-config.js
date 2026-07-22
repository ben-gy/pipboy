// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// radio-config.js — map each Pip-Boy radio station to a Spotify resource.
//
// HOW TO CONFIGURE
// ----------------
// Open any Spotify playlist (or album) in the desktop app or web player,
// click "Share → Copy link". You'll get a URL like:
//
//   https://open.spotify.com/playlist/37i9dQZF1DXbm0dp7JzNeL?si=...
//                                     ^^^^^^^^^^^^^^^^^^^^^^
//                                     this is the Spotify ID
//
// Drop that ID into the corresponding station below. Set `kind` to one of:
//   "playlist" | "album" | "track" | "show" | "episode" | "artist"
//
// Leave a station blank (or set spotify_id to null) to fall back to the
// project's synthesized tube hum + DJ chatter.
//
// TIPS
// - Bethesda has published official "Fallout 3 — Galaxy News Radio",
//   "Fallout 4 — Diamond City Radio", etc. on Spotify. Search Spotify for
//   "Fallout 3 Galaxy News Radio Bethesda" and grab the share link.
// - Any public playlist works. You can also use a single album as a station.
// - Embeds work for free Spotify accounts (with ads) and Premium (without).

export const RADIO_STATIONS = [
  {
    id: "gnr",
    name: "GALAXY NEWS RADIO",
    freq: "88.1",
    chatter: [
      "You're listening to Galaxy News Radio — bringing you the truth, no matter how bad it stings. AWOOOO!",
      "Three Dog here — and that one was for the kids in Megaton. Stay safe out there, children of the wasteland.",
      "Coming up next — a little number on tape, except the rights department says NO. Hum along.",
    ],
    spotify_id: null,         // ← drop a playlist ID here
    kind: "playlist",
  },
  {
    id: "diamond",
    name: "DIAMOND CITY RADIO",
    freq: "92.3",
    chatter: [
      "Travis here at Diamond City Radio. Hi. Um. Travis. I exist. Please don't change the dial.",
      "Cathy Q. Bates says her cat ran away. Again. If you see Mister Whiskers, please return him.",
      "Today's weather: nuclear haze. Tomorrow's weather: nuclear haze, but cooler.",
    ],
    spotify_id: null,
    kind: "playlist",
  },
  {
    id: "enclave",
    name: "ENCLAVE RADIO",
    freq: "98.7",
    chatter: [
      "President Eden here. THANK YOU for tuning in to YOUR government. It's good to be wanted.",
      "Citizens of America — your true government has not abandoned you. We are merely... underground.",
      "Stand tall. Stand proud. Stand for liberty. Stand for the Enclave.",
    ],
    spotify_id: null,
    kind: "playlist",
  },
  {
    id: "classical",
    name: "AGATHA'S STATION",
    freq: "101.5",
    chatter: [
      "And now, a violin solo by Agatha herself. Please mind the static — it's part of the charm.",
      "Pre-war classical, brought to you by tape, glue, and willpower.",
      "Allegro… ma non troppo… ish.",
    ],
    spotify_id: null,
    kind: "playlist",
  },
  {
    id: "megaton",
    name: "MEGATON RADIO",
    freq: "104.5",
    chatter: [
      "Megaton Radio — we're broadcasting from a town built around an unexploded bomb. Subscribe!",
      "Mayor Simms reminds you not to feed the brahmin without a permit.",
      "Moriarty's Saloon hour: drink specials and broken jukeboxes.",
    ],
    spotify_id: null,
    kind: "playlist",
  },
  {
    id: "vault76",
    name: "VAULT 76 P.S.A.",
    freq: "108.0",
    chatter: [
      "Welcome, Reclamation Day-ers! Vault 76 is a CONTROL vault. No experiments. Probably.",
      "Have you packed your Pip-Boy charger? Have you packed your toothbrush? Are you sure?",
      "RECLAMATION DAY: October 23rd. Don't be late.",
    ],
    spotify_id: null,
    kind: "playlist",
  },
];

/** Build the Spotify embed URL for a station, or return null. */
export function spotifyEmbedURL(station) {
  if (!station?.spotify_id) return null;
  const kind = station.kind || "playlist";
  // theme=0 → dark (matches Pip-Boy)
  return `https://open.spotify.com/embed/${kind}/${encodeURIComponent(station.spotify_id)}?theme=0&utm_source=pipboy`;
}
