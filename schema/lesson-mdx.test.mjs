// Tests for schema/lesson-mdx.mjs (hyperstack#114): the lesson rules every consumer of lessons shares.
// A lesson compiles with @mdx-js/mdx and the rules plugin: what it may hold passes and is collected
// (URLs, simulations, objectives, item identities); what it may not hold fails with a message naming
// the rule. Run by `npm run gate`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { compile } from "@mdx-js/mdx";
import { MDX_COMPONENTS } from "./content-schema.mjs";
import { ACTIVE_ATTRIBUTE, HTML_ATTRIBUTES, HTML_ELEMENTS, isLiteralData, lessonRules } from "./lesson-mdx.mjs";

/** Compile a lesson body under the rules: `{ ok, urls, sims, objectives, identities }` or `{ ok: false, reason }`. */
async function run(mdx) {
  const found = { urls: [], sims: [], objectives: [], identities: [] };
  try {
    await compile(mdx, { development: false, remarkPlugins: [() => lessonRules(found.urls, found.sims, found.objectives, found.identities)] });
    return { ok: true, ...found };
  } catch (e) {
    return { ok: false, reason: String(e.reason ?? e.message) };
  }
}

test("a lesson of prose, documented components, prose HTML and literal data compiles, and its URLs, simulations, objectives and identities are collected", async () => {
  const r = await run(`# Arrays

Contiguous memory: a [reference](https://example.com/arrays) and ![a figure](/media/array.svg).

<Callout type="tip">Rows first.</Callout>

<Simulation id="demo-sim" height={520} />

<Quiz question="Which is contiguous?" choices={["an array", "a list"]} answer={0} objective="contiguity" id="q-contiguous" />

<details open><summary>More</summary><p className="note" data-k="v" aria-label="more">Aligned.</p></details>
`);
  assert.equal(r.ok, true, r.reason);
  assert.deepEqual(r.urls, ["https://example.com/arrays", "/media/array.svg"]);
  assert.deepEqual(r.sims, ["demo-sim"]);
  assert.deepEqual(r.objectives, ["contiguity"]);
  assert.deepEqual(r.identities.map((i) => [i.tag, i.id, i.prompt]), [["Quiz", "q-contiguous", "Which is contiguous?"]]);
});

