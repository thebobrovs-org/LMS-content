---
name: lms-authoring-simulations
description: Build an LMS simulation — a small, self-contained interactive web app a lesson embeds in a sandboxed iframe via <Simulation id>. Use when creating, editing, or wiring up a lesson's interactive demo. Covers the PROCESS (concept note, then a clickable preview the PO approves before any push), the DESIGN STANDARD (a picture of the idea, a predict step, one concept, one checkpoint — no quests/dashboards), the package layout, sim.config.json, the postMessage SDK (init/theme/props ↔ ready/resize/checkpoint/event), the CRITICAL classic-scripts rule, and build/embed/validate.
---

# Building a simulation

A **simulation** is a tiny web app (plain HTML/CSS/JS — no framework, no build
step) that runs in a sandboxed iframe and talks to the host lesson via a
`postMessage` SDK. The simulation is the **centerpiece** of a lesson: the prose
sets it up and interprets it. Make it small, focused, and genuinely interactive.

## Before any code: the concept, then a preview

Most sims used to start from the same stepper (controls, a list of rows, Step/Auto/Reset)
and ended up looking alike. Start from the idea instead: **what picture would make this
idea obvious?** Choose the picture before you choose the controls.

1. **Write a concept note** and get the PO's yes before you build. Use this brief (the
   ones in [`simulations/BRIEFS.md`](../../simulations/BRIEFS.md) already fill in most of it):

   ```
   objective:        Given <scenario>, the learner can <choose / predict / diagnose> <X>.
   knowledge type:   concept | procedure | decision | troubleshooting | trade-off
   misconception:    <the one wrong belief the sim should break>
   picture:          <the metaphor or drawing, and what moves in it>
   predict step:     <the question the learner answers before acting, and its choices>
   aha checkpoint:   observe-<thing> (fires once, when the learner sees it)
   running example:  <the lesson's own scenario and numbers>
   retain:           <one sentence the learner can say after closing it>
   sources:          <docs with retrieval date>; anything scripted is labelled illustrative
   ```

2. **Build it, then share a clickable preview.** `node scripts/sim-preview.mjs <id> > preview.html`
   writes one self-contained page (style, code and an SDK stub inlined) that opens straight in a
   browser. Share it wherever you can host a page, and put light and dark screenshots (and a GIF
   if you can) in the PR.
3. **The PO approves the preview**, then you finish the tests and the lesson text and the
   cross-review starts (below). Nothing merges without the PO's yes on both the concept and
   the preview.

**Patterns by knowledge type (a starting point, not a rule).** Creativity comes first: a
metaphor that fits beats a pattern that matches. Reach for this table only when nothing
better comes to mind.

| Knowledge type | Often works | Examples here |
|---|---|---|
| Concept | Manipulate one thing and watch two linked views change | `vector-basis-explorer`, `capacity-constraint-explorer` |
| Hierarchy or scale | A ladder you step up and down | `scale-hierarchy` |
| Procedure | Step through it, with the state on show | `agent-loop-stepper` |
| Decision | The same input run through both options side by side | `approval-gate-explorer` (two tracks) |
| Troubleshooting | Break it on purpose, then trace the symptom to the cause | `capacity-constraint-explorer` |
| Quantitative trade-off | A calculator with a threshold line | `arithmetic-intensity-calculator` |

**Sim or image?** Build a sim only when the learner must decide, predict, sequence or
diagnose, and the answer changes with an input. A lookup table, an overview read once, or
a "click to reveal the next box" stays a static image. **Don't keep an image and a sim
that tell the same story** in one lesson: retire one.

## Three agents, one backlog

Codex, agy (Antigravity) and Claude build sims in parallel from
[`simulations/BRIEFS.md`](../../simulations/BRIEFS.md). Each brief has an id (`B01`, `B02`, …).

**Claim a brief** so two agents never take the same one:

1. List the open PRs. A brief is taken when any open PR's title starts with `[sim:<id>]`,
   or when its row in BRIEFS.md names an owner and isn't `open`.
