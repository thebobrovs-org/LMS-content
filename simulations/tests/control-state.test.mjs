// LMS-content#136: in several simulations a selection or a run changed what was drawn or shown while nothing a screen
// reader reads changed: a set of mutually exclusive buttons showed its choice by styling alone, and a run's result
// (a prediction, an epoch, a compile stage, a preset's effect) reached no live region. Three checks:
//   1. Static, over every package: a <button> written with a styling class that marks it chosen ("active", "on", also
//      when picked by an interpolation) carries aria-pressed, aria-selected, aria-current or aria-checked in the same tag.
//   2. Each listed set of mutually exclusive buttons, run in the vm DOM of sim-dom.mjs: exactly the chosen one is marked,
//      at load and after each other one is pressed.
//   3. Each listed run control, pressed in the vm DOM: the text of the page's live regions (role="status", or aria-live
//      other than "off") changes and isn't empty.
// Run by `npm run gate`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadSim } from "./sim-dom.mjs";

const PACKAGES = path.join(path.dirname(fileURLToPath(import.meta.url)), "../packages");

// ---- 1. Static: a button styled as chosen exposes a state ----------------------------------------------------------

/** Every `<button …>` opening tag in a source, read past quotes and `${…}` (a `>` inside either doesn't end it). */
export function buttonTags(source) {
  const tags = [];
  for (const m of source.matchAll(/<button\b/g)) {
    let i = m.index + m[0].length;
    let quote = null;
    let depth = 0;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (depth > 0) {
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
      } else if (source.startsWith("${", i)) {
        depth = 1;
        i++;
      } else if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === ">") break;
    }
    tags.push({ tag: source.slice(m.index, i + 1), line: source.slice(0, m.index).split("\n").length });
  }
  return tags;
}

