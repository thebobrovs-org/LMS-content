// LMS-content#126: a panel of text that scrolls can be reached and scrolled by keyboard (WCAG 2.1.1).
// A code overlay or an event log holds no control, so unless it is focusable a keyboard user can't
// scroll what doesn't fit (axe `scrollable-region-focusable`). Every element a package's style.css
// lets scroll (`overflow`, `overflow-x` or `overflow-y` of `auto` or `scroll`) is classified here:
// a TEXT_REGION is a panel of text, a WIDTH_GUARD a wrapper that only scrolls when a drawing is wider
// than a narrow screen (at 320 px they do, LMS-content#130). Each must be `tabindex="0"` with a role
// (`region` or `log`) and a name wherever the package writes it. A scrolling rule is classified by the class or id of the element it applies to (its
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
/** Wrappers that scroll only when their drawing is wider than the screen: each is a focusable, named region too. */
const WIDTH_GUARDS = {
  "backprop-explorer": [".diagram"],
  "neuron-explorer": [".diagram"],
  "systolic-array": [".grid-panel"],
  "tpu-ocs-explorer": [".canvas-wrap"],
  "tpu-vm-anatomy": [".stage-scroll"],
};

/** The index just past the quoted string that starts at `i`, a backslash escaping the character after it. */
function pastString(text, i) {
  for (let j = i + 1; j < text.length; j++) {
    if (text[j] === "\\") j++;
    else if (text[j] === text[i]) return j + 1;
  }
  return text.length;
}

/** The index just past the bracketed or parenthesised group that starts at `i`, strings and escapes inside it included. */
function pastGroup(text, i) {
  let depth = 0;
  for (let j = i; j < text.length; j++) {
    const c = text[j];
    if (c === "\\") j++;
    else if (c === '"' || c === "'") j = pastString(text, j) - 1;
    else if (c === "(" || c === "[") depth++;
    else if ((c === ")" || c === "]") && --depth === 0) return j + 1;
  }
  return text.length;
}

/** `text` split at each character `at` accepts, never inside a string, a group or an escape. */
function splitTopLevel(text, at) {
  const parts = [];
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\\") i++;
    else if (c === '"' || c === "'") i = pastString(text, i) - 1;
    else if (c === "(" || c === "[") i = pastGroup(text, i) - 1;
    else if (at(c)) {
      parts.push(text.slice(from, i));
      from = i + 1;
    }
  }
  parts.push(text.slice(from));
  return parts.map((x) => x.trim()).filter(Boolean);
}

/**
 * The class and id names of a selector's subject: its last compound selector, found before anything inside
 * it is set aside, so `.panel [data-scroll]` has none. Pseudo-classes and their arguments and attribute
 * selectors are skipped. null when a class or id name is one this check cannot read in full (an escape or a
 * non-ASCII character), so that `.panel\:active` or `.panelé` never passes as `.panel`.
 */
function subjectNames(selector) {
  const subject = splitTopLevel(selector, (c) => /[\s>+~]/.test(c)).pop() ?? "";
  const names = [];
  for (let i = 0; i < subject.length; ) {
    const c = subject[i];
    if (c === "[" || c === "(") {
      i = pastGroup(subject, i);
    } else if (c === '"' || c === "'") {
      i = pastString(subject, i);
    } else if (c === "." || c === "#" || c === ":") {
      let j = i + 1 + (c === ":" && subject[i + 1] === ":" ? 1 : 0);
      const start = j;
      while (j < subject.length && (/[\w-]/.test(subject[j]) || subject[j] === "\\" || subject.charCodeAt(j) > 0x7f)) j += subject[j] === "\\" ? 2 : 1;
      if (c !== ":") {
        const name = subject.slice(start, j);
        if (!/^(?:--|-?[A-Za-z_])[\w-]*$/.test(name)) return null;
        names.push(c + name);
      }
      i = j;
    } else {
      i++;
    }
  }
  return names;
}

/**
 * Each rule a stylesheet lets scroll (overflow of auto or scroll): its selector, the class and id names it can
 * be classified by, and whether they could be read.
 */
