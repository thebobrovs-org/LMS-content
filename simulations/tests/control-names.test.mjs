// LMS-content#97: every form control a simulation renders has an accessible name, so a screen
// reader never announces a bare "slider" or "combo box". A control is named when its tag carries
// aria-label or aria-labelledby, when a <label for="its id"> exists in the same package, or when
// it is written inside a <label>…</label>. The check is static: it reads every `<input`, `<select`
// and `<textarea` tag in each package's index.html and main.js (the markup sims write with
// innerHTML lives in template strings there). Run by `npm run gate`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const PACKAGES = path.join(path.dirname(fileURLToPath(import.meta.url)), "../packages");

/** Every control tag in a source text, with what it needs to be named. */
export function controls(source) {
  const out = [];
  for (const m of source.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
    const attrs = m[2];
    if (/\btype=["']hidden["']/.test(attrs)) continue;
    const id = attrs.match(/\bid=["']([^"']+)["']/)?.[1] ?? null;
    const before = source.slice(0, m.index);
    const wrapped = before.lastIndexOf("<label") > before.lastIndexOf("</label>");
    out.push({ tag: m[1], id, attrs, wrapped, aria: /\baria-label(ledby)?=/.test(attrs), line: before.split("\n").length });
  }
  return out;
}

/** The ids every `<label for>` in a source text points at (a template id keeps its `${…}`). */
export function labelledIds(source) {
  return new Set([...source.matchAll(/<label\b[^>]*\bfor=["']([^"']+)["']/g)].map((m) => m[1]));
}

for (const name of fs.readdirSync(PACKAGES).sort()) {
  const dir = path.join(PACKAGES, name);
  if (!fs.statSync(dir).isDirectory()) continue;
  test(`${name}: every input and select has an accessible name`, () => {
    const sources = ["index.html", "main.js"].filter((f) => fs.existsSync(path.join(dir, f))).map((f) => [f, fs.readFileSync(path.join(dir, f), "utf8")]);
    const labelled = new Set(sources.flatMap(([, s]) => [...labelledIds(s)]));
    const unnamed = [];
    for (const [file, source] of sources) {
      for (const c of controls(source)) {
        if (c.aria || c.wrapped || (c.id && labelled.has(c.id))) continue;
        unnamed.push(`${file}:${c.line} <${c.tag}${c.id ? ` id="${c.id}"` : ""}>`);
      }
    }
    assert.deepEqual(unnamed, [], "controls with no <label for>, wrapping <label>, aria-label or aria-labelledby");
  });
}

test("the check sees the three ways a control is named, and an unnamed one", () => {
  const src = `<label for="a">A</label><input id="a">
<label>B <input id="b"></label>
<select id="c" aria-label="C"></select>
<input id="d">
<input type="hidden" id="e">`;
  const named = controls(src).filter((c) => c.aria || c.wrapped || labelledIds(src).has(c.id)).map((c) => c.id);
  assert.deepEqual(named, ["a", "b", "c"]);
  assert.deepEqual(controls(src).map((c) => c.id), ["a", "b", "c", "d"]);
});