const STATE = /\baria-(pressed|selected|current|checked)\s*=/;
/** The class attribute's value names "active" or "on", literally or as a string an interpolation picks. */
export function styledChosen(tag) {
  const cls = /\bclass\s*=\s*("(?:\$\{[^}]*\}|[^"])*"|'(?:\$\{[^}]*\}|[^'])*')/.exec(tag)?.[1] ?? "";
  return /(^|[\s"'])(active|on)(?=[\s"'])/.test(cls.replace(/\$\{[^}]*\}/g, " ")) || /\$\{[^}]*["'](active|on)["'][^}]*\}/.test(cls);
}

test("a button written as chosen (class active or on) carries a pressed, selected, current or checked state (#136)", () => {
  const missing = [];
  for (const id of fs.readdirSync(PACKAGES)) {
    for (const file of ["index.html", "main.js"]) {
      const p = path.join(PACKAGES, id, file);
      if (!fs.existsSync(p)) continue;
      for (const { tag, line } of buttonTags(fs.readFileSync(p, "utf8"))) {
        if (styledChosen(tag) && !STATE.test(tag)) missing.push(`${id}/${file}:${line}: ${tag.replace(/\s+/g, " ").slice(0, 120)}`);
      }
    }
  }
  assert.deepEqual(missing, [], "a choice shown by styling alone");
});

test("the static check reads tags the way the simulations write them", () => {
  const src = `<button class="opt-btn active" data-x="1">A</button>
<button class="t" data-t="128">B</button>
<button class="node \${n === i ? "active" : ""}" data-i="\${n}" aria-label="x > y">C</button>
<button class="seg-btn on" aria-pressed="true">D</button>
<button class="gtab \${gen === "v3" ? "on" : ""}" aria-pressed="\${gen === "v3"}">E</button>
<button class="btn reset">F</button>`;
  const tags = buttonTags(src);
  assert.equal(tags.length, 6);
  assert.deepEqual(tags.map((t) => styledChosen(t.tag)), [true, false, true, true, true, false]);
  assert.deepEqual(tags.map((t) => STATE.test(t.tag)), [false, false, false, true, true, false]);
  assert.match(tags[2].tag, /aria-label="x > y">$/, "a > inside a quoted value doesn't end the tag");
});

// ---- 2. Each set of mutually exclusive buttons marks exactly its chosen one ------------------------------------------

/** `attr` is the state the set uses; with aria-current, the others carry none at all. `setup` presses first. */
const SETS = {
  "capacity-orchestrator": [{ sel: "#slice-btns .opt-btn", attr: "aria-pressed" }, { sel: "#mode-btns .opt-btn", attr: "aria-pressed" }],
  "moe-factory": [{ sel: "[data-mode]", attr: "aria-pressed" }],
  "tensor-rank-explorer": [{ sel: "[data-r]", attr: "aria-pressed" }],
  "arithmetic-intensity-calculator": [{ sel: ".t", attr: "aria-pressed" }],
  "matmul-tiler": [{ sel: ".seg-btn", attr: "aria-pressed" }],
  "spmd-shard-explorer": [{ sel: ".seg-btn", attr: "aria-pressed" }],
  "tpu-ocs-explorer": [{ sel: ".chip[data-mode]", attr: "aria-pressed" }],
  "tpu-vm-anatomy": [{ sel: ".gtab", attr: "aria-pressed" }],
  "backprop-explorer": [{ setup: ['[data-s="1"]'], sel: "#samp button", attr: "aria-pressed" }],
  "scale-hierarchy": [{ sel: ".step-btn", attr: "aria-current" }],
  "tpu-evolution-timeline": [{ sel: ".node", attr: "aria-current" }],
};

/** Which members of the set are marked chosen: `true` for aria-pressed, any value for aria-current. */
const marked = (els, attr) => els.map((e) => (attr === "aria-current" ? e.hasAttribute(attr) : e.getAttribute(attr) === "true"));
const others = (els, attr) => els.every((e) => (attr === "aria-current" ? true : e.getAttribute(attr) === "true" || e.getAttribute(attr) === "false"));

for (const [id, sets] of Object.entries(SETS)) {
  for (const s of sets) {
    test(`${id}: the buttons ${s.sel} mark exactly the chosen one (${s.attr}), at load and after each press (#136)`, async () => {
      const sim = await loadSim(id);
      for (const p of s.setup ?? []) await sim.press(p);
      const all = () => sim.doc.querySelectorAll(s.sel);
      assert.ok(all().length >= 2, `${s.sel}: a set needs at least two buttons, found ${all().length}`);
      assert.equal(marked(all(), s.attr).filter(Boolean).length, 1, `at load, ${s.sel} marks ${marked(all(), s.attr).filter(Boolean).length} chosen, not 1`);
      assert.ok(others(all(), s.attr), `every button in ${s.sel} carries ${s.attr}="true" or "false"`);
      const n = all().length;
      for (let k = n - 1; k >= 0; k--) {
        const el = all()[k];
        el.focus();
        el.dispatch("click");
        await sim.advance(600);
        const m = marked(all(), s.attr);
        assert.deepEqual(m.map((v, j) => (v ? j : -1)).filter((j) => j >= 0), [k], `after pressing button ${k + 1} of ${n}, ${s.sel} marks ${JSON.stringify(m)}`);
      }
    });
  }
}

// ---- 3. Each run control's result reaches a live region -------------------------------------------------------------

const liveText = (doc) =>
  doc.querySelectorAll("[role],[aria-live]")
    .filter((e) => e.getAttribute("role") === "status" || (e.hasAttribute("aria-live") && e.getAttribute("aria-live") !== "off"))
    .map((e) => e.textContent.replace(/\s+/g, " ").trim())
    .join(" | ");

const RUNS = {
  "backprop-explorer": [
    { setup: ['[data-s="3"]'], press: "#b-step", why: "the epoch and loss after a step" },
    { setup: ['[data-s="5"]'], press: "#b-step", why: "the epoch and loss after a step, in Training" },
    { setup: ['[data-s="6"]'], press: "#b-infer", why: "the score after inference" },
  ],
  "neuron-explorer": [
    { press: "#btn-step", why: "the epoch and loss after a step" },
    { press: "#btn-infer", why: "the score after inference" },
  ],
  "xla-fusion-explorer": [
    { setup: ["#btn-step"], press: "#btn-auto-jit", why: "the next compile stage" },
    { setup: ["#btn-step"], press: "#btn-step", why: "the JAX trace stage" },
  ],
  "number-format-explorer": [
    { press: '[data-l="-7"]', why: "what each format makes of 1e-7" },
    { press: '[data-l="0"]', why: "what each format makes of 1" },
    { press: '[data-l="5"]', why: "what each format makes of 1e5" },
  ],
  "arithmetic-intensity-calculator": [
    { press: '[data-t="256"]', why: "the utilization on the 256 tile" },
    { setup: ['[data-t="256"]'], press: '[data-t="128"]', why: "the utilization on the 128 tile" },
  ],
};

for (const [id, runs] of Object.entries(RUNS)) {
  for (const r of runs) {
    test(`${id}: ${r.press}${r.setup ? ` after ${r.setup.join(", ")}` : ""} announces ${r.why} through a live region (#136)`, async () => {
      const sim = await loadSim(id);
      for (const p of r.setup ?? []) await sim.press(p);
      await sim.advance(600);
      const before = liveText(sim.doc);
      await sim.press(r.press);
      await sim.advance(600);
      const after = liveText(sim.doc);
      assert.notEqual(after, before, `no live region changed: "${before}"`);
      assert.ok(after.replace(/\|/g, "").trim().length > 0, "the live regions are empty");
    });
  }
}
