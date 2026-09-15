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

/**
 * The opening tags of a source text, read quote-aware (LMS-content#119, #121): `{ name, attrs, index, clean }`
 * in order, `attrs` a Map from the lower-cased attribute name to its value ("" for a bare attribute).
 * A `>` inside a quoted value does not end a tag, a name is matched whole (`data-for` is not `for`),
 * whitespace around `=` is allowed, and a template interpolation (`${…}`) is one token, inside a
 * quoted value too. A tag is `clean` when everything in it reads as attributes; a `<` inside a quoted
 * value of a clean tag starts no tag, so `<div title='<span id="x">'>` declares nothing. The text of a
 * script (`a<b` …) makes tags that are not clean: they hide nothing after them, and declare no id.
 */
export function openingTags(source) {
  const tags = [];
  const quoted = []; // [open quote, close quote] of the values of clean tags
  const inQuoted = (at) => quoted.some(([open, close]) => at > open && at < close);
  /** The index after a `${…}` starting at `at`, braces balanced. */
  const skipInterpolation = (at) => {
    let depth = 0;
    for (let k = at + 1; k < source.length; k++) {
      if (source[k] === "{") depth++;
      else if (source[k] === "}" && --depth === 0) return k + 1;
    }
    return source.length;
  };
  /** The closing quote of a value opened at `at`, past any interpolation inside it; -1 when unterminated. */
  const closeQuote = (at, quote) => {
    for (let k = at + 1; k < source.length; ) {
      if (source.startsWith("${", k)) k = skipInterpolation(k);
      else if (source[k] === quote) return k;
      else k++;
    }
    return -1;
  };
  for (const m of source.matchAll(/<([A-Za-z][\w-]*)/g)) {
    if (inQuoted(m.index)) continue;
    const attrs = new Map();
    const values = [];
    let clean = true;
    let closed = false;
    let i = m.index + m[0].length;
    while (i < source.length) {
      while (i < source.length && /\s/.test(source[i])) i++;
      if (source[i] === ">" || source.startsWith("/>", i)) {
        closed = true;
        break;
      }
      if (source.startsWith("${", i)) {
        i = skipInterpolation(i); // `${on ? "checked" : ""}` among a tag's attributes
        continue;
      }
      const name = /^[^\s"'>/=]+/.exec(source.slice(i, i + 200))?.[0];
      if (!name) {
        clean = false;
        i++;
        continue;
      }
      if (!/^[A-Za-z_:@][\w:.@-]*$/.test(name)) clean = false;
      i += name.length;
      let j = i;
      while (j < source.length && /\s/.test(source[j])) j++;
      let value = "";
      if (source[j] === "=") {
        j++;
        while (j < source.length && /\s/.test(source[j])) j++;
        const quote = source[j];
        if (quote === '"' || quote === "'") {
          const close = closeQuote(j, quote);
          if (close < 0) break; // an unterminated value: not a tag
          value = source.slice(j + 1, close);
          values.push([j, close]);
          i = close + 1;
        } else {
          value = /^[^\s>]*/.exec(source.slice(j, j + 500))[0];
          i = j + value.length;
        }
      }
      if (!attrs.has(name.toLowerCase())) attrs.set(name.toLowerCase(), value);
    }
    if (!closed) continue;
    if (clean) quoted.push(...values);
    tags.push({ name: m[1].toLowerCase(), attrs, index: m.index, clean });
  }
  return tags;
}

const CONTROL_TAGS = new Set(["input", "select", "textarea"]);
/** The elements a <label> can name, as HTML defines them (an input of type hidden is not one). */
const LABELABLE_TAGS = new Set(["button", "input", "meter", "output", "progress", "select", "textarea"]);
const isHidden = (attrs) => (attrs.get("type") ?? "").trim().toLowerCase() === "hidden";

/**
 * Whether the <label> a control is written inside names it: the nearest label opened before the
 * control and not closed, whose `for`, when it has one, is the control's id (an empty `for` names
 * nothing), and otherwise of which the control is the first labelable element.
 */
function wrappingLabelNames(source, tags, control) {
  const label = tags.filter((t) => t.name === "label" && t.clean && t.index < control.index).at(-1);
  if (!label || source.lastIndexOf("</label>", control.index) > label.index) return false;
  if (label.attrs.has("for")) return label.attrs.get("for") !== "" && label.attrs.get("for") === control.id;
  return !tags.some((t) => t.index > label.index && t.index < control.index && LABELABLE_TAGS.has(t.name) && !(t.name === "input" && isHidden(t.attrs)));
}

/** Every control tag in a source text, with what it needs to be named. */
export function controls(source) {
  const tags = openingTags(source);
  return tags
    .filter((t) => CONTROL_TAGS.has(t.name) && !isHidden(t.attrs))
    .map((t) => {
      const id = t.attrs.get("id") || null;
      const labelledby = t.attrs.get("aria-labelledby");
      return {
        tag: t.name,
        id,
        attrs: t.attrs,
        wrapped: wrappingLabelNames(source, tags, { index: t.index, id }),
        ariaLabel: (t.attrs.get("aria-label") ?? "").trim() !== "",
        labelledby: (labelledby ?? "").split(/\s+/).filter(Boolean),
        labelledbyAttr: labelledby !== undefined,
        line: source.slice(0, t.index).split("\n").length,
      };
    });
}

/** Every id a source text declares on an element, from its own `id` attribute only (a template id keeps its `${…}`). */
export function declaredIds(source) {
  return new Set(openingTags(source).filter((t) => t.clean).map((t) => t.attrs.get("id")).filter(Boolean));
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
  return new Set(openingTags(source).filter((t) => t.name === "label" && t.clean && t.attrs.get("for")).map((t) => t.attrs.get("for")));
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
<script>const id="u-name";</script><input id="u" aria-labelledby="u-name">
<p title='id="w-name"'>W</p><input id="w" aria-labelledby="w-name">
<span title="a > b" id="gt-name">G</span><input id="gt" aria-labelledby="gt-name">
<label data-for="">Y <input id="y"></label>
<label for = "">Z <input id="z"></label>
<div title='<span id="v2-name">'></div><input id="v2" aria-labelledby="v2-name">
<input type="checkbox" id="tpl" \${on ? "checked" : ""} aria-label="Template">
<span class="\${on ? "a" : "b"}" id="tq-name">Q</span><input id="tq" aria-labelledby="tq-name">`;
  const labelled = labelledIds(src);
  const ids = declaredIds(src);
  assert.deepEqual(controls(src).map((c) => c.id), ["a", "b", "c", "d", "e", "g", "h", "h2", "h3", "i", "j1", "j2", "k", "l", "m", "n", "t", "u", "w", "gt", "y", "z", "v2", "tpl", "tq"]);
  // Named: a label for it, a label around it, a non-empty aria-label, a resolvable aria-labelledby, the first control in a label, a label whose for is the control, an id beside a data-id.
  // Unnamed: nothing (e), an empty aria-label (g), a labelledby naming a missing id (h, h2) or none (h3, though a label is for it), a wrapping label whose for points elsewhere (i), the second control in one label (j2),
  // a wrapping label with an explicit empty for (n, and z with spaces around =), a labelledby whose id appears only in text (t), only in script (u), or only inside another attribute value (w).
  // Named too: an id after a quoted > in another attribute (gt), and a label whose data-for is no for, around its first control (y).
  assert.deepEqual(controls(src).filter((c) => isNamed(c, { labelled, ids })).map((c) => c.id), ["a", "b", "c", "d", "j1", "k", "l", "m", "gt", "y", "tpl", "tq"]);
  assert.equal(ids.has("x"), false, "a data-id is not an id");
  assert.equal(ids.has("t-name") || ids.has("u-name") || ids.has("w-name"), false, "text, script and another attribute value declare no id");
  assert.ok(ids.has("gt-name"), "a quoted > in an earlier attribute does not hide the id");
  assert.equal(labelledIds(src).has(""), false);
  // A `<` inside a quoted value starts no tag (v2 stays unnamed); a template among the attributes, or inside a quoted value, hides nothing after it (tpl, tq).
  assert.deepEqual(openingTags(`<div title='<span id="missing">'></div>`).map((t) => t.name), ["div"]);
  assert.equal(ids.has("v2-name"), false);
  // Script text makes no clean tag and hides no control: the input written inside a string is still read.
  const script = `if (a<b) el.innerHTML = '<input id="js">'; const id="nope";`;
  assert.deepEqual(controls(script).map((c) => c.id), ["js"]);
  assert.equal(declaredIds(script).has("nope"), false);
  assert.ok(ids.has("d-name") && ids.has("h3"), "an element's id attribute is read");
});