export function scrollingSelectors(css) {
  const out = new Map();
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/(?:^|;)\s*overflow(?:-x|-y)?\s*:\s*(?:auto|scroll)\b/.test(m[2])) continue;
    for (const rule of splitTopLevel(m[1], (c) => c === ",").map((r) => r.replace(/\s+/g, " "))) {
      const names = subjectNames(rule);
      out.set(rule, { rule, names: names ?? [], readable: names !== null });
    }
  }
  return [...out.values()].sort((a, b) => (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0));
}

/** The scrolling rules none of whose names is classified: those with a name to classify them by, and those without one. */
export function unclassified(scrolling, classified) {
  return scrolling
    .filter((s) => !s.readable || !s.names.some((n) => classified.includes(n)))
    .map((s) => (!s.readable ? `${s.rule} (a class or id name this check cannot read)` : s.names.length ? s.rule : `${s.rule} (no class or id to classify it by)`));
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
  test(`${name}: every scrolling panel of text or drawing is reached by Tab and named`, () => {
    const scrolling = scrollingSelectors(fs.readFileSync(path.join(dir, "style.css"), "utf8"));
    const regions = TEXT_REGIONS[name] ?? [];
    const guards = WIDTH_GUARDS[name] ?? [];
    assert.deepEqual(unclassified(scrolling, [...regions, ...guards]), [], "each scrolling rule's element is listed as a TEXT_REGION or a WIDTH_GUARD in this test");
    const sources = ["index.html", "main.js"].filter((f) => fs.existsSync(path.join(dir, f))).map((f) => [f, fs.readFileSync(path.join(dir, f), "utf8")]);
    for (const selector of [...regions, ...guards]) {
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
    { rule: "#out", names: ["#out"], readable: true },
    { rule: ".b:hover", names: [".b"], readable: true },
    { rule: ".panel .log", names: [".log"], readable: true },
    { rule: ".panel.active", names: [".panel", ".active"], readable: true },
    { rule: '.panel.active > .feed[data-x="a,b"]', names: [".feed"], readable: true },
    { rule: ".wide", names: [".wide"], readable: true },
    { rule: ":is(.p, .q) .r:not(.s)", names: [".r"], readable: true },
    { rule: "pre", names: [], readable: true },
  ]);
  // A compound or state selector is unclassified until its element is; a rule with no class or id always is.
  assert.deepEqual(unclassified(scrollingSelectors(css), ["#out", ".log", ".wide", ".feed", ".r"]), [".b:hover", ".panel.active", "pre (no class or id to classify it by)"]);
  assert.deepEqual(unclassified(scrollingSelectors(css), ["#out", ".log", ".wide", ".feed", ".r", ".b", ".panel"]), ["pre (no class or id to classify it by)"]);
});

test("a rule's subject is its last compound: an attribute-only descendant, an escaped quote, and a name the check cannot read never borrow another's classification (LMS-content#128)", () => {
  // The scrolling element is the [data-scroll] descendant, which has no class or id; its ancestor's being classified changes nothing.
  assert.deepEqual(unclassified(scrollingSelectors(".panel [data-scroll] { overflow: auto }"), [".panel"]), [".panel [data-scroll] (no class or id to classify it by)"]);
  assert.deepEqual(unclassified(scrollingSelectors(".panel > [data-scroll]:hover { overflow: auto }"), [".panel"]), [".panel > [data-scroll]:hover (no class or id to classify it by)"]);
  // An escaped quote inside an attribute value does not end the string, so the comma after it still splits the list.
  const escaped = scrollingSelectors('.unlisted[data-x="a\\"b"], .known { overflow: auto }');
  assert.deepEqual(escaped.map((s) => [s.rule, s.names]), [[".known", [".known"]], ['.unlisted[data-x="a\\"b"]', [".unlisted"]]]);
  assert.deepEqual(unclassified(escaped, [".known"]), ['.unlisted[data-x="a\\"b"]']);
  // A name with an escape or a non-ASCII character is read in full and refused, never cut down to a shorter classified one.
  const unreadable = scrollingSelectors(".panel\\:active { overflow: auto } .panelé { overflow: auto } .panel-x { overflow: auto }");
  assert.deepEqual(unclassified(unreadable, [".panel"]), [".panel-x", ".panel\\:active (a class or id name this check cannot read)", ".panelé (a class or id name this check cannot read)"]);
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
