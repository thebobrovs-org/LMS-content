// LMS-content#130: at 320 CSS px (WCAG 1.4.10), and in a lesson's 286 px frame, these simulations scrolled sideways.
// Measured in a browser at every width from 280 to 1280 px, they now fit; this check keeps the rules that make them fit
// from being dropped or overridden. It is static, over each package's style.css: at each width a row names, the
// declaration of the property that wins for that selector (the last one, in source order, among the rules for that
// selector whose media query matches the width) must be the value the row names. Run by `npm run gate`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const PACKAGES = path.join(path.dirname(fileURLToPath(import.meta.url)), "../packages");

/**
 * Each style rule in `css`, in source order: its selectors, its declarations, and the `max-width` and `min-width` of the
 * media query it sits in (null when there is none; a query on something else, such as reduced motion, has neither, so
 * its rules count as matching every width).
 */
export function rules(css) {
  const out = [];
  const block = (body, media) => {
    for (let i = 0; i < body.length; ) {
      const open = body.indexOf("{", i);
      if (open < 0) break;
      const head = body.slice(i, open).trim();
      let depth = 1;
      let close = open + 1;
      for (; close < body.length && depth; close++) depth += body[close] === "{" ? 1 : body[close] === "}" ? -1 : 0;
      const inner = body.slice(open + 1, close - 1);
      if (head.startsWith("@media")) {
        const max = head.match(/max-width:\s*(\d+)px/);
        const min = head.match(/min-width:\s*(\d+)px/);
        block(inner, { maxWidth: max ? Number(max[1]) : null, minWidth: min ? Number(min[1]) : null });
      } else if (!head.startsWith("@")) {
        const declarations = Object.fromEntries(inner.split(";").map((d) => d.split(/:(.*)/s).map((x) => x?.trim())).filter(([k, v]) => k && v).map(([k, v]) => [k, v.replace(/\s+/g, " ")]));
        out.push({ selectors: head.split(",").map((s) => s.trim().replace(/\s+/g, " ")), declarations, ...media });
      }
      i = close;
    }
  };
  block(css.replace(/\/\*[\s\S]*?\*\//g, ""), { maxWidth: null, minWidth: null });
  return out;
}

/** The value of `property` that wins for `selector` at a viewport `width`: the last declaration among its matching rules. */
export function winning(css, selector, property, width) {
  const matching = rules(css).filter((r) => r.selectors.includes(selector) && r.declarations[property] !== undefined && (r.maxWidth === null || width <= r.maxWidth) && (r.minWidth === null || width >= r.minWidth));
  return matching.at(-1)?.declarations[property];
}

/** The rows of `expected` for `pkg` whose value doesn't win in `css`, as "selector property at width: found". */
export function failures(css, expected) {
  return expected.flatMap(([, selector, property, value, widths]) => widths.filter((w) => winning(css, selector, property, w) !== value).map((w) => `${selector} ${property} at ${w} px: ${winning(css, selector, property, w) ?? "not declared"}`));
}

const NARROW = [286, 320]; // a lesson's frame, and the page at 320 px

// [package, selector, property, value, widths, why]
const EXPECTED = [
  ["capacity-constraint-explorer", ".panel", "min-width", "0", NARROW, "a grid item is otherwise as wide as its widest line of code"],
  ["gradient-sync-explorer", ".controls", "grid-template-columns", "1fr", NARROW, "two columns of controls overflow a 286 px frame"],
  ["gradient-sync-explorer", ".sw input:focus-visible ~ .tr", "outline", "2px solid var(--primary)", NARROW, "the switch's input is invisible, so its focus ring is drawn on the track"],
  ["gradient-sync-explorer", ".sw input", "z-index", "1", NARROW, "the focused switch input is above the track and the knob that would cover it"],
  ["tpu-evolution-timeline", ".timeline-track", "display", "grid", NARROW, "eight generations in one row overflow a 286 px frame"],
  ["tpu-evolution-timeline", ".timeline-track", "grid-template-columns", "repeat(4, 1fr)", NARROW, "two rows of four"],
  ["tpu-evolution-timeline", ".timeline-line", "display", "none", NARROW, "the connecting line belongs to one row"],
  ["hash-collision", ".controls", "flex-wrap", "wrap", NARROW, "the buttons wrap below the key field"],
  ["hash-collision", "input", "min-width", "0", NARROW, "the key field shrinks to share the row"],
  ["hash-collision", "input", "flex", "1 1 12rem", NARROW, "the key field basis allows wrapping below 12rem"],
  ["lru-cache", ".controls", "flex-wrap", "wrap", NARROW, "the buttons wrap below the key field"],
  ["lru-cache", "input", "min-width", "0", NARROW, "the key field shrinks to share the row"],
  ["lru-cache", "input", "flex", "1 1 12rem", NARROW, "the key field basis allows wrapping below 12rem"],
  ["xla-fusion-explorer", ".compile-stage", "flex-direction", "column", [286, 320, 700, 760], "the four compile stages in a row need about 680 px"],
  ["xla-fusion-explorer", ".c-node", "min-width", "0", [286, 320, 700, 760], "a stacked stage is as wide as the column"],
  ["xla-fusion-explorer", ".race-stage", "grid-template-columns", "1fr", [286, 320, 770, 860, 880], "two race columns need about 860 px"],
  ["xla-fusion-explorer", ".race-stage", "grid-template-columns", "1fr 1fr", [1280], "the race columns stay side by side on a wide screen"],
  // The race column: four ops in a row with a connector between each, and a memory lane under each op.
  ["xla-fusion-explorer", "#app", "padding", "12px", NARROW, "the page's padding"],
  ["xla-fusion-explorer", ".race-col", "padding", "12px", NARROW, "the race column's padding"],
  ["xla-fusion-explorer", ".chip-boundary", "padding", "22px 3px 10px", NARROW, "the chip boundary's padding"],
  ["xla-fusion-explorer", ".connector", "width", "10px", NARROW, "the gap between two ops"],
  ["xla-fusion-explorer", ".hbm-gap", "width", "10px", NARROW, "the gap between two lanes, as wide as the one between the ops"],
  ["xla-fusion-explorer", ".arrow", "font-size", "11px", NARROW, "the arrow in that gap"],
  ["xla-fusion-explorer", ".op", "font-size", "11px", NARROW, "an op's name"],
  ["xla-fusion-explorer", ".op", "padding", "10px 1px", NARROW, "an op's padding"],
  ["xla-fusion-explorer", ".mem", "font-size", "8px", NARROW, "the memory badge under an op, which doesn't wrap"],
  ["xla-fusion-explorer", ".mem", "padding", "2px 4px", NARROW, "the memory badge's padding"],
  ["xla-fusion-explorer", ".hbm-lanes", "padding", "0 5px", NARROW, "the lanes line up under the ops"],
  ["xla-fusion-explorer", ".hbm-lane-wrap", "width", "auto", NARROW, "a lane isn't a fixed 76 px"],
  ["xla-fusion-explorer", ".hbm-lane-wrap", "flex", "1", NARROW, "each lane shares the width of the op above it"],
  ["tpu-vm-anatomy", ".stage-scroll", "overflow-x", "auto", NARROW, "only the cutaway scrolls, not the whole app"],
  ["tpu-vm-anatomy", ".stage-scroll", "scroll-padding-inline", "8px", NARROW, "a part scrolled into view keeps its focus ring inside the cutaway"],
];

const cssOf = (pkg) => fs.readFileSync(path.join(PACKAGES, pkg, "style.css"), "utf8");

for (const row of EXPECTED) {
  const [pkg, selector, property, value, widths, why] = row;
  test(`${pkg}: ${selector} { ${property}: ${value} } wins at ${widths.join(", ")} px, because ${why}`, () => {
    assert.deepEqual(failures(cssOf(pkg), [row]), []);
  });
}

test("tpu-vm-anatomy: #app doesn't scroll sideways at any width", () => {
  const css = cssOf("tpu-vm-anatomy");
  for (const w of [286, 320, 600, 1280]) for (const p of ["overflow", "overflow-x"]) assert.equal(winning(css, "#app", p, w), undefined, `#app ${p} at ${w} px`);
});

test("the parser reads rules inside and outside media queries, and their declarations", () => {
  const css = `/* a { x: 1 } */ .a, .b > c { min-width: 0; grid-template-columns: repeat(4, 1fr) }
    @media (max-width: 400px) { .a { flex-wrap: wrap; } .c:focus-visible ~ .d { outline: 2px solid var(--p); } }
    @media (min-width: 900px) { .a { flex-wrap: nowrap } }
    @media (prefers-reduced-motion: reduce) { .a { transition: none } }`;
  assert.deepEqual(rules(css), [
    { selectors: [".a", ".b > c"], declarations: { "min-width": "0", "grid-template-columns": "repeat(4, 1fr)" }, maxWidth: null, minWidth: null },
    { selectors: [".a"], declarations: { "flex-wrap": "wrap" }, maxWidth: 400, minWidth: null },
    { selectors: [".c:focus-visible ~ .d"], declarations: { outline: "2px solid var(--p)" }, maxWidth: 400, minWidth: null },
    { selectors: [".a"], declarations: { "flex-wrap": "nowrap" }, maxWidth: null, minWidth: 900 },
    { selectors: [".a"], declarations: { transition: "none" }, maxWidth: null, minWidth: null },
  ]);
  assert.equal(winning(css, ".a", "flex-wrap", 320), "wrap");
  assert.equal(winning(css, ".a", "flex-wrap", 600), undefined);
  assert.equal(winning(css, ".a", "flex-wrap", 1000), "nowrap");
});

test("a required declaration overridden later, or a narrow-screen block removed, fails the check", () => {
  // Overridden later in the stylesheet, at the widths the row names.
  const overridden = `.a { min-width: 0 } @media (max-width: 400px) { .a { min-width: 20px } }`;
  assert.deepEqual(failures(overridden, [["x", ".a", "min-width", "0", NARROW]]), [".a min-width at 286 px: 20px", ".a min-width at 320 px: 20px"]);
  assert.deepEqual(failures(overridden, [["x", ".a", "min-width", "0", [600]]]), []);
  // The real xla stylesheet with a later rule that makes the ops large again.
  const xla = cssOf("xla-fusion-explorer");
  const race = EXPECTED.filter(([pkg, selector]) => pkg === "xla-fusion-explorer" && [".op", ".connector", ".chip-boundary"].includes(selector));
  assert.deepEqual(failures(xla, race), []);
  assert.deepEqual(failures(`${xla}\n@media (max-width: 480px) { .op { font-size: 13px; padding: 12px 4px; } }`, race), [".op font-size at 286 px: 13px", ".op font-size at 320 px: 13px", ".op padding at 286 px: 12px 4px", ".op padding at 320 px: 12px 4px"]);
  // The real xla stylesheet without its narrow race-column block: every sizing row fails.
  const start = xla.indexOf("@media (max-width: 480px)");
  assert.ok(start > 0, "xla-fusion-explorer has the narrow race-column block");
  let depth = 0;
  let end = xla.indexOf("{", start);
  do depth += xla[end] === "{" ? 1 : xla[end] === "}" ? -1 : 0; while (depth && ++end < xla.length);
  const withoutBlock = xla.slice(0, start) + xla.slice(end + 1);
  const sizing = EXPECTED.filter(([pkg, , , , widths]) => pkg === "xla-fusion-explorer" && widths === NARROW);
  const failed = new Set(failures(withoutBlock, sizing).map((f) => f.split(" at ")[0]));
  assert.equal(failed.size, sizing.length, `every sizing row fails without the block; passing: ${sizing.map(([, s, p]) => `${s} ${p}`).filter((k) => !failed.has(k)).join(", ")}`);
});
