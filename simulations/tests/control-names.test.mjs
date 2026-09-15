// LMS-content#97: every form control a simulation renders has an accessible name, so a screen
// reader never announces a bare "slider" or "combo box". A control is named when its tag carries a
// non-empty aria-label, or an aria-labelledby whose every id is declared in the same package; when
// a <label for="its id"> exists in the same package; or when it is written inside a <label> that
// names it: the label's `for` is the control's id, or the label has no `for` and the control is its
// first labelable element (LMS-content#102). The check is static: it reads every `<input`,
// `<select` and `<textarea` tag in each package's index.html and main.js (the markup sims write
// with innerHTML lives in template strings there). Run by `npm run gate`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const PACKAGES = path.join(path.dirname(fileURLToPath(import.meta.url)), "../packages");

/** An `id` attribute, never the tail of `data-id` or another hyphenated name. */
const ID_ATTR = /(?<![\w-])id=["']([^"']+)["']/;
const isHidden = (attrs) => /\btype=["']hidden["']/.test(attrs);
/** The elements a <label> can name, as HTML defines them (an input of type hidden is not one). */
const LABELABLE = /<(button|input|meter|output|progress|select|textarea)\b([^>]*)>/g;

/**
 * Whether the <label> a control is written inside names it: the nearest label opened before the
 * control and not closed, whose `for`, when it has one, is the control's id, and otherwise of which
 * the control is the first labelable element (a second control inside one label is not named by it).
 */
function wrappingLabelNames(source, index, id) {
  const before = source.slice(0, index);
  const open = before.lastIndexOf("<label");
  if (open < 0 || open < before.lastIndexOf("</label>")) return false;
  const tag = /^<label\b([^>]*)>/.exec(source.slice(open));
  if (!tag) return false;
  // An explicit `for` names only the control with that id; an empty one names nothing (LMS-content#119).
  const forAttr = tag[1].match(/\bfor=["']([^"']*)["']/);
  if (forAttr) return forAttr[1] !== "" && forAttr[1] === id;
  const inside = source.slice(open + tag[0].length, index);
  return ![...inside.matchAll(LABELABLE)].some((x) => !(x[1] === "input" && isHidden(x[2])));
}

/** Every control tag in a source text, with what it needs to be named. */
export function controls(source) {
  const out = [];
  for (const m of source.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
    const attrs = m[2];
    if (isHidden(attrs)) continue;
    const id = attrs.match(ID_ATTR)?.[1] ?? null;
    const before = source.slice(0, m.index);
    out.push({
      tag: m[1],
      id,
      attrs,
      wrapped: wrappingLabelNames(source, m.index, id),
      ariaLabel: /\baria-label=(?:"\s*[^"\s][^"]*"|'\s*[^'\s][^']*')/.test(attrs),
      labelledby: (attrs.match(/\baria-labelledby=["']([^"']*)["']/)?.[1] ?? "").split(/\s+/).filter(Boolean),
      labelledbyAttr: /\baria-labelledby=/.test(attrs),
      line: before.split("\n").length,
    });
  }
  return out;
}

/** Every id a source text declares on an element: read from opening tags' attributes only, never from text or script (a template id keeps its `${…}`; LMS-content#119). */
export function declaredIds(source) {
  const ids = new Set();
  for (const tag of source.matchAll(/<[A-Za-z][\w-]*\b([^>]*)>/g)) {
    const id = tag[1].match(ID_ATTR)?.[1];
    if (id) ids.add(id);
  }
  return ids;
}

/**
 * Whether a control is named, given the package's `<label for>` targets and declared ids. An
 * aria-labelledby that is empty or names an id the package does not declare is a broken reference:
 * the control is reported whatever else names it. An empty aria-label names nothing.
 */
export function isNamed(c, { labelled, ids }) {
  if (c.labelledbyAttr && (c.labelledby.length === 0 || !c.labelledby.every((ref) => ids.has(ref)))) return false;
  if (c.labelledby.length || c.ariaLabel) return true;
  return c.wrapped || (c.id !== null && labelled.has(c.id));
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
    const ids = new Set(sources.flatMap(([, s]) => [...declaredIds(s)]));
    const unnamed = [];
    for (const [file, source] of sources) {
      for (const c of controls(source)) {
        if (isNamed(c, { labelled, ids })) continue;
        unnamed.push(`${file}:${c.line} <${c.tag}${c.id ? ` id="${c.id}"` : ""}>`);
      }
    }
    assert.deepEqual(unnamed, [], "controls with no <label for>, no wrapping <label> that names them, no non-empty aria-label, or a broken aria-labelledby");
  });
}

test("the check sees the ways a control is named, an unnamed one, and the ways a control only looks named (LMS-content#102)", () => {
  const src = `<label for="a">A</label><input id="a">
<label>B <input id="b"></label>
<select id="c" aria-label="C"></select>
<span id="d-name">D</span><input id="d" aria-labelledby="d-name">
<input id="e">
<input type="hidden" id="f">
<input id="g" aria-label="">
<input id="h" aria-labelledby="missing">
<input id="h2" aria-labelledby="d-name nope">
<label for="h3">H3</label><input id="h3" aria-labelledby="">
<label for="elsewhere">I <input id="i"></label>
<label>J <input id="j1"> <input id="j2"></label>
<label><input type="hidden" name="k0"> K <input id="k"></label>
<label for="l">L <input id="l"></label>
<input data-id="x" id="m" aria-label="M">
<label for="">N <input id="n"></label>
<p>id="t-name"</p><input id="t" aria-labelledby="t-name">
<script>const id="u-name";</script><input id="u" aria-labelledby="u-name">`;
  const labelled = labelledIds(src);
  const ids = declaredIds(src);
  assert.deepEqual(controls(src).map((c) => c.id), ["a", "b", "c", "d", "e", "g", "h", "h2", "h3", "i", "j1", "j2", "k", "l", "m", "n", "t", "u"]);
  // Named: a label for it, a label around it, a non-empty aria-label, a resolvable aria-labelledby, the first control in a label, a label whose for is the control, an id beside a data-id.
  // Unnamed: nothing (e), an empty aria-label (g), a labelledby naming a missing id (h, h2) or none (h3, though a label is for it), a wrapping label whose for points elsewhere (i), the second control in one label (j2),
  // a wrapping label with an explicit empty for (n), a labelledby whose id appears only in text (t) or only in script (u).
  assert.deepEqual(controls(src).filter((c) => isNamed(c, { labelled, ids })).map((c) => c.id), ["a", "b", "c", "d", "j1", "k", "l", "m"]);
  assert.equal(ids.has("x"), false, "a data-id is not an id");
  assert.equal(ids.has("t-name") || ids.has("u-name"), false, "text and script declare no id");
  assert.ok(ids.has("d-name") && ids.has("h3"), "an element's id attribute is read");
});
