// LMS-content#126: a panel of text that scrolls can be reached and scrolled by keyboard (WCAG 2.1.1).
// A code overlay or an event log holds no control, so unless it is focusable a keyboard user can't
// scroll what doesn't fit (axe `scrollable-region-focusable`). Every element a package's style.css
// lets scroll (`overflow`, `overflow-x` or `overflow-y` of `auto` or `scroll`) is classified here:
// a TEXT_REGION must be `tabindex="0"` with a role (`region` or `log`) and a name wherever the
// package writes it; a WIDTH_GUARD is a wrapper that only scrolls when a drawing is wider than a
// narrow screen. A scrolling rule is classified by the class or id of the element it applies to (its
// last compound selector, whatever other classes, states or attributes qualify it: `.panel.active` and
// `.panel:hover` are `.panel`); a new one fails until it is classified, and one with no class or id to
// classify it by (`pre { overflow: auto }`) fails outright (LMS-content#128). The check is static, over
// style.css and the markup in index.html and main.js. Run by `npm run gate`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const PACKAGES = path.join(path.dirname(fileURLToPath(import.meta.url)), "../packages");

/** Scrolling panels of text: each must be a focusable, named region. */
const TEXT_REGIONS = {
  "capacity-constraint-explorer": [".code"],
  "capacity-orchestrator": [".event-log"],
  "image-tensor-explorer": [".code-overlay"],
  "systolic-array": [".console-log"],
  "training-loop-explorer": [".code-overlay"],
  "xla-fusion-explorer": [".inspector-code"],
};
/** Wrappers that scroll only when their drawing is wider than the screen. */
const WIDTH_GUARDS = {
  "backprop-explorer": [".diagram"],
  "neuron-explorer": [".diagram"],
  "systolic-array": [".grid-panel"],
  "tpu-ocs-explorer": [".canvas-wrap"],
  "tpu-vm-anatomy": ["#app"],
  "xla-fusion-explorer": [".compile-stage"],
};

/** A selector list split at its top-level commas, never inside brackets, parentheses or quotes. */
function selectorList(text) {
  const out = [];
  let depth = 0;
  let quote = null;
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === "," && depth === 0) { out.push(text.slice(from, i)); from = i + 1; }
  }
  out.push(text.slice(from));
  return out.map((x) => x.trim().replace(/\s+/g, " ")).filter(Boolean);
}

