// LMS-content#130: at 320 CSS px (WCAG 1.4.10), and in a lesson's 286 px frame, these simulations scrolled sideways.
// Measured in a browser at every width from 280 to 1280 px, they now fit; this check keeps the rules that make them fit
// from being dropped. It is static, over each package's style.css: the rule, and a media query that covers 320 px
// wherever the rule is a narrow-screen one. Run by `npm run gate`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const PACKAGES = path.join(path.dirname(fileURLToPath(import.meta.url)), "../packages");

/** Each style rule in `css`: its selectors, its declarations, and the `max-width` of the media query it sits in (or null). */
export function rules(css) {
  const out = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const block = (body, maxWidth) => {
    for (let i = 0; i < body.length; ) {
      const open = body.indexOf("{", i);
      if (open < 0) break;
      const head = body.slice(i, open).trim();
      let depth = 1;
      let close = open + 1;
      for (; close < body.length && depth; close++) depth += body[close] === "{" ? 1 : body[close] === "}" ? -1 : 0;
      const inner = body.slice(open + 1, close - 1);
      if (head.startsWith("@media")) {
        const m = head.match(/max-width:\s*(\d+)px/);
        block(inner, m ? Number(m[1]) : null);
      } else if (!head.startsWith("@")) {
        const declarations = Object.fromEntries(inner.split(";").map((d) => d.split(/:(.*)/s).map((x) => x?.trim())).filter(([k, v]) => k && v).map(([k, v]) => [k, v.replace(/\s+/g, " ")]));
        out.push({ selectors: head.split(",").map((s) => s.trim().replace(/\s+/g, " ")), declarations, maxWidth });
      }
      i = close;
    }
  };
  block(text, null);
  return out;
}

/** The values `property` takes on `selector`: everywhere (`narrow` false), or in a media query that covers 320 px (`narrow` true). */
function valuesOf(css, selector, property, narrow) {
  return rules(css)
    .filter((r) => r.selectors.includes(selector) && (narrow ? r.maxWidth !== null && r.maxWidth >= 320 : r.maxWidth === null))
    .map((r) => r.declarations[property])
    .filter(Boolean);
}

// [package, selector, property, value, narrow (in a media query covering 320 px), why]
const EXPECTED = [
  ["capacity-constraint-explorer", ".panel", "min-width", "0", false, "a grid item is otherwise as wide as its widest line of code"],
  ["gradient-sync-explorer", ".controls", "grid-template-columns", "1fr", true, "two columns of controls overflow a 286 px frame"],
  ["gradient-sync-explorer", ".sw input:focus-visible ~ .tr", "outline", "2px solid var(--primary)", false, "the switch's input is invisible, so its focus ring is drawn on the track"],
  ["tpu-evolution-timeline", ".timeline-track", "grid-template-columns", "repeat(4, 1fr)", true, "eight generations in one row overflow a 286 px frame"],
  ["hash-collision", ".controls", "flex-wrap", "wrap", false, "the buttons wrap below the key field"],
  ["hash-collision", "input", "min-width", "0", false, "the key field shrinks to share the row"],
  ["lru-cache", ".controls", "flex-wrap", "wrap", false, "the buttons wrap below the key field"],
  ["lru-cache", "input", "min-width", "0", false, "the key field shrinks to share the row"],
  ["xla-fusion-explorer", ".compile-stage", "flex-direction", "column", true, "the four compile stages in a row need about 680 px"],
  ["xla-fusion-explorer", ".hbm-lane-wrap", "flex", "1", true, "each memory lane shares the width of the op above it"],
  ["xla-fusion-explorer", ".race-stage", "grid-template-columns", "1fr", true, "two race columns need about 860 px"],
  ["tpu-vm-anatomy", ".stage-scroll", "overflow-x", "auto", false, "only the cutaway scrolls, not the whole app"],
];

for (const [pkg, selector, property, value, narrow, why] of EXPECTED) {
  test(`${pkg}: ${selector} { ${property}: ${value} }${narrow ? " on a narrow screen" : ""}, because ${why}`, () => {
    const css = fs.readFileSync(path.join(PACKAGES, pkg, "style.css"), "utf8");
    assert.ok(valuesOf(css, selector, property, narrow).includes(value), `${pkg}/style.css: ${selector} has ${property}: ${value}${narrow ? " in a media query covering 320 px" : ""}`);
  });
}

test("xla-fusion-explorer: the race stage switches to one column above the width its two columns need", () => {
  const css = fs.readFileSync(path.join(PACKAGES, "xla-fusion-explorer", "style.css"), "utf8");
  const widths = rules(css).filter((r) => r.selectors.includes(".race-stage") && r.declarations["grid-template-columns"] === "1fr").map((r) => r.maxWidth);
  assert.ok(widths.some((w) => w >= 860), `a max-width of at least 860 px, found ${widths.join(", ")}`);
});

test("tpu-vm-anatomy: #app no longer scrolls sideways", () => {
  const css = fs.readFileSync(path.join(PACKAGES, "tpu-vm-anatomy", "style.css"), "utf8");
  assert.deepEqual(rules(css).filter((r) => r.selectors.includes("#app")).flatMap((r) => Object.keys(r.declarations).filter((k) => k.startsWith("overflow"))), []);
});

test("the parser reads rules inside and outside media queries, and their declarations", () => {
  const css = `/* a { x: 1 } */ .a, .b > c { min-width: 0; grid-template-columns: repeat(4, 1fr) }
    @media (max-width: 400px) { .a { flex-wrap: wrap; } .c:focus-visible ~ .d { outline: 2px solid var(--p); } }
    @media (prefers-reduced-motion: reduce) { .a { transition: none } }`;
  assert.deepEqual(rules(css), [
    { selectors: [".a", ".b > c"], declarations: { "min-width": "0", "grid-template-columns": "repeat(4, 1fr)" }, maxWidth: null },
    { selectors: [".a"], declarations: { "flex-wrap": "wrap" }, maxWidth: 400 },
    { selectors: [".c:focus-visible ~ .d"], declarations: { outline: "2px solid var(--p)" }, maxWidth: 400 },
    { selectors: [".a"], declarations: { transition: "none" }, maxWidth: null },
  ]);
  assert.deepEqual(valuesOf(css, ".a", "flex-wrap", true), ["wrap"]);
  assert.deepEqual(valuesOf(css, ".a", "flex-wrap", false), []);
});
