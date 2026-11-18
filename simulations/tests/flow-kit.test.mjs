// The flow kit (simulations/kit/flow-kit.js + flow-kit.css; skills/lms-authoring-simulations/SKILL.md, "Flow
// diagrams"): a flow sim's main.js starts with the kit's script byte for byte, and its style.css carries the kit's
// CSS right after the sim kit, so every flow sim draws, routes and steps the same way. For each flow sim this runs the
// kit's own spec check, then lays the spec out the way a learner sees it:
//   - on a 1280x720 laptop (the 1100 px LMS frame) the drawing column is 693 px wide and at most 380 px tall, and
//     the laid-out drawing fits in it without being scaled down, so its 12 px labels show at 12 px;
//   - on a 360 px phone and in a lesson's 286 px frame the boxes reflow into narrow columns that fit the width as drawn;
//   - in every layout no arrow crosses a box, and every label fits its box.
// Then it drives the real main.js in the small DOM of sim-dom.mjs: steps, the predict verdict, the one checkpoint,
// and motion that stops (and doesn't start under reduced motion). An explore sim (no steps: boxes open cards and
// one question asks "which box?") may stack its drawing full width above the card, so on a laptop it must fit the 1042 px
// stage at full size and at most EXPLORE_HEIGHT tall; its tests drive clicks, keys, the question and the one checkpoint, and
// check that every card's "Covered in" names a real lesson by its title. Run by `npm run gate`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { loadSim } from "./sim-dom.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const KIT_JS = fs.readFileSync(path.join(ROOT, "kit/flow-kit.js"), "utf8");
const KIT_CSS = fs.readFileSync(path.join(ROOT, "kit/flow-kit.css"), "utf8");
const SIM_KIT = fs.readFileSync(path.join(ROOT, "kit/sim-kit.css"), "utf8");
/** The flow sims. A package whose main.js starts with the kit's marker must be listed here too. */
export const ON_FLOW = ["hybrid-agent-flow", "platform-map-explorer", "workflow-canvas-flow", "enterprise-data-flow", "a2a-vs-mcp-flow", "threat-defence-flow", "gateway-registry-flow", "continuous-eval-loop", "capstone-architecture-explorer", "customization-guarantees-flow", "context-loading-flow", "agents-cli-loop", "sandbox-ladder-explorer", "mcp-routes-explorer", "adk-anatomy-explorer", "eval-case-explorer"];

// The 1100 px frame: #app pads 14 px, the stage panel 14 px plus a 1 px border; from 900 px the stage is two columns,
// the right one 300 px in a flow sim (flow-kit.css), with a 16 px gap. Phones: 360 px less the same padding, and the
// lesson's narrowest frame (286 px, LMS-content#130) less it too.
const LAPTOP_COLUMN = (() => { const inner = 1100 - 2 * 14 - 2 * 15; return Math.floor(inner - 16 - 300); })();
const LAPTOP_HEIGHT = 380;
// Stacked (explore mode): the drawing takes the stage's full content width, and the card row sits under it.
const LAPTOP_STAGE = 1100 - 2 * 14 - 2 * 15;
const EXPLORE_HEIGHT = 400;
const NARROW = [360 - 58, 286 - 58];
// Frames between the laptop and the phone: two columns from 900 px (where the kit may stack the drawing above the
// controls instead), one below.
const FRAMES = [1280, 1000, 900, 899, 768, 600];

const kit = () => {
  const ctx = vm.createContext({});
  vm.runInContext(`${KIT_JS}\nthis.FlowKit = FlowKit;`, ctx);
  return ctx.FlowKit;
};

/** The SPEC a flow sim hands to FlowKit.mount, read by running its main.js after the kit with mount caught. */
function specOf(id) {
  const main = fs.readFileSync(path.join(ROOT, "packages", id, "main.js"), "utf8");
  let spec = null;
  const ctx = vm.createContext({ FlowKit: { mount: (s) => { spec = s; } } });
  vm.runInContext(main.slice(KIT_JS.length), ctx);
  assert.ok(spec, `${id}: main.js never calls FlowKit.mount(SPEC)`);
  return spec;
}

