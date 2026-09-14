// LMS-content#99: every simulation's palette reads. Each package's style.css declares its
// tokens for light and dark (`[data-theme="light"]` and `[data-theme="dark"]`, copied from the
// authoring template); this checks, from the CSS itself, that every text-bearing token reads at
// 4.5:1 or better (WCAG 1.4.3) on the page, the surface, the panel and the inset of its mode,
// that the shared ink (`--primary-contrast`) reads on every fill it may be drawn on, and that
// each dedicated ink reads on its fill. A checked token written in any form but hex fails
// outright rather than slipping past. Tokens that only ever colour marks, lines or fills are
// listed in NOT_TEXT, per package where a name means text elsewhere. Run by `npm run gate`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const PACKAGES = path.join(path.dirname(fileURLToPath(import.meta.url)), "../packages");
const TEMPLATE = path.join(PACKAGES, "../../skills/lms-authoring-simulations/template/style.css");

/** The backgrounds text sits on. */
const GROUNDS = ["bg", "surface", "panel", "inset"];
/** Every package must declare these. */
const REQUIRED = ["bg", "fg", "muted", "surface", "primary", "primary-contrast"];
/** Tokens that are never text anywhere: grounds, lines, borders, and the inks that pair with a fill. */
const NOT_TEXT_EVERYWHERE = new Set([
  ...GROUNDS, "border", "grid", "contour", "edge", "primary-contrast", "marker-fg", "chip-bg", "chip-fg", "dcn-bg", "ici-bg",
  "unit", "unit-fg", "mxu", "mxu-fg", "hbm-fg", "ici-fg", "neighbor", "neighbor-fg", "focus", "amber", "amber-fg", "core-bg", "core-fg",
]);
/** Tokens that are fills or lines in one package but text in another: excluded only where they are not text. */
const NOT_TEXT_IN = {
  "tpu-vm-anatomy": ["hbm", "ici", "marker"], // fills with their own inks (hbm-fg, ici-fg, marker-fg)
  "vector-basis-explorer": ["axis", "guide"], // axis and projection lines
  "tensor-rank-explorer": ["ctop", "cfront", "cside", "cedge"], // cube faces and edges
  "torus-3d": ["link"], // the wrap-around links
};
/** A dedicated ink and the fill it is drawn on. */
const INK_ON_FILL = [["unit-fg", "unit"], ["mxu-fg", "mxu"], ["hbm-fg", "hbm"], ["ici-fg", "ici"], ["neighbor-fg", "neighbor"], ["marker-fg", "marker"], ["amber-fg", "amber"], ["core-fg", "core-bg"], ["chip-fg", "chip-bg"]];

/** Every `--name: value` declaration of the block a selector opens, values as written. */
export function declarations(css, selector) {
  const start = css.indexOf(selector);
  if (start < 0) return null;
  const open = css.indexOf("{", start);
  const end = css.indexOf("}", open);
  const out = {};
  for (const m of css.slice(open, end).matchAll(/--([a-z-]+)\s*:\s*([^;}]+)/g)) out[m[1]] = m[2].trim();
  return out;
}

