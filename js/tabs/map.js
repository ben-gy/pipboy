// tabs/map.js — interactive wasteland map.
//
// Features:
//   • Renders the SVG wasteland (or a bitmap override if /assets/img/wasteland-map.png exists)
//   • Shows YOU-ARE-HERE marker at state.player_pos with pulse + heading arrow
//   • Click a location to inspect it; SET DESTINATION pins it
//   • A dashed travel line + distance readout from player → destination
//   • Compass strip up top displays bearing to destination, ticks rotate as bearing changes
//   • Zoom + pan: buttons (+ / − / RESET), wheel-zoom toward cursor, drag to pan
//   • Fast travel: instantly moves player to the destination (clears destination, registers in known_locations)
//   • Persisted state (player_pos, destination, map_view, known_locations)

import { loadState, mutate, subscribe } from "../state.js";
import { play } from "../sound.js";
import { bobblePixel } from "../bobbleheads.js";
import { exists } from "../img.js";
import { isGameRunning } from "../games/canvas-helpers.js";
import { LOCATIONS } from "../world-locations.js";

const VB = { w: 800, h: 500 };

let _selected = null;
let _unsub    = null;
let _refs     = {};   // DOM references rebuilt every render
let _drag     = null; // { startX, startY, vx0, vy0 }

// ---- Lifecycle --------------------------------------------------------------

export function mount(el) {
  render(el);
  _unsub = subscribe(() => { if (!isGameRunning()) render(el); });
}

export function unmount() {
  if (_unsub) { _unsub(); _unsub = null; }
}

// ---- Render -----------------------------------------------------------------

function render(el) {
  const s = loadState();
  const dest = s.destination;
  const player = s.player_pos;
  const bearing = dest ? bearingDeg(player, dest) : null;
  const distKm  = dest ? distance(player, dest) * 0.025 : null; // 1 svg-unit ≈ 25 m

  el.innerHTML = `
    <div class="compass" id="compass" aria-label="Heading">
      <div class="ticks" id="ticks">${compassTicks()}</div>
      <div class="cmark"></div>
      <div class="cinfo">${dest ? `${escape(dest.name)} · ${distKm.toFixed(1)} km · ${formatHeading(bearing)}` : "no destination set"}</div>
    </div>

    <div class="map-wrap">
      <div class="map-stage" id="map-stage">
        <div id="mapsvg"></div>
        <div class="map-controls">
          <button class="map-btn" data-act="in"   title="Zoom in">+</button>
          <button class="map-btn" data-act="out"  title="Zoom out">−</button>
          <button class="map-btn" data-act="reset" title="Reset view">⟲</button>
          <button class="map-btn" data-act="recenter" title="Recenter on player">◎</button>
        </div>
        <div class="map-zoom-readout" id="map-zoom">${zoomLabel(s.map_view)}</div>
      </div>

      <aside class="legend">
        <h3 style="letter-spacing:2px;margin:0 0 6px">LOCATIONS ${bobblePixel("C")}</h3>

        <div class="card you">
          <h3>YOU ARE HERE</h3>
          <p style="margin:0">${escape(currentLocationName(player))}</p>
          <div class="kv" style="font-family:var(--font-mono);font-size:13px;opacity:.7;margin-top:4px">
            <label>Coords</label><span>${Math.round(player.x)}, ${Math.round(player.y)}</span>
          </div>
        </div>

        ${_selected ? `
          <div class="card sel">
            <h3>${escape(LOCATIONS[_selected].name)}</h3>
            <p>${escape(LOCATIONS[_selected].blurb)}</p>
            <div class="kv" style="font-family:var(--font-mono);font-size:13px;opacity:.7;margin:4px 0">
              <label>Distance</label>
              <span>${(distance(player, LOCATIONS[_selected]) * 0.025).toFixed(1)} km</span>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="btn tiny" id="setdest">${dest?.id === _selected ? "DESTINATION SET" : "SET DESTINATION"}</button>
              <button class="btn tiny" id="ftravel">FAST TRAVEL</button>
              ${dest?.id === _selected ? `<button class="btn tiny danger" id="cleardest">CLEAR</button>` : ""}
            </div>
          </div>
        ` : `<p style="opacity:.7">Click a marker to inspect it.</p>`}

        <ul class="list" style="margin-top:10px">
          ${Object.entries(LOCATIONS).map(([id, loc]) => `
            <li data-id="${id}" aria-selected="${_selected === id}">
              <span class="name">${escape(loc.name)}</span>
              <span class="badges">
                ${dest?.id === id ? `<span class="badge" style="color:var(--phosphor)">[DEST]</span>` : ""}
                ${(s.known_locations || []).includes(id) ? `<span class="badge">[VISITED]</span>` : `<span class="badge" style="opacity:.4">[—]</span>`}
              </span>
            </li>
          `).join("")}
        </ul>
      </aside>
    </div>
  `;

  // --- compass orientation
  if (bearing != null) {
    const ticks = el.querySelector("#ticks");
    // total tick width is 360° × 4px; place 0° (N) at the start; shift left by bearing to put it at center.
    ticks.style.transform = `translateX(${-(bearing * 4)}px)`;
  }

  // --- mount the map (SVG or PNG override) and overlay the markers + player + destination
  const svgSlot = el.querySelector("#mapsvg");
  exists("wasteland-map.png").then(useImg => {
    if (useImg) {
      svgSlot.innerHTML = `
        <div class="map-img-wrap">
          <img src="./assets/img/wasteland-map.png" alt="Wasteland map"/>
          ${overlaySvg(s)}
        </div>`;
    } else {
      fetch("./assets/svg/wasteland-map.svg").then(r => r.text()).then(svg => {
        svgSlot.innerHTML = `<div class="map-img-wrap">${svg}${overlaySvg(s)}</div>`;
        wireBaseMap(svgSlot, el);
      });
      return;
    }
    wireBaseMap(svgSlot, el);
  });

  hookListAndButtons(el);
  hookMapInteractions(el);
}

