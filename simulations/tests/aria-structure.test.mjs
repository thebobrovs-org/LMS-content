// LMS-content#98: the ARIA structure the simulations write is one assistive technology can
// follow. A `tablist` needs `tab` children and arrow-key handling, so a step list that is
// really a row of buttons is a `<nav aria-label>` of plain buttons with `aria-current="step"`
// on the current one; and an element announced as a button never contains another focusable
// element (WCAG 4.1.2). The check is static, over each package's index.html and main.js
// (the markup sims write with innerHTML lives in template strings there), and looks at each
// container on its own. The behaviour (aria-current moving, keys reaching the right part) is
// steps-and-parts.test.mjs. Run by `npm run gate`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const PACKAGES = path.join(path.dirname(fileURLToPath(import.meta.url)), "../packages");

/** Every opening tag matching `tagFilter`, with the markup up to its matching close. */
export function elements(source, tagFilter) {
  const out = [];
  for (const m of source.matchAll(/<(\w+)\b([^>]*)>/g)) {
    if (m[0].endsWith("/>") || !tagFilter(m[1], m[2])) continue;
    const tag = m[1];
    let depth = 1;
    const i = m.index + m[0].length;
    const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "g");
    re.lastIndex = i;
    let end = -1;
    for (let t = re.exec(source); t; t = re.exec(source)) {
      if (t[0].endsWith("/>")) continue;
      depth += t[1] ? -1 : 1;
      if (depth === 0) { end = t.index; break; }
    }
    out.push({ tag, open: m[0], attrs: m[2], inner: end < 0 ? "" : source.slice(i, end), line: source.slice(0, m.index).split("\n").length });
  }
  return out;
}

const hasRole = (attrs, role) => new RegExp(`\\brole=["']${role}["']`).test(attrs);

/** Each `role="tablist"` element that has no `role="tab"` inside it. */
export function tablistsWithoutTabs(source) {
  return elements(source, (_t, a) => hasRole(a, "tablist")).filter((e) => !/\brole=["']tab["']/.test(e.inner));
}

/** Each step container (`class="steps-nav …"`) that is not a `<nav>` with a non-empty accessible name. */
export function stepListsNotNamedNavs(source) {
  return elements(source, (_t, a) => /\bclass=["']steps-nav\b/.test(a)).filter((e) => e.tag !== "nav" || !/\baria-label=["'][^"']+["']/.test(e.attrs));
}

/** Each `role="button"` element that contains a focusable element. */
export function buttonsWithFocusableChildren(source) {
  return elements(source, (_t, a) => hasRole(a, "button")).filter((e) => /\btabindex=["']-?\d+["']|<(a|button|input|select|textarea)\b/.test(e.inner));
}

const describe = (file, list) => list.map((e) => `${file}:${e.line} ${e.open.slice(0, 80)}`);

for (const name of fs.readdirSync(PACKAGES).sort()) {
  const dir = path.join(PACKAGES, name);
  if (!fs.statSync(dir).isDirectory()) continue;
  const sources = ["index.html", "main.js"].filter((f) => fs.existsSync(path.join(dir, f))).map((f) => [f, fs.readFileSync(path.join(dir, f), "utf8")]);

  test(`${name}: every tablist has tab children, and every step list is a named nav of plain buttons`, () => {
    assert.deepEqual(sources.flatMap(([f, s]) => describe(f, tablistsWithoutTabs(s))), [], "a tablist without a tab inside it");
    assert.deepEqual(sources.flatMap(([f, s]) => describe(f, stepListsNotNamedNavs(s))), [], "a steps-nav that is not <nav aria-label=…>");
  });

  test(`${name}: no element announced as a button contains a focusable element`, () => {
    assert.deepEqual(sources.flatMap(([f, s]) => describe(f, buttonsWithFocusableChildren(s))), []);
  });
}

test("the checks look at each container on its own", () => {
  // A valid tablist beside a broken one: the broken one is reported.
  const tablists = `<div role="tablist"><button role="tab">A</button></div><div role="tablist"><button>B</button></div>`;
  assert.deepEqual(tablistsWithoutTabs(tablists).map((e) => e.line), [1]);
  assert.equal(tablistsWithoutTabs(tablists)[0].inner, "<button>B</button>");
  // A named nav beside a div with the same class, and a nav with an empty name: both reported.
  const steps = `<nav class="steps-nav" aria-label="Steps"><button>1</button></nav>\n<div class="steps-nav"><button>1</button></div>\n<nav class="steps-nav" aria-label=""><button>1</button></nav>`;
  assert.deepEqual(stepListsNotNamedNavs(steps).map((e) => e.line), [2, 3]);
  // A focusable child inside a button is reported; the same children under a group are not.
  const nested = `<div role="button" tabindex="0"><div class="l">A</div><div role="button" tabindex="0">B</div></div>`;
  assert.equal(buttonsWithFocusableChildren(nested).length, 1);
  const flat = `<div role="group"><div role="button" tabindex="0">A</div><div role="button" tabindex="0">B</div></div>`;
  assert.equal(buttonsWithFocusableChildren(flat).length, 0);
});
