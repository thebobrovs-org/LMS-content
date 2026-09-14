// LMS-content#99: every simulation's palette reads. Each package's style.css declares its
// tokens for light and dark (`[data-theme="light"]` and `[data-theme="dark"]`, copied from the
// authoring template); this checks, from the CSS itself, that every text-bearing token reads at
// 4.5:1 or better (WCAG 1.4.3) on the page, the surface and the panel in its mode, and that the
// ink tokens read on the fills they are for. Tokens that only ever colour marks, lines or fills
// are listed in NOT_TEXT. Run by `npm run gate`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const PACKAGES = path.join(path.dirname(fileURLToPath(import.meta.url)), "../packages");
const TEMPLATE = path.join(PACKAGES, "../../skills/lms-authoring-simulations/template/style.css");

/** The backgrounds text sits on. */
const GROUNDS = ["bg", "surface", "panel", "inset"];
/** Tokens that are never text: fills, lines, borders and the inks that pair with a fill. */
const NOT_TEXT = new Set([
  ...GROUNDS, "border", "grid", "contour", "edge", "primary-contrast", "marker", "marker-fg", "chip-bg", "dcn-bg", "ici-bg",
  "unit", "unit-fg", "mxu", "mxu-fg", "hbm", "hbm-fg", "ici", "ici-fg", "neighbor", "neighbor-fg", "focus",
  "amber", "amber-fg", "core-bg", "core-fg", // tpu-vm-anatomy: the host, PCIe and TensorCore fills and their inks
  "axis", "guide", // vector-basis-explorer: axis and projection lines
  "ctop", "cfront", "cside", "cedge", // tensor-rank-explorer: cube faces and edges
  "link", // torus-3d: the wrap-around links
]);
/** A fill and the ink drawn on it. */
const INK_ON_FILL = [["primary-contrast", "primary"], ["unit-fg", "unit"], ["mxu-fg", "mxu"], ["hbm-fg", "hbm"], ["ici-fg", "ici"], ["neighbor-fg", "neighbor"], ["marker-fg", "marker"], ["amber-fg", "amber"], ["core-fg", "core-bg"]];

/** The `--name: #hex` declarations of the block a selector opens. */
export function tokens(css, selector) {
  const start = css.indexOf(selector);
  if (start < 0) return null;
  const open = css.indexOf("{", start);
  const end = css.indexOf("}", open);
  const out = {};
  for (const m of css.slice(open, end).matchAll(/--([a-z-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\b/g)) out[m[1]] = hex6(m[2]);
  return out;
}

function hex6(h) {
  const v = h.toLowerCase();
  return v.length === 4 ? `#${[...v.slice(1)].map((c) => c + c).join("")}` : v;
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

function check(t, mode) {
  const short = [];
  const grounds = GROUNDS.filter((g) => t[g]);
  assert.ok(t.bg && t.fg, `${mode}: --bg and --fg`);
  for (const [name, hex] of Object.entries(t)) {
    if (NOT_TEXT.has(name)) continue;
    for (const g of grounds) {
      const r = contrast(hex, t[g]);
      if (r < 4.5) short.push(`--${name} ${hex} on --${g} ${t[g]} reads at ${r.toFixed(2)}:1`);
    }
  }
  for (const [ink, fill] of INK_ON_FILL) {
    if (!t[ink] || !t[fill]) continue;
    const r = contrast(t[ink], t[fill]);
    if (r < 4.5) short.push(`--${ink} ${t[ink]} on --${fill} ${t[fill]} reads at ${r.toFixed(2)}:1`);
  }
  assert.deepEqual(short, [], `${mode}: every text token at 4.5:1 or better`);
}

const files = [["template", TEMPLATE], ...fs.readdirSync(PACKAGES).sort().filter((n) => fs.existsSync(path.join(PACKAGES, n, "style.css"))).map((n) => [n, path.join(PACKAGES, n, "style.css")])];

for (const [name, file] of files) {
  test(`${name}: the light and dark palettes read at 4.5:1 or better`, () => {
    const css = fs.readFileSync(file, "utf8");
    const light = tokens(css, '[data-theme="light"]');
    const dark = tokens(css, '[data-theme="dark"]');
    assert.ok(light && dark, "declares [data-theme=\"light\"] and [data-theme=\"dark\"] token blocks (the template's)");
    check(light, "light");
    check(dark, "dark");
  });
}

test("contrast is the WCAG ratio", () => {
  assert.ok(Math.abs(contrast("#000000", "#ffffff") - 21) < 0.01);
  assert.ok(Math.abs(contrast("#64748b", "#f1f5f9") - 4.34) < 0.02); // the muted grey on the surface before LMS-content#99
  assert.ok(contrast("#475569", "#f1f5f9") > 6.5); // 6.9:1 after
});