/** A colour as six lowercase hex digits, or null when it is written in a form this check does not resolve. */
export function hex6(value) {
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${[...v.slice(1)].map((c) => c + c).join("")}`;
  return null;
}

function luminance(hex) {
  const c = [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** The WCAG 2 contrast ratio of two hex colours. */
export function contrast(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** The problems in one mode's token block: missing or unresolvable required tokens, and every pairing under 4.5:1. */
export function problems(decl, notText) {
  const out = [];
  const t = {};
  for (const [name, value] of Object.entries(decl)) {
    const hex = hex6(value);
    if (hex) t[name] = hex;
    else if (!notText.has(name) || GROUNDS.includes(name)) out.push(`--${name}: ${value} is not a hex colour this check can resolve`);
  }
  for (const name of REQUIRED) if (!t[name]) out.push(`--${name} is missing`);
  const grounds = GROUNDS.filter((g) => t[g]);
  const short = (fg, bg, what) => { const r = contrast(t[fg], t[bg]); if (r < 4.5) out.push(`${what}: --${fg} ${t[fg]} on --${bg} ${t[bg]} reads at ${r.toFixed(2)}:1`); };
  for (const name of Object.keys(t)) {
    if (notText.has(name)) continue;
    for (const g of grounds) short(name, g, "text");
  }
  // The shared ink is drawn on the primary fill and on every semantic colour used as a fill (buttons, chips, badges).
  if (t["primary-contrast"]) for (const name of Object.keys(t)) if (!notText.has(name)) short("primary-contrast", name, "ink on fill");
  for (const [ink, fill] of INK_ON_FILL) if (t[ink] && t[fill]) short(ink, fill, "ink on fill");
  return out;
}

const files = [["template", TEMPLATE], ...fs.readdirSync(PACKAGES).sort().filter((n) => fs.existsSync(path.join(PACKAGES, n, "style.css"))).map((n) => [n, path.join(PACKAGES, n, "style.css")])];

for (const [name, file] of files) {
  test(`${name}: the light and dark palettes read at 4.5:1 or better, as text and as ink on fills`, () => {
    const css = fs.readFileSync(file, "utf8");
    const light = declarations(css, '[data-theme="light"]');
    const dark = declarations(css, '[data-theme="dark"]');
    assert.ok(light && dark, "declares [data-theme=\"light\"] and [data-theme=\"dark\"] token blocks (the template's)");
    const notText = new Set([...NOT_TEXT_EVERYWHERE, ...(NOT_TEXT_IN[name] ?? [])]);
    assert.deepEqual(problems(light, notText), [], "light");
    assert.deepEqual(problems(dark, notText), [], "dark");
  });
}

test("consistent-hash-ring: each theme's node palette reads as the ring's labels on that theme's page", () => {
  const js = fs.readFileSync(path.join(PACKAGES, "consistent-hash-ring", "main.js"), "utf8");
  const css = fs.readFileSync(path.join(PACKAGES, "consistent-hash-ring", "style.css"), "utf8");
  const list = (name) => [...(js.match(new RegExp(`const ${name} = \\[([^\\]]+)\\]`))?.[1] ?? "").matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0].toLowerCase());
  for (const [name, selector] of [["PALETTE_LIGHT", '[data-theme="light"]'], ["PALETTE_DARK", '[data-theme="dark"]']]) {
    const colours = list(name);
    assert.equal(colours.length, 8, `${name} has eight colours`);
    const bg = hex6(declarations(css, selector).bg);
    const short = colours.map((c) => [c, contrast(c, bg)]).filter(([, r]) => r < 4.5).map(([c, r]) => `${c} at ${r.toFixed(2)}:1`);
    assert.deepEqual(short, [], `${name} on ${bg}`);
  }
  assert.match(js, /return palette\(\)\[/, "nodeColor reads the theme's palette");
});

test("the check fails on an unresolvable value, a missing required token, and a short pairing, and passes the template's pairs", () => {
  const good = { bg: "#ffffff", fg: "#0f172a", muted: "#475569", surface: "#f8fafc", primary: "#2563eb", "primary-contrast": "#fff", accent: "#0f766e" };
  assert.deepEqual(problems(good, NOT_TEXT_EVERYWHERE), []);
  assert.deepEqual(problems({ ...good, muted: "rgb(71, 85, 105)" }, NOT_TEXT_EVERYWHERE), ["--muted: rgb(71, 85, 105) is not a hex colour this check can resolve", "--muted is missing"]);
  assert.deepEqual(problems({ ...good, bg: "var(--page)" }, NOT_TEXT_EVERYWHERE).filter((p) => p.includes("--bg")), ["--bg: var(--page) is not a hex colour this check can resolve", "--bg is missing"]);
  const { "primary-contrast": _ink, ...noInk } = good;
  assert.deepEqual(problems(noInk, NOT_TEXT_EVERYWHERE), ["--primary-contrast is missing"]);
  assert.deepEqual(problems({ ...good, accent: "#0d9488" }, NOT_TEXT_EVERYWHERE), [
    "text: --accent #0d9488 on --bg #ffffff reads at 3.74:1",
    "text: --accent #0d9488 on --surface #f8fafc reads at 3.58:1",
    "ink on fill: --primary-contrast #ffffff on --accent #0d9488 reads at 3.74:1",
  ]);
  assert.ok(Math.abs(contrast("#000000", "#ffffff") - 21) < 0.01);
});