test("a zone inside itself, directly or through another zone, is reported, not followed forever", () => {
  const FlowKit = kit();
  const base = { nodes: [{ id: "n", label: "N", zone: "a", at: [0, 0] }], edges: [], steps: [{ label: "S", text: "T", edges: [] }], checkpoint: { id: "c", step: 1 } };
  const run = (zones) => vm.runInContext("FlowKit.check(spec)", vm.createContext({ FlowKit, spec: { ...base, zones } }), { timeout: 500 });
  assert.match([...run([{ id: "a", title: "A", in: "a" }])].join("\n"), /zone a sits inside itself: a in a/);
  assert.match([...run([{ id: "a", title: "A", in: "b" }, { id: "b", title: "B", in: "a" }])].join("\n"), /sits inside itself: a in b in a/);
});

test("the flow kit opens with its marker line and closes with its end marker", () => {
  assert.match(KIT_JS, /^\/\* flow-kit v\d+:/);
  assert.match(KIT_JS.trimEnd(), /\/\* end flow-kit v\d+ \*\/$/);
  assert.match(KIT_CSS, /^\/\* flow-kit v\d+:/);
  assert.match(KIT_CSS.trimEnd(), /\/\* end flow-kit v\d+ \*\/$/);
  assert.doesNotMatch(KIT_JS, /\bfetch\(|XMLHttpRequest|postMessage|import\(|\beval\(|new Function/, "the kit talks to the host only through the sim SDK");
});

for (const id of fs.readdirSync(path.join(ROOT, "packages"))) {
  const main = path.join(ROOT, "packages", id, "main.js");
  if (!fs.existsSync(main)) continue;
  if (fs.readFileSync(main, "utf8").startsWith("/* flow-kit v") && !ON_FLOW.includes(id)) {
    test(`${id}: a package on the flow kit is listed in ON_FLOW`, () => assert.fail(`add ${id} to ON_FLOW in simulations/tests/flow-kit.test.mjs`));
  }
}

const fitsBoxes = (FlowKit, spec, L, where) => {
  for (const r of Object.values(L.routes)) assert.equal(r.hits, 0, `${where}: the arrow ${r.id} crosses a box`);
  for (const n of spec.nodes) {
    const b = L.boxes[n.id];
    const room = FlowKit.textRoom(n, b.w, L.icons);
    for (const line of FlowKit.lines(n.label)) assert.ok(FlowKit.textWidth(line, 12, true) <= room, `${where}: "${line}" doesn't fit the ${room} px its box leaves for text`);
    if (n.sub) assert.ok(FlowKit.textWidth(n.sub, 10.5, false) <= room, `${where}: "${n.sub}" doesn't fit the ${room} px its box leaves for text`);
  }
  for (const z of spec.zones || []) {
    const b = L.zones[z.id];
    assert.ok(b.titleW <= b.w - 14, `${where}: the zone title "${b.title}" is wider than its zone; give the zone a short title`);
  }
};

for (const id of ON_FLOW) {
  test(`${id}: main.js starts with the flow kit and style.css with the sim kit then the flow kit, unchanged`, () => {
    const main = fs.readFileSync(path.join(ROOT, "packages", id, "main.js"), "utf8");
    const css = fs.readFileSync(path.join(ROOT, "packages", id, "style.css"), "utf8");
    assert.ok(main.startsWith(KIT_JS), `${id}/main.js must begin with simulations/kit/flow-kit.js exactly; copy it again and put the SPEC after it`);
    assert.ok(css.startsWith(SIM_KIT), `${id}/style.css must begin with simulations/kit/sim-kit.css exactly`);
    assert.ok(css.slice(SIM_KIT.length).replace(/^\s*/, "").startsWith(KIT_CSS), `${id}/style.css must carry simulations/kit/flow-kit.css right after the sim kit`);
  });

  test(`${id}: the spec passes the kit's check`, () => {
    assert.deepEqual([...kit().check(specOf(id))], []);
  });

  if (kit().isExplore(specOf(id))) {
    test(`${id}: on a laptop the drawing fits the ${LAPTOP_STAGE} px stage at full size, at most ${EXPLORE_HEIGHT} px tall`, () => {
      const FlowKit = kit();
      const spec = specOf(id);
      const where = FlowKit.plan(spec, LAPTOP_STAGE, true);
      const L = FlowKit.layout(spec, where.column);
      assert.equal(L.narrow, false, `${id}: the drawing reflows on a laptop; narrow cellWidth`);
      assert.ok(L.width <= where.column, `${id}: the drawing is ${L.width} px wide in a ${where.column} px column, so it would shrink`);
      assert.ok(L.height <= EXPLORE_HEIGHT, `${id}: the drawing is ${L.height} px tall, over ${EXPLORE_HEIGHT}, so the card row would fall below the frame`);
      fitsBoxes(FlowKit, spec, L, `${id} (laptop)`);
    });
  } else {
    test(`${id}: on a laptop the drawing fits its ${LAPTOP_COLUMN} x ${LAPTOP_HEIGHT} px column at full size, arrows clear of boxes`, () => {
      const FlowKit = kit();
      const spec = specOf(id);
      const L = FlowKit.layout(spec, LAPTOP_COLUMN);
      assert.equal(L.narrow, false);
      if (spec.nodes.some((n) => n.icon)) assert.equal(L.icons, true, `${id}: the boxes are too narrow for their icons on a laptop; shorten the labels or widen cellWidth`);
      assert.ok(L.width <= LAPTOP_COLUMN, `${id}: the drawing is ${L.width} px wide, over the ${LAPTOP_COLUMN} px column, so it would shrink; narrow cellWidth`);
      assert.ok(L.height <= LAPTOP_HEIGHT, `${id}: the drawing is ${L.height} px tall, over ${LAPTOP_HEIGHT}, so it would shrink; use fewer rows`);
      fitsBoxes(FlowKit, spec, L, `${id} (laptop)`);
    });

  }

  for (const frame of FRAMES) {
    test(`${id}: in a ${frame} px frame the drawing is never scaled down`, () => {
      const FlowKit = kit();
      const spec = specOf(id);
      const two = frame >= 900;
      const where = FlowKit.plan(spec, frame - 58, two);
      const L = FlowKit.layout(spec, where.column);
      assert.ok(L.width <= where.column, `${id}: the drawing is ${L.width} px wide in a ${where.column} px column, so its labels would shrink`);
      if (two && !where.stack) assert.ok(L.height <= LAPTOP_HEIGHT, `${id}: beside the controls the drawing is ${L.height} px tall, over ${LAPTOP_HEIGHT}, so it would shrink`);
      fitsBoxes(FlowKit, spec, L, `${id} (${frame} px frame)`);
    });
  }

  if (kit().isExplore(specOf(id))) {
    exploreTests(id);
    continue;
  }

  test(`${id}: the checkpoint and the verdict need a prediction made before the reveal`, async () => {
    const spec = specOf(id);
    const fired = (sim) => sim.events.filter((e) => e.startsWith("checkpoint:")).length;
    const text = (sim, sel) => sim.find(sel).textContent.replace(/\s+/g, " ").trim();
    // Jumping straight to the reveal with no pick reveals nothing and earns nothing.
    let sim = await loadSim(id);
    await sim.press(`[data-step="${spec.predict.revealAt}"]`);
    assert.equal(fired(sim), 0);
    assert.match(text(sim, "#verdict"), /Make your prediction above first/);
    assert.doesNotMatch(text(sim, "#verdict"), new RegExp(spec.predict.why.slice(0, 30)));
    // A pick made after seeing the reveal needs a new run.
    await sim.press(`[data-predict="${spec.predict.answer}"]`);
    assert.equal(fired(sim), 0);
    assert.match(text(sim, "#verdict"), /Step back and run to here again/);
    await sim.press("#back");
    await sim.press("#step");
    assert.equal(fired(sim), 1);
    assert.match(text(sim, "#verdict"), /Right\./);
    // Picking first, then jumping to the reveal, earns it once.
    sim = await loadSim(id);
    await sim.press(`[data-predict="${spec.predict.answer}"]`);
    await sim.press(`[data-step="${spec.checkpoint.step}"]`);
    await sim.press("#back");
    await sim.press("#step");
    assert.equal(fired(sim), 1);
  });

  test(`${id}: the verdict is announced and the drawing's name follows the step`, async () => {
    const spec = specOf(id);
    const sim = await loadSim(id);
    assert.equal(sim.find("#verdict").getAttribute("aria-live"), "polite");
    assert.match(sim.find("#svg").getAttribute("aria-label"), /Overview/);
    await sim.press("#step");
    const s = spec.steps[0];
    const label = sim.find("#svg").getAttribute("aria-label");
    assert.match(label, new RegExp(`Step 1 of ${spec.steps.length}, ${s.label}:`));
    const reached = spec.nodes.find((n) => n.id === s.at);
    if (reached) assert.match(label, new RegExp(`Reached: ${reached.label}`));
  });

  for (const w of NARROW) {
    test(`${id}: in a ${w} px drawing column the boxes reflow to fit as drawn, arrows clear of boxes`, () => {
      const FlowKit = kit();
      const spec = specOf(id);
      const L = FlowKit.layout(spec, w);
      assert.equal(L.narrow, true);
      assert.ok(L.width <= w, `${id}: the narrow drawing is ${L.width} px wide, over ${w}`);
      fitsBoxes(FlowKit, spec, L, `${id} (${w} px)`);
    });
  }

  test(`${id}: stepping to the end shows the verdict and fires the one checkpoint once`, async () => {
    const spec = specOf(id);
    const sim = await loadSim(id);
    const text = (sel) => sim.find(sel).textContent.replace(/\s+/g, " ").trim();
    assert.equal(text("#caption"), spec.intro);
    const wrong = spec.predict.options.find((o) => o.id !== spec.predict.answer);
    await sim.press(`[data-predict="${wrong.id}"]`);
    for (let i = 1; i <= spec.steps.length; i++) {
      await sim.press("#step");
      await sim.advance(2000);
      assert.equal(text("#caption"), `Step ${i} of ${spec.steps.length} · ${spec.steps[i - 1].label}${spec.steps[i - 1].text}`);
      assert.equal(sim.find(`[data-step="${i}"]`).getAttribute("aria-current"), "step");
      assert.equal(sim.doc.activeElement, sim.find("#step"), "Step keeps focus");
      if (i < spec.predict.revealAt) assert.equal(text("#verdict"), "");
    }
    assert.match(text("#verdict"), new RegExp(`^You picked: ${wrong.label}\\. Not so\\.`));
    await sim.press("#step");
    await sim.press("#back");
    await sim.press(`[data-step="${spec.checkpoint.step}"]`);
    assert.deepEqual(sim.events.filter((e) => e.startsWith("checkpoint:")), [`checkpoint:${spec.checkpoint.id}`]);
    await sim.press("#reset");
    assert.equal(text("#caption"), spec.intro);
    assert.equal(text("#verdict"), "");
  });

  test(`${id}: Play steps to the end on its own, then stops; any other control stops it first`, async () => {
    const spec = specOf(id);
    const sim = await loadSim(id);
    const at = () => sim.doc.querySelectorAll("[aria-current]").map((b) => b.getAttribute("data-step"));
    await sim.press("#play");
    assert.equal(sim.find("#play").textContent, "Pause");
    await sim.advance(60000);
    assert.deepEqual(at(), [String(spec.steps.length)]);
    assert.equal(sim.find("#play").textContent, "Play");
    assert.equal(sim.doc.activeElement, sim.find("#play"), "Play keeps focus");
    await sim.press('[data-step="0"]');
    await sim.press("#play");
    await sim.advance(100);
    await sim.press("#back");
    await sim.advance(60000);
    assert.deepEqual(at(), ["0"], "Back stopped the run at the overview");
    await sim.press("#speed");
    assert.equal(sim.find("#speed").textContent, "1.5×");
  });

  test(`${id}: the token runs a step's arrows once and stops at the end`, async () => {
    const sim = await loadSim(id);
    await sim.press("#step");
    await sim.advance(100);
    const mid = [sim.find("#fk-token").getAttribute("cx"), sim.find("#fk-token").getAttribute("cy")];
    await sim.advance(3000);
    const end = [sim.find("#fk-token").getAttribute("cx"), sim.find("#fk-token").getAttribute("cy")];
    assert.notDeepEqual(mid, end, "the token moves along the arrows");
    await sim.advance(3000);
    assert.deepEqual([sim.find("#fk-token").getAttribute("cx"), sim.find("#fk-token").getAttribute("cy")], end, "and then rests");
  });
}

/** Tests for an explore sim: boxes and zone titles are buttons that open a card, and one question asks "which box?". */
function exploreTests(id) {
  const text = (sim, sel) => sim.find(sel).textContent.replace(/\s+/g, " ").trim();
  const fired = (sim) => sim.events.filter((e) => e.startsWith("checkpoint:"));
  const key = async (sim, el, k) => { el.focus(); el.dispatch("keydown", { key: k }); await sim.advance(0); };

  test(`${id}: every box and zone title with a card is a focusable button, and the card is announced`, async () => {
    const spec = specOf(id);
    const sim = await loadSim(id);
    const picks = sim.doc.querySelectorAll("[data-pick]");
    const want = spec.nodes.length + (spec.zones || []).filter((z) => z.info).length;
    assert.equal(picks.length, want, `${id}: ${picks.length} buttons on the drawing, ${want} items with cards`);
    for (const g of picks) {
      assert.equal(g.getAttribute("role"), "button");
      assert.equal(g.getAttribute("tabindex"), "0");
      assert.equal(g.getAttribute("aria-pressed"), "false");
      assert.match(g.getAttribute("aria-label"), /more info$/);
    }
    assert.equal(sim.find("#card").getAttribute("aria-live"), "polite");
    assert.equal(sim.find("#caption").getAttribute("role"), "status");
  });

  test(`${id}: Enter opens a box's card, Escape closes it, and the arrows move between boxes`, async () => {
    const spec = specOf(id);
    const sim = await loadSim(id);
    const first = spec.nodes[0];
    const el = () => sim.find(`[data-pick="${first.id}"]`);
    await key(sim, el(), "Enter");
    assert.equal(sim.find("#card h3").textContent, first.label.replace(/\n/g, " "));
    assert.equal(el().getAttribute("aria-pressed"), "true");
    await key(sim, el(), "Escape");
    assert.equal(el().getAttribute("aria-pressed"), "false");
    assert.equal(text(sim, "#card"), spec.intro);
    await key(sim, el(), "ArrowDown");
    const below = sim.doc.activeElement.getAttribute("data-pick");
    assert.ok(below && below !== first.id, `${id}: ArrowDown from ${first.id} goes nowhere`);
    await key(sim, sim.doc.activeElement, "ArrowUp");
    assert.equal(sim.doc.activeElement.getAttribute("data-pick"), first.id, `${id}: ArrowUp from ${below} doesn't come back to ${first.id}`);
  });

  test(`${id}: a wrong box says so, the right one explains why, and the one checkpoint fires once`, async () => {
    const spec = specOf(id);
    const sim = await loadSim(id);
    assert.ok(text(sim, "#caption").startsWith(spec.ask.question));
    const wrong = spec.nodes.find((n) => n.id !== spec.ask.answer);
    await sim.press(`[data-pick="${wrong.id}"]`);
    assert.match(text(sim, "#caption"), /Not .*Read its card, then try another box\./);
    assert.equal(sim.find("#card h3").textContent, wrong.label.replace(/\n/g, " "), "a wrong box still opens its card");
    assert.deepEqual(fired(sim), []);
    await sim.press(`[data-pick="${spec.ask.answer}"]`);
    assert.match(text(sim, "#caption"), /^Right: /);
    assert.ok(text(sim, "#caption").includes(spec.ask.why), `${id}: the caption doesn't explain why`);
    assert.deepEqual(fired(sim), [`checkpoint:${spec.checkpoint.id}`]);
    await sim.press(`[data-pick="${wrong.id}"]`);
    assert.match(text(sim, "#caption"), /^Right: /, "once found, other boxes just open their cards");
    await sim.press("#reset");
    assert.ok(text(sim, "#caption").startsWith(spec.ask.question));
    await sim.press(`[data-pick="${spec.ask.answer}"]`);
    assert.equal(fired(sim).length, 1, "the checkpoint fires once, not again after Reset");
  });

  test(`${id}: every card's "Covered in" names a lesson that exists, by its title`, () => {
    const spec = specOf(id);
    const items = [...spec.nodes, ...(spec.zones || []).filter((z) => z.info)];
    for (const it of items) {
      const c = it.info.covered;
      if (!c) continue;
      const file = path.join(ROOT, "..", "topics", `${c.topic}.mdx`);
      assert.ok(fs.existsSync(file), `${id}: ${it.id} is covered in ${c.topic}, which has no topics/${c.topic}.mdx`);
      const title = (fs.readFileSync(file, "utf8").match(/^title:\s*["']?(.+?)["']?\s*$/m) || [])[1];
      assert.equal(title, c.title, `${id}: ${it.id} names ${c.topic} "${c.title}", but the lesson's title is "${title}"`);
    }
  });
}
