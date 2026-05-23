// img.js — image loading with graceful SVG fallback.
// If the requested file in /assets/img/ exists, it's used.
// Otherwise the original hand-drawn SVG renders.

const _svgCache = new Map();
const _existCache = new Map();

export function svg(name) {
  if (_svgCache.has(name)) return _svgCache.get(name);
  const p = fetch(`./assets/svg/${name}.svg`).then(r => r.ok ? r.text() : "");
  _svgCache.set(name, p);
  return p;
}

// Probe whether an /assets/img/<file> exists. Cached.
export function exists(file) {
  if (_existCache.has(file)) return _existCache.get(file);
  const p = fetch(`./assets/img/${file}`, { method: "HEAD" })
    .then(r => r.ok)
    .catch(() => false);
  _existCache.set(file, p);
  return p;
}

// Returns an HTML string: an <img> if the file exists, otherwise inline SVG.
// Use it inside template strings.
export async function imgOrSvg(file, svgName, opts = {}) {
  const klass = opts.class || "";
  const alt   = opts.alt || "";
  const style = opts.style || "";
  const ok = await exists(file);
  if (ok) {
    return `<img src="./assets/img/${file}" alt="${alt}" class="${klass}" style="${style}" />`;
  }
  const s = await svg(svgName);
  // Inject a wrapping span so caller can target it
  return `<span class="${klass}" style="${style}" aria-label="${alt}">${s}</span>`;
}

// Set a CSS variable to a background-image url(...) if the file exists.
// Useful for screensavers, sprites, etc.
export async function setBgVar(varName, file, fallbackSvgName) {
  const ok = await exists(file);
  if (ok) {
    document.documentElement.style.setProperty(varName, `url('./assets/img/${file}')`);
    return true;
  }
  if (fallbackSvgName) {
    const s = await svg(fallbackSvgName);
    document.documentElement.style.setProperty(varName,
      `url("data:image/svg+xml;utf8,${encodeURIComponent(s)}")`);
  }
  return false;
}