function hookListAndButtons(el) {
  el.querySelectorAll(".legend .list li").forEach(li => {
    li.addEventListener("click", () => {
      _selected = li.dataset.id;
      play("key_press");
      render(el);
    });
  });

  const sd = el.querySelector("#setdest");
  if (sd) sd.addEventListener("click", () => {
    const loc = LOCATIONS[_selected];
    if (!loc) return;
    mutate(s => { s.destination = { id: _selected, name: loc.name, x: loc.x, y: loc.y }; });
    play("achievement");
  });

  const ft = el.querySelector("#ftravel");
  if (ft) ft.addEventListener("click", () => {
    const loc = LOCATIONS[_selected];
    if (!loc) return;
    mutate(s => {
      s.player_pos = { x: loc.x, y: loc.y };
      if (!s.known_locations) s.known_locations = [];
      if (!s.known_locations.includes(_selected)) s.known_locations.push(_selected);
      // Arriving at the destination clears it
      if (s.destination && s.destination.id === _selected) s.destination = null;
    });
    play("unlock");
  });

  const cd = el.querySelector("#cleardest");
  if (cd) cd.addEventListener("click", () => {
    mutate(s => { s.destination = null; });
    play("error");
  });
}

function wireBaseMap(svgSlot, el) {
  const baseSvg = svgSlot.querySelector("svg.wm-base") || svgSlot.querySelector("svg");
  if (!baseSvg) return;
  // The base SVG should expose its markers via [data-id]
  baseSvg.querySelectorAll("[data-id]").forEach(g => {
    g.addEventListener("click", (e) => {
      e.stopPropagation();
      _selected = g.dataset.id;
      play("key_press");
      render(el);
    });
    if (_selected === g.dataset.id) g.querySelector(".marker")?.classList.add("active");
  });

  // Also apply current viewBox to BOTH svgs
  applyViewBox(svgSlot);
}

function hookMapInteractions(el) {
  const stage = el.querySelector("#map-stage");

  // Buttons
  stage.querySelectorAll(".map-btn").forEach(b => {
    b.addEventListener("click", () => {
      const act = b.dataset.act;
      const s = loadState();
      const v = { ...s.map_view };
      if (act === "in")    zoom(v, 0.7, v.x + v.w/2, v.y + v.h/2);
      if (act === "out")   zoom(v, 1/0.7, v.x + v.w/2, v.y + v.h/2);
      if (act === "reset") Object.assign(v, { x: 0, y: 0, w: VB.w, h: VB.h });
      if (act === "recenter") {
        v.x = Math.max(0, Math.min(VB.w - v.w, s.player_pos.x - v.w/2));
        v.y = Math.max(0, Math.min(VB.h - v.h, s.player_pos.y - v.h/2));
      }
      mutate(st => { st.map_view = clampView(v); });
      play("tab_click");
    });
  });

  // Wheel zoom (toward cursor)
  stage.addEventListener("wheel", (e) => {
    if (!e.target.closest(".map-img-wrap")) return;
    e.preventDefault();
    const wrap = stage.querySelector(".map-img-wrap");
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const u = (e.clientX - r.left) / r.width;
    const v = (e.clientY - r.top)  / r.height;
    const s = loadState();
    const view = { ...s.map_view };
    const cx = view.x + view.w * u;
    const cy = view.y + view.h * v;
    const factor = e.deltaY < 0 ? 0.85 : 1/0.85;
    zoom(view, factor, cx, cy);
    mutate(st => { st.map_view = clampView(view); });
  }, { passive: false });

  // Drag to pan
  stage.addEventListener("pointerdown", (e) => {
    const wrap = e.target.closest(".map-img-wrap");
    if (!wrap) return;
    if (e.target.closest("[data-id]") || e.target.closest(".map-btn")) return;
    const s = loadState();
    _drag = { startX: e.clientX, startY: e.clientY, vx0: s.map_view.x, vy0: s.map_view.y, ww: wrap.clientWidth, wh: wrap.clientHeight };
    wrap.setPointerCapture?.(e.pointerId);
    wrap.style.cursor = "grabbing";
  });
  stage.addEventListener("pointermove", (e) => {
    if (!_drag) return;
    const dx = (e.clientX - _drag.startX) / _drag.ww * loadState().map_view.w;
    const dy = (e.clientY - _drag.startY) / _drag.wh * loadState().map_view.h;
    const s = loadState();
    const v = { ...s.map_view, x: _drag.vx0 - dx, y: _drag.vy0 - dy };
    mutate(st => { st.map_view = clampView(v); });
  });
  ["pointerup","pointercancel","pointerleave"].forEach(ev =>
    stage.addEventListener(ev, () => {
      _drag = null;
      const wrap = stage.querySelector(".map-img-wrap");
      if (wrap) wrap.style.cursor = "";
    }));
}