/** The class and id names of a selector's last compound selector, the element its declarations apply to. */
function subjectNames(selector) {
  let flat = selector.replace(/"[^"]*"|'[^']*'/g, "");
  for (let before = null; before !== flat; ) {
    before = flat;
    flat = flat.replace(/\[[^[\]]*\]|\([^()]*\)/g, ""); // attribute selectors and :is(), :not() arguments
  }
  const last = flat.trim().split(/\s*[>+~]\s*|\s+/).pop() ?? "";
  return [...last.replace(/::?[\w-]+/g, "").matchAll(/[.#][\w-]+/g)].map((m) => m[0]);
}

/** Each rule a stylesheet lets scroll (overflow of auto or scroll): its selector and the class and id names it can be classified by. */
export function scrollingSelectors(css) {
  const out = new Map();
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/(?:^|;)\s*overflow(?:-x|-y)?\s*:\s*(?:auto|scroll)\b/.test(m[2])) continue;
    for (const rule of selectorList(m[1])) out.set(rule, { rule, names: subjectNames(rule) });
  }
  return [...out.values()].sort((a, b) => (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0));
}

/** The scrolling rules none of whose names is classified, and those with no name to classify them by. */
export function unclassified(scrolling, classified) {
  return scrolling
    .filter((s) => !s.names.some((n) => classified.includes(n)))
    .map((s) => (s.names.length ? s.rule : `${s.rule} (no class or id to classify it by)`));
}

/** Every opening tag in `source` that `selector` (`.class` or `#id`) matches, with its line. */
export function tagsMatching(source, selector) {
  const name = selector.slice(1);
  const attr = selector[0] === "." ? new RegExp(`\\bclass=["'](?:[^"']*\\s)?${name}(?:\\s[^"']*)?["']`) : new RegExp(`\\bid=["']${name}["']`);
  const out = [];
  for (const m of source.matchAll(/<\w+\b[^>]*>/g)) if (attr.test(m[0])) out.push({ open: m[0], line: source.slice(0, m.index).split("\n").length });
  return out;
}

/** What a scrolling text panel's opening tag lacks to be reached and named. */
export function regionProblems(open) {
  const out = [];
  if (!/\btabindex=["']0["']/.test(open)) out.push('tabindex="0"');
  if (!/\brole=["'](?:region|log)["']/.test(open)) out.push('role="region" (or "log")');
  if (!/\baria-label=["'][^"']+["']|\baria-labelledby=["'][^"']+["']/.test(open)) out.push("a name (aria-label or aria-labelledby)");
  return out;
}

for (const name of fs.readdirSync(PACKAGES).sort()) {
  const dir = path.join(PACKAGES, name);
  if (!fs.existsSync(path.join(dir, "style.css"))) continue;
  test(`${name}: every scrolling panel of text is reached by Tab and named`, () => {
    const scrolling = scrollingSelectors(fs.readFileSync(path.join(dir, "style.css"), "utf8"));
    const regions = TEXT_REGIONS[name] ?? [];
    const guards = WIDTH_GUARDS[name] ?? [];
    assert.deepEqual(unclassified(scrolling, [...regions, ...guards]), [], "each scrolling rule's element is listed as a TEXT_REGION or a WIDTH_GUARD in this test");
    const sources = ["index.html", "main.js"].filter((f) => fs.existsSync(path.join(dir, f))).map((f) => [f, fs.readFileSync(path.join(dir, f), "utf8")]);
    for (const selector of regions) {
      const found = sources.flatMap(([file, src]) => tagsMatching(src, selector).map((t) => ({ ...t, file })));
      assert.ok(found.length > 0, `${selector} is written somewhere in index.html or main.js`);
      const short = found.map((t) => [t, regionProblems(t.open)]).filter(([, p]) => p.length).map(([t, p]) => `${t.file}:${t.line} ${t.open.slice(0, 80)} lacks ${p.join(", ")}`);
      assert.deepEqual(short, [], selector);
    }
  });
}

test("the check finds scrolling selectors, matches their tags, and names what a panel lacks", () => {
  const css = `.a { overflow: hidden; } /* .z { overflow: auto } */ .panel .log, #out { color: red; overflow-y: auto; } .wide{overflow-x:scroll}
    @media (max-width: 600px) { .b:hover { overflow: auto; } }
    .panel.active, .panel.active > .feed[data-x="a,b"] { overflow: auto } pre { overflow: auto } :is(.p, .q) .r:not(.s) { overflow: scroll }`;
  assert.deepEqual(scrollingSelectors(css), [
    { rule: "#out", names: ["#out"] },
    { rule: ".b:hover", names: [".b"] },
    { rule: ".panel .log", names: [".log"] },
    { rule: ".panel.active", names: [".panel", ".active"] },
    { rule: '.panel.active > .feed[data-x="a,b"]', names: [".feed"] },
    { rule: ".wide", names: [".wide"] },
    { rule: ":is(.p, .q) .r:not(.s)", names: [".r"] },
    { rule: "pre", names: [] },
  ]);
  // A compound or state selector is unclassified until its element is; a rule with no class or id always is.
  assert.deepEqual(unclassified(scrollingSelectors(css), ["#out", ".log", ".wide", ".feed", ".r"]), [".b:hover", ".panel.active", "pre (no class or id to classify it by)"]);
  assert.deepEqual(unclassified(scrollingSelectors(css), ["#out", ".log", ".wide", ".feed", ".r", ".b", ".panel"]), ["pre (no class or id to classify it by)"]);
  const html = `<div class="x log mono" id="log">\n<pre id="out" tabindex="0" role="region" aria-label="Output"></pre><div class="logger">`;
  assert.deepEqual(tagsMatching(html, ".log").map((t) => t.line), [1]);
  assert.deepEqual(tagsMatching(html, "#out").map((t) => t.line), [2]);
  assert.deepEqual(regionProblems(tagsMatching(html, ".log")[0].open), ['tabindex="0"', 'role="region" (or "log")', "a name (aria-label or aria-labelledby)"]);
  assert.deepEqual(regionProblems(tagsMatching(html, "#out")[0].open), []);
  assert.deepEqual(regionProblems(`<div role="log" tabindex="0" aria-labelledby="h">`), []);
});

test("regionProblems flags tabindex -1, empty aria-label, missing roles, and accepts single quotes and reordered attributes", () => {
  // tabindex="-1" cannot be reached by Tab navigation
  assert.deepEqual(
    regionProblems('<div tabindex="-1" role="region" aria-label="Output">'),
    ['tabindex="0"']
  );
  // Empty aria-label provides no accessible name
  assert.deepEqual(
    regionProblems('<div tabindex="0" role="region" aria-label="">'),
    ["a name (aria-label or aria-labelledby)"]
  );
  // Missing role
  assert.deepEqual(
    regionProblems('<div tabindex="0" aria-label="Output">'),
    ['role="region" (or "log")']
  );
  // Missing tabindex
  assert.deepEqual(
    regionProblems('<div role="region" aria-label="Output">'),
    ['tabindex="0"']
  );
  // Bare element missing all three
  assert.deepEqual(
    regionProblems('<div class="panel">'),
    ['tabindex="0"', 'role="region" (or "log")', "a name (aria-label or aria-labelledby)"]
  );
  // Single-quoted attributes and reordered attributes
  assert.deepEqual(
    regionProblems("<pre aria-label='Output log' role='region' tabindex='0'>"),
    []
  );
});