test("the rules refuse code, undocumented tags, non-prose HTML attributes, attributes that inject HTML or run code on any element, and unsafe URLs", async () => {
  for (const [mdx, reason] of [
    ['import data from "./data.js"\n\nText', /import or export/],
    ["{1 + 1}", /JavaScript expression/],
    ["<script>{\"x\"}</script>", /<script> isn't HTML a lesson may write/],
    ["<Widget />", /<Widget> isn't a documented component/],
    ['<p lang="en" hidden>t</p>', /<p hidden>: a lesson's HTML may carry only/],
    ['<p onClick="x">t</p>', /<p onClick>: an attribute that injects HTML, loads a document or runs code/],
    ['<Callout type="tip" dangerouslySetInnerHTML={{ __html: "<b>x</b>" }} />', /<Callout dangerouslySetInnerHTML>: an attribute that injects HTML/],
    ['<Figure src="/media/array.svg" alt="a" style={{ color: "red" }} />', /<Figure style>: an attribute that injects HTML/],
    ['<Callout type="note" onMouseOver="x">t</Callout>', /<Callout onMouseOver>: an attribute that injects HTML/],
    ['<Simulation id="demo-sim" srcDoc="<p>x</p>" />', /<Simulation srcDoc>: an attribute that injects HTML/],
    ["[x](javascript:alert)", /http\(s\) or mailto, not "javascript:"/],
    ['<a href=" https://example.com">x</a>', /whitespace or a control character/],
  ]) {
    const r = await run(mdx);
    assert.equal(r.ok, false, `accepted: ${mdx}`);
    assert.match(r.reason, reason, mdx);
  }
});

test("the attribute rule names exactly the attributes that inject HTML, load a document or run code, never an ordinary prop", () => {
  for (const name of ["dangerouslySetInnerHTML", "srcDoc", "srcdoc", "style", "onClick", "onload", "onMouseOver"]) assert.match(name, ACTIVE_ATTRIBUTE, name);
  for (const name of ["src", "href", "alt", "title", "id", "type", "height", "choices", "answer", "objective", "open", "former-ids", "data-k", "aria-label", "styleName", "srcDocument", "srcdocs", "dangerouslySetInnerHTMLLabel", "stylesheet"]) assert.doesNotMatch(name, ACTIVE_ATTRIBUTE, name);
  // The prose allow-lists carry nothing active either.
  assert.deepEqual([...HTML_ATTRIBUTES].filter((a) => ACTIVE_ATTRIBUTE.test(a)), []);
  assert.deepEqual(["script", "iframe", "object", "embed", "style", "form", "svg", "video"].filter((e) => HTML_ELEMENTS.has(e)), []);
  assert.deepEqual(MDX_COMPONENTS.filter((c) => HTML_ELEMENTS.has(c)), []);
});

test("an ordinary prop that only begins like an active attribute compiles on a documented component", async () => {
  for (const mdx of ['<Callout type="tip" styleName="note">t</Callout>', '<Figure src="/media/array.svg" alt="a" srcDocument="x" />', '<Callout type="note" dangerouslySetInnerHTMLLabel="x">t</Callout>']) {
    const r = await run(mdx);
    assert.equal(r.ok, true, `${mdx}: ${r.reason}`);
  }
});

test("literal data is strings, numbers, booleans, null, plain templates, signed numbers, and arrays and objects of them; anything else is code", () => {
  const lit = (value) => ({ type: "Literal", value });
  assert.equal(isLiteralData(lit("a")), true);
  assert.equal(isLiteralData({ type: "UnaryExpression", operator: "-", argument: lit(1) }), true);
  assert.equal(isLiteralData({ type: "ArrayExpression", elements: [lit(1), { type: "ObjectExpression", properties: [{ type: "Property", computed: false, kind: "init", method: false, key: { type: "Identifier", name: "k" }, value: lit(true) }] }] }), true);
  assert.equal(isLiteralData({ type: "TemplateLiteral", expressions: [], quasis: [] }), true);
  assert.equal(isLiteralData({ type: "TemplateLiteral", expressions: [{ type: "Identifier" }], quasis: [] }), false);
  assert.equal(isLiteralData({ type: "Identifier", name: "x" }), false);
  assert.equal(isLiteralData({ type: "CallExpression" }), false);
  assert.equal(isLiteralData({ type: "ArrayExpression", elements: [null] }), false, "a hole is not data");
});

test("active attributes are refused across all documented components, including lowercase srcdoc and boolean props", async () => {
  for (const [mdx, name] of [
    ['<Flashcard front="F" back="B" style={{ color: "blue" }} />', "style"],
    ['<Quiz question="Q" choices={["a"]} answer={0} onClick="x" />', "onClick"],
    ['<Simulation id="demo-sim" srcdoc="<p>x</p>" />', "srcdoc"],
    ['<YouTube id="xyz" dangerouslySetInnerHTML={{ __html: "x" }} />', "dangerouslySetInnerHTML"],
    ['<Tip onFocus="run()">text</Tip>', "onFocus"],
    ['<Term srcDoc="x">term</Term>', "srcDoc"],
    ['<Step title="S" style={{ color: "red" }}>text</Step>', "style"],
    ['<Callout type="tip" style>t</Callout>', "style"],
  ]) {
    const r = await run(mdx);
    assert.equal(r.ok, false, `accepted: ${mdx}`);
    assert.match(r.reason, /an attribute that injects HTML, loads a document or runs code isn't allowed on any element/, mdx);
  }
});

test("Flashcard and Step identity, former-ids and objectives are collected, and malformed id/former-ids fail", async () => {
  const r = await run(`
<Flashcard id="card-1" former-ids={["old-card"]} front="What is X?" back="Y" objective="obj-card" />

<Steps>
  <Step id="step-1" former-ids={["old-step"]} title="Step One" objective="obj-step">Do this.</Step>
</Steps>
`);
  assert.equal(r.ok, true, r.reason);
  assert.deepEqual(r.objectives, ["obj-card", "obj-step"]);
  assert.deepEqual(r.identities, [
    { tag: "Flashcard", prompt: "What is X?", id: "card-1", formerIds: ["old-card"] },
    { tag: "Step", prompt: "Step One", id: "step-1", formerIds: ["old-step"] },
  ]);

  for (const [mdx, reason] of [
    ['<Flashcard id={123} front="F" back="B" />', /<Flashcard id=\{…\}> must be a string/],
    ['<Step former-ids="not-an-array" title="S">body</Step>', /<Step former-ids=\{…\}> must be an array of strings/],
    ['<Flashcard former-ids={[123]} front="F" back="B" />', /<Flashcard former-ids=\{…\}> must be an array of strings/],
    ['<Step objective={123} title="S">body</Step>', /<Step objective=\{…\}> must be a string/],
  ]) {
    const res = await run(mdx);
    assert.equal(res.ok, false, `accepted: ${mdx}`);
    assert.match(res.reason, reason, mdx);
  }
});
