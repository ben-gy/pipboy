// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// modal.js — in-Pip-Boy modal dialogs. Replaces all alert()/confirm() so we
// stay inside the green CRT aesthetic.

import { play } from "./sound.js";

let _stack = [];

function host() {
  return document.getElementById("screen") || document.body;
}

/**
 * Open a Pip-Boy modal.
 * Returns a Promise that resolves to the chosen button's `value`.
 *
 * @param {object} opts
 * @param {string} opts.title          — title bar text
 * @param {string|HTMLElement} opts.body — body content (string is treated as HTML)
 * @param {Array<{label:string, value:any, kind?:"default"|"danger"|"ghost"}>} opts.buttons
 * @param {boolean} [opts.dismissable=true] — close on ESC / backdrop click → resolves to null
 */
export function pipModal({ title = "ROBCO TERMINAL", body = "", buttons = [{ label: "OK", value: true }], dismissable = true } = {}) {
  return new Promise((resolve) => {
    const back = document.createElement("div");
    back.className = "pip-modal-back";
    back.innerHTML = `
      <div class="pip-modal" role="dialog" aria-modal="true" aria-label="${escape(title)}">
        <div class="pip-modal-head">${escape(title)}</div>
        <div class="pip-modal-body"></div>
        <div class="pip-modal-foot"></div>
      </div>
    `;
    const bodyEl = back.querySelector(".pip-modal-body");
    if (typeof body === "string") bodyEl.innerHTML = body;
    else bodyEl.appendChild(body);

    const foot = back.querySelector(".pip-modal-foot");
    buttons.forEach((b, i) => {
      const btn = document.createElement("button");
      btn.className = "btn " + (b.kind === "danger" ? "danger" : b.kind === "ghost" ? "ghost" : "");
      btn.textContent = b.label;
      btn.addEventListener("click", () => close(b.value));
      foot.appendChild(btn);
      if (i === buttons.length - 1) setTimeout(() => btn.focus(), 0);
    });

    function close(value) {
      back.classList.add("closing");
      _stack = _stack.filter(x => x !== handler);
      document.removeEventListener("keydown", handler);
      setTimeout(() => { back.remove(); resolve(value); }, 140);
      play("tab_click");
    }

    const handler = (e) => {
      if (!dismissable) return;
      if (e.key === "Escape") { e.stopPropagation(); close(null); }
      if (e.key === "Enter") {
        // confirm primary button (last) on Enter
        const last = foot.lastElementChild;
        if (last && last.tagName === "BUTTON") last.click();
      }
    };
    _stack.push(handler);
    document.addEventListener("keydown", handler);

    if (dismissable) {
      back.addEventListener("click", (e) => { if (e.target === back) close(null); });
    }

    host().appendChild(back);
    play("holotape_insert");
  });
}

/** Simple alert replacement. Resolves when user dismisses. */
export function pipAlert(title, body) {
  return pipModal({ title, body, buttons: [{ label: "OK", value: true }] });
}

/** Yes/No confirmation. Resolves true/false. */
export function pipConfirm(title, body, { confirmLabel = "CONFIRM", cancelLabel = "CANCEL", danger = false } = {}) {
  return pipModal({
    title,
    body,
    buttons: [
      { label: cancelLabel,  value: false, kind: "ghost" },
      { label: confirmLabel, value: true,  kind: danger ? "danger" : "default" },
    ],
  }).then(v => v === true);
}

function escape(s) {
  return String(s).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
}
