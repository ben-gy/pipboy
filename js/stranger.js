// stranger.js — Mysterious Stranger appearance.

import { play } from "./sound.js";
import { unlock } from "./achievements.js";

let _seen = 0;

export function initStranger() {
  const layer = document.getElementById("stranger");
  const tick = () => {
    if (Math.random() < 0.6) return; // ~40% per tick
    show(layer);
  };
  // First sighting earlier — 2 minutes — to make the easter egg discoverable
  setTimeout(() => show(layer), 120_000);
  setInterval(tick, 5 * 60 * 1000);
}

function show(layer) {
  layer.hidden = false;
  layer.innerHTML = "";
  const sil = document.createElement("div");
  sil.className = "silhouette";
  // pick a corner
  const corners = [
    { left: "6%",  bottom: "8%",  top: "auto", right: "auto" },
    { right: "6%", bottom: "8%",  top: "auto", left: "auto" },
    { left: "6%",  top: "12%",    bottom: "auto", right: "auto" },
    { right: "6%", top: "12%",    bottom: "auto", left: "auto" },
  ];
  const c = corners[Math.floor(Math.random() * corners.length)];
  Object.assign(sil.style, c);
  layer.appendChild(sil);
  play("stranger_sting");
  setTimeout(() => { layer.hidden = true; layer.innerHTML = ""; }, 1500);

  _seen++;
  if (_seen === 3) unlock("stranger_friend", "ACHIEVEMENT", "Mysterious Stranger — sighted thrice");
}
