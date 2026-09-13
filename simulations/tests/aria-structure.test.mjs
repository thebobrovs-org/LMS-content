// LMS-content#98: the ARIA structure the simulations write is one assistive technology can
// follow. A `tablist` needs `tab` children and arrow-key handling, so a step list that is
// really a row of buttons is a `<nav aria-label>` of plain buttons with `aria-current="step"`
// on the current one; and an element announced as a button never contains another focusable
// element (WCAG 4.1.2). The check is static, over each package's index.html and main.js
// (the markup sims write with innerHTML lives in template strings there). Run by `npm run gate`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const PACKAGES = path.join(path.dirname(fileURLToPath(import.meta.url)), "../packages");

/** Every `role="button"` opening tag whose element, up to its matching close, contains a focusable element. */
export function buttonsWithFocusableChildren(source) {
  const out = [];
  for (const m of source.matchAll(/<(\w+)\b[^>]*\brole=["']button["'][^>]*>/g)) {
    const tag = m[1];
    if (m[0].endsWith("/>")) continue;
    // Walk to the matching close of this element, counting same-tag opens and closes.
    let depth = 1;
    let i = m.index + m[0].length;
    const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "g");
    re.lastIndex = i;
    let end = -1;
    for (let t = re.exec(source); t; t = re.exec(source)) {
      if (t[0].endsWith("/>")) continue;
      depth += t[1] ? -1 : 1;
      if (depth === 0) { end = t.index; break; }
    }
    if (end < 0) continue;
    const inner = source.slice(i, end);
    if (/\btabindex=["']-?\d+["']|<(a|button|input|select|textarea)\b/.test(inner)) out.push({ line: source.slice(0, m.index).split("\n").length, tag: m[0].slice(0, 80) });
  }
  return out;
}

for (const name of fs.readdirSync(PACKAGES).sort()) {
  const dir = path.join(PACKAGES, name);
  if (!fs.statSync(dir).isDirectory()) continue;
  const sources = ["index.html", "main.js"].filter((f) => fs.existsSync(path.join(dir, f))).map((f) => [f, fs.readFileSync(path.join(dir, f), "utf8")]);

  test(`${name}: a tablist has tab children, else the steps are plain buttons in a named nav`, () => {
    for (const [file, source] of sources) {
      const tablists = [...source.matchAll(/\brole=["']tablist["']/g)].length;
      const tabs = [...source.matchAll(/\brole=["']tab["']/g)].length;
      assert.ok(tablists === 0 || tabs > 0, `${file}: role="tablist" without any role="tab" child`);
      if (/class=["']steps-nav\b/.test(source)) assert.match(source, /<nav class=["']steps-nav["'] aria-label=/, `${file}: the step list is a <nav aria-label>`);
    }
  });

  test(`${name}: no element announced as a button contains a focusable element`, () => {
    const nested = sources.flatMap(([file, source]) => buttonsWithFocusableChildren(source).map((b) => `${file}:${b.line} ${b.tag}`));
    assert.deepEqual(nested, []);
  });
}

test("the nesting check sees a focusable child and ignores siblings", () => {
  const nested = `<div role="button" tabindex="0"><div class="l">A</div><div role="button" tabindex="0">B</div></div>`;
  assert.equal(buttonsWithFocusableChildren(nested).length, 1);
  const flat = `<div role="group"><div role="button" tabindex="0">A</div><div role="button" tabindex="0">B</div></div>`;
  assert.equal(buttonsWithFocusableChildren(flat).length, 0);
});