2. Take the first `open` brief nobody has claimed. Create the branch `<agent>/sim-<id>-<slug>`
   (for example `codex/sim-B07-oauth-flow`), set the brief's status to `concept` and its owner
   to your name in BRIEFS.md, commit only that change, and open a **draft PR** titled
   `[sim:<id>] <title>` at once. The draft PR is the claim: if two drafts appear for one
   brief, the older one keeps it and the newer one closes.
3. Put the concept note in the PR description and ask the PO for a yes on it.

**Statuses** (update the row in your own PR as you go): `open` → `concept` (draft PR up, waiting
for the PO) → `building` (concept approved) → `preview` (preview shared, waiting for the PO) →
`review` (PO approved the preview; cross-review running) → `merged`.

**Cross-review.** When a PR reaches `review`, the other two agents each review it against the
design checklist below and the brief, and against "One visual style": a sim that looks unlike
the others gets `CHANGES` even when it works. All three agents may post under one GitHub account, so a
review is a PR comment that starts with `Review by <agent>: APPROVE` or
`Review by <agent>: CHANGES`, followed by the checklist items that fail, each with the file and
line and what to change. Check the product claims against their sources, run `npm run gate` on the
branch, and open the preview. The author fixes the problems and asks the reviewer to look again.
A PR is ready to merge when **both** other agents have posted `APPROVE` on its latest commit, the gate is
green, and the PO has approved the concept and the preview. **Only the PO merges.** agy's
technical-accuracy review (AGENTS.md) still applies as before.

**Keep PRs small:** one brief per PR, touching that sim's package, its tests, its lesson's
text and its BRIEFS.md row. Shared files (the test registry in `scroll-regions.test.mjs`,
`knowledge/index.json`) change by single lines, so rebases stay easy. Don't touch another
agent's sim; if you find a problem in it, review it.

## The design standard

The exemplars show the bar for richness, not a look to copy: **`approval-gate-explorer`**
(two parallel tracks, a no-return line, a predict step), **`neuron-explorer`** (what a neuron learns), and
**`systolic-array`** (a real visualization with live metrics).

1. **One concept, one checkpoint.** A sim teaches a *single* idea and fires
   exactly one `observe-*` checkpoint the moment the learner sees the key insight.
   **No quest chains, no score, no "Completed!" modal, no game.** (We removed those
   on purpose.)
2. **Aim high, then strip the cruft.** Be genuinely rich: a real drawing (SVG or canvas)
   that moves when the learner acts, brief narration, a real instrument, not a toy.
   Step/Auto/Reset is one option, not a requirement.
   The thing we *don't* want isn't ambition, it's cruft: off-brand themes, CDN
   frameworks, quest games, and runaway height. Pure explanation/comparison
   belongs in the **lesson prose**, not padded into the sim.
3. **Focused & self-sizing, inside one laptop screen.** One interactive idea; the sim **grows to its
   content** via `requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 8))`
   after every render — no clipping, no runaway scroll — and that content **fits in 600 px of
   height** on a 1280×720 laptop (see "Fit the screen" below). It's an **embed**, not a
   page: no site chrome (header/sticky nav), no unrelated panels.
4. **On-theme, plain CSS only.** Start `style.css` with the sim kit (see "One visual style"
   below) and apply the host `theme` via `document.documentElement.dataset.theme`. **No CSS frameworks or CDNs**
   (no Tailwind Play, no MathJax unless math is truly essential and vendored),
   **no off-brand palettes** — it must read correctly in light *and* dark.
5. **A measurable readout.** Show one live line that makes the trade-off concrete
   (% compute, remap fraction, hit rate, cycle count). This is the takeaway in
   numbers — keep it to a line, not a sprawling telemetry panel.
6. **A predict step the learner commits to.** Before the key action, the learner picks an
   answer (chips in the sim, or a `<Quiz>` right before the embed, as
   `precision-and-memory` does). A sentence of "predict first" prose doesn't count. In the
   sim, show their pick beside the outcome and say why it was right or wrong.
7. **Anatomy.** Usually predict → drawing → caption (`role="status"`) → controls →
   readout → one-line `legend`. From 900 px wide the drawing sits on the left and the caption
   and controls beside it, so a change never scrolls the drawing away. Change the order when
   the idea needs it.
