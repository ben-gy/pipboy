// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// tabs/radio.js — stations + DJ chatter ticker + Spotify embed (when configured).

import { play, setHumVolume, setVolume } from "../sound.js";
import { bobblePixel } from "../bobbleheads.js";
import { RADIO_STATIONS, spotifyEmbedURL } from "../radio-config.js";

let _stIdx = 0;
let _vol   = 0.6;
let _staticInt = null;

export function mount(el, ctx) {
  render(el);
  ctx.subtabs.innerHTML = `
    <span style="color:var(--phosphor-dim);font-family:var(--font-mono);font-size:13px">
      SIGNAL: ${signalBars()} &nbsp;·&nbsp; ${RADIO_STATIONS.filter(s=>s.spotify_id).length}/${RADIO_STATIONS.length} STATIONS LIVE
    </span>`;
}

export function unmount() {
  setHumVolume(0.07);
  if (_staticInt) clearInterval(_staticInt);
  _staticInt = null;
}

function signalBars() {
  const filled = Math.ceil(_vol * 5);
  return "▮".repeat(filled) + "▯".repeat(5 - filled);
}

function render(el) {
  const st  = RADIO_STATIONS[_stIdx];
  const url = spotifyEmbedURL(st);

  el.innerHTML = `
    <div class="radio">
      <section class="stations">
        <h2 style="letter-spacing:2px;margin:0 0 6px">STATIONS ${bobblePixel("I")}</h2>
        ${RADIO_STATIONS.map((s, i) => `
          <div class="s ${i === _stIdx ? "active" : ""}" data-i="${i}">
            <span class="s-name">${escape(s.name)}</span>
            <span class="s-meta">
              <span class="s-freq">${s.freq}</span>
              <span class="s-live ${s.spotify_id ? "on" : "off"}">${s.spotify_id ? "● LIVE" : "○ STATIC"}</span>
            </span>
          </div>
        `).join("")}
      </section>

      <section class="panel">
        <div class="panel-row">
          <strong>NOW PLAYING:</strong> ${escape(st.name)}
          <span style="opacity:.6;font-family:var(--font-mono);font-size:13px;letter-spacing:1px">${st.freq} MHz</span>
        </div>

        <div class="ticker">
          <div class="scroll">${st.chatter.map(escape).join("   ❖   ")}   ❖   ${st.chatter.map(escape).join("   ❖   ")}</div>
        </div>

        <div class="spotify-shell ${url ? "live" : "off"}">
          ${url
            ? `<iframe class="spotify-embed"
                       src="${url}"
                       width="100%" height="232" frameborder="0"
                       allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                       loading="lazy"
                       referrerpolicy="strict-origin-when-cross-origin"></iframe>`
            : `<div class="no-signal">
                <div class="ns-title">NO SIGNAL — STATIC ONLY</div>
                <div class="ns-sub">Set a Spotify playlist for this station in <code>js/radio-config.js</code>.</div>
              </div>`
          }
        </div>

        <div class="panel-controls">
          <label class="ctl">
            <span class="ctl-lbl">TUNER</span>
            <input type="range" class="pip" id="tuner"
                   min="0" max="${RADIO_STATIONS.length - 1}" value="${_stIdx}" step="1"/>
            <span class="ctl-val">${escape(st.name.split(" ")[0])}</span>
          </label>
          <label class="ctl">
            <span class="ctl-lbl">VOL</span>
            <input type="range" class="pip" id="vol"
                   min="0" max="100" value="${Math.round(_vol*100)}" step="1"/>
            <span class="ctl-val" id="vol-num">${Math.round(_vol*100)}%</span>
          </label>
        </div>

        <div class="freq-strip">
          ${RADIO_STATIONS.map(s => `<span>${s.freq}</span>`).join("")}
        </div>
      </section>
    </div>
  `;

  // Station click
  el.querySelectorAll(".stations .s").forEach(s => {
    s.addEventListener("click", () => tuneTo(parseInt(s.dataset.i, 10), el));
  });
  // Tuner range
  const tuner = el.querySelector("#tuner");
  tuner.addEventListener("input", () => tuneTo(parseInt(tuner.value, 10), el));

  // Volume range
  const volEl = el.querySelector("#vol");
  const volNum = el.querySelector("#vol-num");
  volEl.addEventListener("input", () => {
    _vol = parseInt(volEl.value, 10) / 100;
    setVolume(_vol);                                  // master volume (synth)
    setHumVolume(0.04 + _vol * 0.14);                 // tube hum
    volNum.textContent = Math.round(_vol * 100) + "%";
  });

  // Periodic short static while idle
  if (_staticInt) clearInterval(_staticInt);
  _staticInt = setInterval(() => {
    if (Math.random() < 0.25) play("static_short");
  }, 4500);

  // If Spotify is providing audio, dial down our synthesized hum so we don't
  // muddy their stream. Keep a faint phantom hum (1%).
  if (url) {
    setHumVolume(0.01);
  } else {
    setHumVolume(0.04 + _vol * 0.14);
  }
}

function tuneTo(idx, el) {
  if (idx === _stIdx) return;
  _stIdx = idx;
  play("static_burst");
  render(el);
}

function escape(s) {
  return String(s).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
}
