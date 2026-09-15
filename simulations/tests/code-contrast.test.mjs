// LMS-content#126: text a simulation draws on a colour of its own reads at 4.5:1 or better (WCAG 1.4.3)
// in the states a control puts it in, not only on load.
// - A code overlay (`.code-overlay`) marks spans: tokens (`.kw`, `.op`, `.cm`) and highlights (`.hl`,
//   `.hl-bg`). A highlight with a background tints what sits on it, so every token, and every highlight
//   nested in another, is checked on every tint it may sit on (one highlight, or one inside another),
//   with the colour it takes there (`.code-overlay .hl .kw { color: inherit }` and the like), in light
//   and dark, from the package's own tokens. palette-contrast.test.mjs checks the tokens on the grounds.
// - image-tensor-explorer writes each pixel's value on the pixel's colour, in the ink `pixelInk` picks.
// Run by `npm run gate`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const PACKAGES = path.join(path.dirname(fileURLToPath(import.meta.url)), "../packages");
const OVERLAY = ".code-overlay";

function luminance(hex) {
  const c = [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a, b) => { const x = luminance(a); const y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Every rule of a stylesheet as selector → declarations, later rules winning; nested blocks are read by their innermost selector. */
export function rules(css) {
  const out = new Map();
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls = {};
    for (const d of m[2].split(";")) {
      const i = d.indexOf(":");
      if (i > 0) decls[d.slice(0, i).trim()] = d.slice(i + 1).trim();
    }
    for (const selector of m[1].split(",")) {
      const key = selector.trim().replace(/\s+/g, " ");
      out.set(key, { ...(out.get(key) ?? {}), ...decls });
    }
  }
  return out;
}

/** The token block a selector opens (`[data-theme="light"]`), as name → six-digit hex. */
function tokens(css, selector) {
  const start = css.indexOf(selector);
  if (start < 0) return null;
  const block = css.slice(css.indexOf("{", start), css.indexOf("}", start));
  const out = {};
  for (const m of block.matchAll(/--([a-z-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\b/g)) {
    const v = m[2].toLowerCase();
    out[m[1]] = v.length === 4 ? `#${[...v.slice(1)].map((c) => c + c).join("")}` : v;
  }
  return out;
}

/** The problems with the code overlay's text on its tints under one mode's tokens: each pairing under 4.5:1 or a colour this check can't resolve. */
export function overlayProblems(css, t) {
  const r = rules(css);
  const own = (selector, prop) => r.get(selector)?.[prop];
  const problems = [];
  const resolve = (value, what) => {
    const v = value?.match(/^var\(--([\w-]+)\)$/);
    if (v && t[v[1]]) return t[v[1]];
    problems.push(`${what}: ${value} is not a colour this check resolves`);
    return null;
  };
  const spans = [...r.keys()].map((k) => k.match(/^\.code-overlay \.([\w-]+)$/)?.[1]).filter(Boolean);
  const background = (cls) => own(`${OVERLAY} .${cls}`, "background") ?? own(`${OVERLAY} .${cls}`, "background-color");
  const tints = spans.filter((c) => background(c));
  const inks = spans.filter((c) => !background(c) && own(`${OVERLAY} .${c}`, "color"));

  const base = resolve(own(OVERLAY, "background") ?? own(OVERLAY, "background-color"), OVERLAY);
  /** The ground under a chain of tints, outermost first. */
  const ground = (chain) => chain.reduce((under, cls) => {
    if (!under) return null;
    const value = background(cls);
    const mix = value.match(/^color-mix\(in srgb,\s*var\(--([\w-]+)\)\s*(\d+)%,\s*transparent\)$/);
    if (mix && t[mix[1]]) {
      const a = Number(mix[2]) / 100;
      const top = toRgb(t[mix[1]]);
      return toHex(toRgb(under).map((u, i) => a * top[i] + (1 - a) * u));
    }
    return resolve(value, `${OVERLAY} .${cls} background`);
  }, base);
  /** The colour a span takes inside a chain of tints, outermost first. */
  const colour = (cls, chain) => {
    for (let i = chain.length - 1; i >= 0; i--) {
      const v = own(`${OVERLAY} .${chain[i]} .${cls}`, "color");
      if (v) return v === "inherit" ? colour(chain[i], chain.slice(0, i)) : resolve(v, `${OVERLAY} .${chain[i]} .${cls}`);
    }
    const v = own(`${OVERLAY} .${cls}`, "color");
    if (v && v !== "inherit") return resolve(v, `${OVERLAY} .${cls}`);
    return chain.length ? colour(chain.at(-1), chain.slice(0, -1)) : resolve(own(OVERLAY, "color"), OVERLAY);
  };

  const chains = [[], ...tints.map((a) => [a]), ...tints.flatMap((a) => tints.filter((b) => b !== a).map((b) => [a, b]))];
  for (const chain of chains) {
    const bg = ground(chain);
    const where = chain.length ? chain.map((c) => `.${c}`).join(" in ") : OVERLAY;
    const texts = [[chain.length ? `.${chain.at(-1)} text` : "text", chain.length ? colour(chain.at(-1), chain.slice(0, -1)) : colour("", [])], ...inks.map((c) => [`.${c}`, colour(c, chain)])];
    for (const [what, fg] of texts) {
      if (!bg || !fg) continue;
      const ratio = contrast(fg, bg);
      if (ratio < 4.5) problems.push(`${what} ${fg} on ${where} ${bg} reads at ${ratio.toFixed(2)}:1`);
    }
  }
  return [...new Set(problems)];
}

for (const name of fs.readdirSync(PACKAGES).sort()) {
  const file = path.join(PACKAGES, name, "style.css");
  if (!fs.existsSync(file)) continue;
  const css = fs.readFileSync(file, "utf8");
  if (![...rules(css).keys()].some((k) => k.startsWith(`${OVERLAY} .`))) continue;
  test(`${name}: every token and highlight in the code overlay reads on every tint it may sit on, light and dark`, () => {
    for (const mode of ["light", "dark"]) {
      const t = tokens(css, `[data-theme="${mode}"]`);
      assert.ok(t, `declares [data-theme="${mode}"] tokens`);
      assert.deepEqual(overlayProblems(css, t), [], mode);
    }
  });
}

/** `pixelInk` from image-tensor-explorer's main.js, run on its own. */
function loadPixelInk() {
  const js = fs.readFileSync(path.join(PACKAGES, "image-tensor-explorer", "main.js"), "utf8");
  const source = js.match(/^function pixelInk\([\s\S]*?\n\}/m)?.[0];
  assert.ok(source, "main.js defines function pixelInk(r, g, b)");
  return { js, pixelInk: vm.runInNewContext(`${source}; pixelInk`) };
}

test("image-tensor-explorer: a pixel's value reads at 4.5:1 or better on every colour the pixel can take", () => {
  const { js, pixelInk } = loadPixelInk();
  assert.match(js, /pixels\[i\]\.style\.color = pixelInk\(r, g, b\);/, "each pixel's ink comes from pixelInk");
  assert.doesNotMatch(js, /style\.color = [^;]*rgba\(/, "no translucent ink, whose contrast depends on what is under it");
  const short = [];
  const steps = [...Array.from({ length: 18 }, (_, i) => i * 15), 255];
  for (const r of steps) for (const g of steps) for (const b of steps) {
    const ink = pixelInk(r, g, b);
    const ratio = contrast(ink === "#000" ? "#000000" : "#ffffff", toHex([r, g, b]));
    if (ratio < 4.5) short.push(`${ink} on rgb(${r},${g},${b}) at ${ratio.toFixed(2)}:1`);
  }
  assert.deepEqual(short.slice(0, 5), []);
  assert.equal(pixelInk(255, 0, 0), "#000", "pure red, the red channel's brightest pixel, takes black (white reads at 4.00:1)");
});

test("capacity-orchestrator: the booked reservation's label reads at 4.5:1 or better on the calendar box's tint, over every ground, light and dark", () => {
  const css = fs.readFileSync(path.join(PACKAGES, "capacity-orchestrator", "style.css"), "utf8");
  const r = rules(css);
  const tint = r.get(".calendar-input")?.background?.match(/^color-mix\(in srgb,\s*var\(--([\w-]+)\)\s*(\d+)%,\s*transparent\)$/);
  const ink = r.get(".cal-label")?.color?.match(/^var\(--([\w-]+)\)$/);
  assert.ok(tint && ink, ".calendar-input is a color-mix tint and .cal-label a token colour");
  for (const mode of ["light", "dark"]) {
    const t = tokens(css, `[data-theme="${mode}"]`);
    const short = [];
    for (const g of ["bg", "surface", "panel"].filter((name) => t[name])) {
      const a = Number(tint[2]) / 100;
      const bg = toHex(toRgb(t[g]).map((u, i) => a * toRgb(t[tint[1]])[i] + (1 - a) * u));
      const ratio = contrast(t[ink[1]], bg);
      if (ratio < 4.5) short.push(`--${ink[1]} ${t[ink[1]]} on the tint over --${g} (${bg}) reads at ${ratio.toFixed(2)}:1`);
    }
    assert.deepEqual(short, [], mode);
  }
});

test("tpu-vm-anatomy: the no-SparseCores note, drawn on the chip's fill, reads at 4.5:1 or better on it, light and dark", () => {
  const dir = path.join(PACKAGES, "tpu-vm-anatomy");
  const js = fs.readFileSync(path.join(dir, "main.js"), "utf8");
  const css = fs.readFileSync(path.join(dir, "style.css"), "utf8");
  const note = js.match(/<div class="sc" style="[^"]*\bcolor:var\(--([\w-]+)\)[^"]*">No SparseCores/);
  assert.ok(note, "the note sets its colour from a token");
  assert.match(rules(css).get(".chip")?.background ?? "", /^var\(--chip-bg\)$/, "the chip is filled with --chip-bg");
  for (const mode of ["light", "dark"]) {
    const t = tokens(css, `[data-theme="${mode}"]`);
    const ratio = contrast(t[note[1]], t["chip-bg"]);
    assert.ok(ratio >= 4.5, `${mode}: --${note[1]} ${t[note[1]]} on --chip-bg ${t["chip-bg"]} reads at ${ratio.toFixed(2)}:1`);
  }
});

test("the overlay check tints, inherits and nests as the browser does, and reports a short pairing", () => {
  const t = { panel: "#ffffff", fg: "#0f172a", muted: "#475569", primary: "#2563eb", good: "#0f766e", warn: "#b45309" };
  const css = `.code-overlay { background: var(--panel); color: var(--muted); }
    .code-overlay .hl { background: color-mix(in srgb, var(--primary) 30%, transparent); color: var(--fg); }
    .code-overlay .kw { color: var(--good); }`;
  assert.deepEqual(overlayProblems(css, t), [".kw #0f766e on .hl #bed0f9 reads at 3.54:1"]);
  assert.deepEqual(overlayProblems(`${css} .code-overlay .hl .kw { color: inherit; }`, t), []);
  const nested = `${css} .code-overlay .hl .kw { color: inherit; } .code-overlay .mark { background: color-mix(in srgb, var(--warn) 30%, transparent); color: var(--primary); }`;
  assert.ok(overlayProblems(nested, t).some((p) => p.startsWith(".mark text #2563eb on .hl in .mark")), overlayProblems(nested, t).join("\n"));
  assert.deepEqual(overlayProblems(".code-overlay { background: rgb(1, 2, 3); color: var(--fg); } .code-overlay .kw { color: var(--good); }", t), [".code-overlay: rgb(1, 2, 3) is not a colour this check resolves"]);
});

test("image-tensor-explorer: pixelInk contrast holds on grayscale crossover threshold, primaries and all simulation states", () => {
  const { pixelInk } = loadPixelInk();
  // Mathematical crossover threshold is luminance ~0.179128 (grayscale c=117 vs c=118)
  assert.equal(pixelInk(117, 117, 117), "#fff", "c=117 luminance is just below crossover; contrast with white is >4.5:1");
  assert.equal(pixelInk(118, 118, 118), "#000", "c=118 luminance is just above crossover; contrast with black is >4.5:1");
  assert.ok(contrast("#ffffff", toHex([117, 117, 117])) >= 4.5);
  assert.ok(contrast("#000000", toHex([118, 118, 118])) >= 4.5);

  // sRGB linear threshold boundary (c=10 linear, c=11 power curve)
  for (const c of [0, 10, 11, 255]) {
    const ink = pixelInk(c, c, c);
    const ratio = contrast(ink === "#000" ? "#000000" : "#ffffff", toHex([c, c, c]));
    assert.ok(ratio >= 4.5, `grayscale ${c}: ${ratio.toFixed(2)}:1`);
  }

  // Extreme primaries and secondaries
  const primaries = [
    [255, 0, 0], [0, 255, 0], [0, 0, 255],
    [255, 255, 0], [0, 255, 255], [255, 0, 255],
    [0, 0, 0], [255, 255, 255],
  ];
  for (const [r, g, b] of primaries) {
    const ink = pixelInk(r, g, b);
    const ratio = contrast(ink === "#000" ? "#000000" : "#ffffff", toHex([r, g, b]));
    assert.ok(ratio >= 4.5, `rgb(${r},${g},${b}): ${ratio.toFixed(2)}:1`);
  }

  // Actual landscape generator pixels across frames 0, 1, 2 and steps
  for (let f = 0; f < 3; f++) {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const sunY = 3 + f * 1.5;
        const dist = Math.sqrt((x - 3.5) ** 2 + (y - sunY) ** 2);
        let r, g, b;
        if (y > 5) { r = 34 + f * 10; g = 139 - f * 20; b = 34; }
        else if (dist < 2.5) { r = 255; g = 200 - f * 40; b = 50; }
        else { r = 135 - f * 30; g = 206 - f * 50; b = 235; }

        const variants = [
          [r, g, b],
          [r, 0, 0],
          [0, g, 0],
          [0, 0, b],
          [Math.floor(0.3 * r + 0.59 * g + 0.11 * b), Math.floor(0.3 * r + 0.59 * g + 0.11 * b), Math.floor(0.3 * r + 0.59 * g + 0.11 * b)],
        ];
        for (const [pr, pg, pb] of variants) {
          const ink = pixelInk(pr, pg, pb);
          const ratio = contrast(ink === "#000" ? "#000000" : "#ffffff", toHex([pr, pg, pb]));
          assert.ok(ratio >= 4.5, `pixel (${x},${y},f=${f}) rgb(${pr},${pg},${pb}): ${ratio.toFixed(2)}:1`);
        }
      }
    }
  }
});