8. **Deterministic core.** Derive behavior from inputs/props (e.g. a small hash),
   not runtime randomness, so results are reproducible and explainable.
9. **Interaction & a11y.** One primary action + a few controls + **Reset**;
   keyboard-operable (every drag has a button alternative); always-visible focus ring;
   honor `reducedMotion` (no essential motion-only cue).

## One visual style

Every sim looks like it came from one studio, whatever it draws. The concepts differ; the
look doesn't. The look lives in one file, [`simulations/kit/sim-kit.css`](../../simulations/kit/sim-kit.css):

- **Copy it verbatim** to the top of the sim's `style.css`, then add only the sim's own rules
  after its end marker. The app copies each package on its own, so there is no shared import;
  the gate's `style-kit` test fails if the copy differs by a byte. To change the look, change
  the kit, bump its version, and recopy it into every sim on it in the same PR.
  [`template/style.css`](template/style.css) already starts with it.
- **Colour means the same thing everywhere.** `--primary` is "now" or the learner's own
  action; `--violet` is the model; `--teal` is the runtime or a tool; `--green` is pass, kept,
  allowed; `--red` is fail, lost, denied; `--amber` is a limit or a line not to cross.
  `--orange`, `--rose` and `--gold` are for extra categories, used in that order. When a sim's
  categories carry none of these meanings (four storage scopes, say), the hues serve as plain
  category colours, named in the legend; `--primary` still means "now". Don't invent
  a hue; if a sim truly needs one, add it to the kit with light and dark values that pass the
  `palette-contrast` test.
- **Type.** System sans at 14 px; `h2` 13 px muted; captions 14 px; legend 12 px muted; in SVG
  `.k-title` 13 px bold, `.k-label` 12 px, `.k-small` 10.5 px muted, `.k-code` for code. No web fonts.
- **Illustration.** Flat 2-D shapes, no gradients, shadows or 3-D. A hue stroke over a light
  tint of the same hue (`fill-opacity` around .12 to .25 on shapes, never on text). Strokes
  1.5 px for chrome, 2 to 3 px for what matters now (`.k-now`). Dashed (`.k-off`) means
  absent, off or not stored. Radii: 4 px small marks, 8 px boxes, 14 px panels, pills for
  buttons.
- **Controls.** Pills (`.chip` with `aria-pressed`) for choices; exactly one `button.primary`
  for the main action; plain buttons for the rest (Step, Reset). Sliders use the kit's
  `input[type=range]`. Never disable a control that can hold focus.
- **The frame.** A `details.panel.predict` card first (question + chips + `.verdict`), then a
  `.panel.stage` with the drawing (`.scroll` around a wide SVG), the `.caption`
  (`role="status"`) and the `.controls`, then any result panels, then one `.legend` line.
- **Motion.** Short one-shot transitions or animations, about `var(--dur)` (0.6 s), started by
  the learner. No loops, no idle animation, nothing that only moves to look busy. The kit switches transitions off
  under `prefers-reduced-motion` and under a `.reduced` class you set from `init.reducedMotion`;
  every end state must be readable without the motion.

[`reference/style-side-by-side.jpg`](reference/style-side-by-side.jpg) shows four sims on the
kit, light and dark: four different drawings, one look.

## Flow diagrams: the flow kit

When the idea is a system drawn as zones, boxes and arrows (an architecture, a request's path, who
calls whom), don't hand-draw it: write it as data and let the flow kit draw it.
[`simulations/kit/flow-kit.js`](../../simulations/kit/flow-kit.js) lays the boxes on a grid you give,
draws each zone around its boxes, routes every arrow orthogonally around the boxes, and runs the predict
card, the steps, the caption, the readout and the one checkpoint. [`hybrid-agent-flow`](../../simulations/packages/hybrid-agent-flow/main.js)
is the worked example.