// ---- Math + helpers ---------------------------------------------------------

function applyViewBox(svgSlot) {
  const v = loadState().map_view;
  svgSlot.querySelectorAll("svg").forEach(svg => {
    svg.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
  });
  const img = svgSlot.querySelector("img");
  if (img) {
    // Map a 800×500 source into the visible viewBox using object-position + scale
    const scaleX = VB.w / v.w;
    const scaleY = VB.h / v.h;
    img.style.transformOrigin = "top left";
    img.style.transform = `translate(${-v.x * scaleX}px, ${-v.y * scaleY}px) scale(${scaleX}, ${scaleY})`;
  }
}

function zoom(view, factor, cx, cy) {
  // Keep (cx,cy) anchored under the cursor
  const u = (cx - view.x) / view.w;
  const w = Math.max(80, Math.min(VB.w, view.w * factor));
  const h = Math.max(50, Math.min(VB.h, view.h * factor));
  view.x = cx - u * w;
  view.y = cy - ((cy - view.y) / view.h) * h;
  view.w = w;
  view.h = h;
  return view;
}

function clampView(v) {
  v.w = Math.max(80, Math.min(VB.w, v.w));
  v.h = Math.max(50, Math.min(VB.h, v.h));
  v.x = Math.max(0, Math.min(VB.w - v.w, v.x));
  v.y = Math.max(0, Math.min(VB.h - v.h, v.y));
  return v;
}

function zoomLabel(v) {
  const z = (VB.w / v.w);
  return `ZOOM ${z.toFixed(1)}×`;
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function bearingDeg(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y; // SVG: y grows downward → "south is positive"
  let deg = Math.atan2(dx, -dy) * 180 / Math.PI; // 0 = north
  if (deg < 0) deg += 360;
  return deg;
}

function formatHeading(b) {
  const card = ["N","NE","E","SE","S","SW","W","NW","N"][Math.round(b / 45)];
  return `${Math.round(b)}° ${card}`;
}

function compassTicks() {
  // Build a 720°-wide tape (so wrapping looks seamless): 360 entries every 1° ≈ 4px.
  const dirs = { 0:"N", 45:"NE", 90:"E", 135:"SE", 180:"S", 225:"SW", 270:"W", 315:"NW" };
  let s = "";
  // Build twice: 0..359 and 0..359, joined.
  for (let pass = 0; pass < 2; pass++) {
    for (let d = 0; d < 360; d++) {
      if (dirs[d]) s += `<span class="t big">${dirs[d]}</span>`;
      else if (d % 5 === 0) s += `<span class="t med">|</span>`;
      else s += `<span class="t small">·</span>`;
    }
  }
  return s;
}

function currentLocationName(p) {
  let nearest = null, bestD = Infinity;
  for (const [id, l] of Object.entries(LOCATIONS)) {
    const d = distance(p, l);
    if (d < bestD) { bestD = d; nearest = { id, ...l }; }
  }
  if (!nearest) return `${Math.round(p.x)},${Math.round(p.y)}`;
  if (bestD < 12) return nearest.name;
  return `near ${nearest.name} (${(bestD * 0.025).toFixed(1)} km)`;
}

// SVG overlay drawn on top of the map: player marker, destination ring, travel path.
function overlaySvg(s) {
  const p = s.player_pos;
  const d = s.destination;
  return `
    <svg class="wm-overlay" viewBox="0 0 ${VB.w} ${VB.h}" preserveAspectRatio="xMidYMid meet">
      ${d ? `
        <line x1="${p.x}" y1="${p.y}" x2="${d.x}" y2="${d.y}"
              stroke="currentColor" stroke-width="1.2" stroke-dasharray="4 4" opacity="0.7"/>
        <g transform="translate(${d.x},${d.y})">
          <circle r="18" fill="none" stroke="currentColor" stroke-width="1" opacity="0.6">
            <animate attributeName="r" values="14;22;14" dur="1.8s" repeatCount="indefinite"/>
          </circle>
          <polygon points="-6,-6 6,-6 0,8" fill="currentColor"/>
        </g>` : ""}

      <g class="player" transform="translate(${p.x},${p.y})">
        <circle r="10" fill="none" stroke="currentColor" stroke-width="1.2">
          <animate attributeName="r" values="6;14;6" dur="1.6s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.9;0.1;0.9" dur="1.6s" repeatCount="indefinite"/>
        </circle>
        <polygon points="0,-7 5,5 -5,5" fill="currentColor"/>
      </g>
    </svg>
  `;
}

function escape(s) { return String(s).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c])); }