- **Copy the kits verbatim.** `main.js` is `flow-kit.js`, then your `SPEC`, then `FlowKit.mount(SPEC)`.
  `style.css` is `sim-kit.css`, then `flow-kit.css`, then any rules of your own. Add the sim to `ON_FLOW`
  in `simulations/tests/flow-kit.test.mjs`, `ON_KIT` in `style-kit.test.mjs` and `FIT` in
  `scripts/sim-fit.mjs`. As with the sim kit, change the kit in `simulations/kit/`, bump its version and
  recopy it everywhere in the same PR.
- **The spec.** `zones` (`id`, `title`, an optional `short` title for phones, a kit `hue`, and `in` to nest
  one zone in another), `nodes` (`id`, `label`, `sub`, `zone`, `at: [column, row]`, an optional `hue` and an optional `icon` from the kit's inline set: person, people, server, database, agent, bot, shield, chip, cloud, flow, tool, key, lock, doc, globe, chat, check),
  `edges` (`id`, `from`, `to`, an optional short `label`), `steps` (`label` for its pill, `edges` the token
  runs in order, `at` the box it stops on, `text` for the caption, an optional `readout` line), an optional
  `predict` (`question`, `options`, `answer`, `revealAt` step, `why`), the `checkpoint` (`id`, `step`), an
  `intro` caption and a one-line `legend`. A zone is the rectangle of cells around its boxes: keep other
  zones' boxes out of it. `cellWidth` sets the box width (150 px by default).
- **Hue means what the kit says.** Blue is the step you're on, so zones and boxes take the other hues:
  violet for the model, teal for code, the runtime or a tool, and orange, rose or gold as plain categories,
  named in the legend.
- **What the kit adds on its own.** Each arrow's label carries the number of the step that first runs it; the box a step reaches gets a green check when the token arrives; the steps have an Overview pill, Play (steps to the end on its own; any other control stops it) and a speed button.
- **The gate checks the drawing.** On the laptop frame (the flow kit makes the side column 300 px) the drawing must fit its 726 × 380 px column
  without being scaled down, so labels show at 12 px. Fewer rows, or a narrower `cellWidth`, if it
  doesn't. With icons, a box leaves 50 px less for its text, and on the laptop the icons must fit. Below 480 px the kit reflows the same boxes into one or two columns at full size, and the gate
  lays it out at 302 and 228 px too. Everywhere, no arrow may cross a box and every label must fit its box.
  The kit's own `check()` refuses unknown ids, shared cells and a predict answer that isn't an option.
- **Draw the whole flow.** Every step the caption describes is an arrow the token runs. Don't write in
  the caption what isn't drawn.

## Fit the screen

Most learners use a laptop. On a 1280×720 screen the browser leaves about 600 px of height for
the sim, and the LMS frame stops at 85% of the window. A sim the learner has to scroll to see
both the control they just moved and what it changed doesn't teach anything. So:

- **The whole sim fits in 600 px** at the laptop frame width (1100 px), at the start and after
  the longest run, with the caption and controls on that screen. `npm run gate` checks it in
  Chromium (`scripts/sim-fit.mjs`, which runs Step to the end or presses the primary button):
  add a new sim to its `FIT` list. The preview (`scripts/sim-preview.mjs`) is 1100 px wide too.
- **Controls beside the drawing from 900 px.** The kit (v2) makes `.panel.stage` two columns
  at 900 px and wider: the drawing (`.scroll`, `.scene` or a `.view` wrapper) on the left,
  capped at **380 px** tall, and the caption and controls in the right column. When a stage
  holds more than a caption under its drawing, wrap the left column in `.view` and the right in
  `.side`. Below 900 px it stacks: drawing, caption, controls.
- **Fold what isn't the experiment.** The predict card is a `<details class="panel predict" open>`
  with the question as its `<summary class="q">`, so the learner can fold it after answering.
  A secondary panel (a breakdown, an eval list) is a `<details class="panel more">`. Keep
  the predict question to one line at 1100 px.
- **A log scrolls in its own region.** A step log or handler list that grows with a run gets a
  `max-height` and `overflow-y: auto`, `tabindex="0"`, a role and a name, is registered as a
  `TEXT_REGION` in `simulations/tests/scroll-regions.test.mjs`, and keeps its newest or current
  row in view by setting `scrollTop` (never `scrollIntoView`, which also moves the host page).
- **No phone `min-width` on the drawing.** A fixed `min-width` forces a sideways scroll on a phone
  and a taller frame everywhere; let the SVG scale with its `viewBox` instead. Keep labels at
  a size that still reads at 360 px, or drop secondary labels there with a media query.

## The lesson around the sim

- **Lead-in:** what to predict and what to try, in the lesson's words.
- **After it:** an "Explain it" prompt, then a **"Put it together"** `<Steps>` block whose
  steps name the sim and ask for a specific setting (see `precision-and-memory`).
- One flashcard or quiz item about the sim's outcome.
- The sim's `title` in `sim.config.json` is a human title, and the lesson names it that way,
  never by its slug.

### Design checklist (must pass before promoting)

- [ ] The PO approved the concept note and the preview; the other two agents posted `APPROVE`.
- [ ] One concept; one `observe-*` checkpoint that fires once; no quests/score/modal.
- [ ] A drawing that shows the idea, not a list of rows; a predict step the learner commits to.
- [ ] The misconception is reachable in three actions or fewer.
- [ ] Self-sizing (grows to content via `sim.resize`); no clipping or runaway scroll; no page chrome.
- [ ] Fits the screen: at 1100 px wide the whole sim is at most 600 px tall, before and after a
      full run; controls and the caption sit beside the drawing; the predict card folds; any log
      scrolls in its own region.
- [ ] Matches the style guide: `style.css` starts with the sim kit, the sim's own rules use only kit
      tokens with their meanings, and the drawing is flat with kit strokes and radii; correct in light + dark.
- [ ] Every text colour reads at **4.5:1** on what it sits on, in both modes (3:1 for
      marks and lines); no text faded with `opacity`; ink on a fill is the fill's
      `*-contrast` token, never a bare `#fff`. `simulations/tests/palette-contrast.test.mjs`
      checks the token block; the hub's audit (`hyperstack/docs/audits/tools`) checks the rendered sim.
- [ ] Not colour alone: every state also has a word, an icon or a shape.
- [ ] Keyboard-only works; the verdict is in `role="status"`; the drawing has `role="img"` and
      a sentence-long `aria-label` that changes with it.
- [ ] Reduced motion (both `prefers-reduced-motion` and `init.reducedMotion`): every end state
      is reachable with no animation; nothing animates while idle or when the tab is hidden.
- [ ] Phone width (360 px): controls wrap; a wide drawing scrolls inside a focusable, named
      region (register it as a `WIDTH_GUARD` in `simulations/tests/scroll-regions.test.mjs`);
      no hover-only reveals; touch targets as close to 44 px as the layout allows.
- [ ] Plain HTML/CSS/JS, no CSS framework or CDN; classic scripts; main.js under about 25 KB.
- [ ] Deterministic; every product claim traces to the lesson or a dated doc; scripted
      numbers are labelled illustrative.
- [ ] Renders without host `init` (the 300 ms fallback), with no console errors.
- [ ] Tests in `simulations/tests/` drive the key path through `sim-dom.mjs`.

## Where it goes

```
simulations/packages/<id>/
  sim.config.json     # manifest: id, title, version, props, checkpoints
  index.html          # loads the SDK + main.js as CLASSIC scripts
  main.js             # your app logic
  style.css           # token-themed styles (copy the standard block)
```

Packages live in **this content repo**; the host↔sim **SDK** stays in the app
repo. At build, the app fetches each package and copies it + the SDK into
`public/sims/<id>/`, regenerating the registry. A copyable starter is in
[template/](template/) — it already follows the standard, so **start by copying
the template**. The SDK contract is in [reference/sdk-protocol.md](reference/sdk-protocol.md).

Embed in a lesson (default height; the sim self-resizes):

```mdx
<Simulation id="<id>" props={{ /* optional */ }} />
```

## ⚠️ The one rule that breaks sims if you get it wrong

The host iframe is `sandbox="allow-scripts"` with **no `allow-same-origin`** — an
opaque/null origin (intentional isolation). **ES module scripts are CORS-blocked
from a null origin**, so a sim using `<script type="module">` / `import` renders
**blank**. Always load the SDK and your code as **CLASSIC scripts**:

```html
<script src="./sim-sdk.js"></script>   <!-- exposes a global createSim() -->
<script src="./main.js"></script>      <!-- uses the global, no import -->
```

Never use `import` / `type="module"` in a simulation bundle.

## main.js skeleton

```js
// createSim is a global from sim-sdk.js (classic script). No imports.
const app = document.getElementById("app");
let state = /* derived from props; deterministic */;

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme; // "system" → prefers-color-scheme
}

function render() {
  app.innerHTML = `
    <div class="controls">…primary action · Reset…</div>
    <div class="viz">…</div>
    <div class="readout" role="status">…the measurable takeaway…</div>
    <div class="legend">…one line…</div>`;
  // wire listeners here
  requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 8));
}

const sim = createSim({
  onInit({ props, theme }) { applyTheme(theme); /* read props */ render(); },
});

// Fire the single checkpoint when the learner sees the insight — ONCE:
function onInsight() { sim.checkpoint("observe-x"); sim.event("did-x", {}); }

// Fallback so the bundle renders if opened directly (no host init):
setTimeout(() => { if (!sim.isInitialized()) render(); }, 300);
```

## sim.config.json

```json
{
  "id": "<id>",
  "title": "<Human title>",
  "version": "1.0.0",
  "props": { "n": { "type": "number", "default": 4 } },
  "checkpoints": [
    { "id": "observe-x", "hint": "What the learner does to see the insight." }
  ]
}
```

- `id` must equal the directory name and the embedded `<Simulation id>`.
- Prefer **one** checkpoint (`observe-*`). It feeds topic **mastery coverage**.
- Bump `version` when behavior changes (bundles are versioned in the registry).
- **Renaming a checkpoint erases learners' progress unless you say where it came from.** A checkpoint's id is part of every learner's progress key. When you rename one (or fold several into one), keep the old ids on the new checkpoint:
  ```json
  { "id": "observe-sparsity", "renamedFrom": ["quest-1", "quest-2", "quest-3"], "hint": "…" }
  ```
  A learner who completed any of the former ids keeps that coverage. The former ids must differ from the current one and from each other (content CI checks). Never reuse a former id for a different checkpoint later.

## Theming & accessibility

- Start `style.css` with the sim kit (see "One visual style") so the sim matches
  light/dark; apply `theme` from `onInit` via `dataset.theme`.
- Honor `reducedMotion` (passed to `onInit`). Visible focus ring; keyboard-operable.
- **Contrast (WCAG 1.4.3 / 1.4.11).** Text at 4.5:1 or better on its background; marks,
  lines and borders at 3:1. The template's palette meets this: in light mode muted text
  is `#475569` (not the `#64748b` many sims once used, 4.3:1 on the surface), the teal
  accent `#0f766e`, success `#15803d`, warning `#b45309`, danger `#b91c1c`; in dark
  mode muted text is `#a5b1c2` on the sims' `#0f172a`/`#1e293b`. The kit carries
  every colour a sim needs (a new one goes into the kit, not one sim); the gate's `palette-contrast` test checks every token it
  finds against the page, surface and panel in both modes (fills and line colours are
  listed there as not-text). Ink on a filled chip or button is `var(--primary-contrast)`
  (white in light, near-black in dark), never a bare `#fff`: white fails on every light
  fill in dark mode. Never fade text with `opacity` or `filter: grayscale()` to mean
  "inactive": grey the border or chrome instead. LMS-content#99 has the audit that
  found 21 sims short of this.

## Build, embed, validate

```bash
node pipeline/validate.mjs   # confirms every <Simulation id> has a package
# (the app's build copies packages + SDK into public/sims and registers them)
```

## Verify it actually renders

A sim runs in an opaque-origin iframe, so the host page can't read into it. Drive
the bundle directly at `http://localhost:3000/sims/<id>/index.html`. Check it's
**compact** (no long scroll), reads well in light + dark, and fires its one
checkpoint. If it's blank, the #1 cause is ES modules instead of classic scripts.
