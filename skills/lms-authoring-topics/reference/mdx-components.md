# MDX component catalog

The whitelisted components available in a lesson body (defined in
`components/mdx/`). Authors use these declarative tags only — arbitrary scripts
are not available, and MDX is compiled from trusted, reviewed content.

## `<Simulation>`

Embeds an interactive simulation in a sandboxed iframe.

```mdx
<Simulation id="hash-collision" height={420} props={{ buckets: 8 }} />
```

| Prop | Type | Notes |
|------|------|-------|
| `id` | string (required) | Must be a package in `simulations/packages/<id>/`. |
| `height` | number | Initial iframe height in px (default 420); the sim resizes itself to fit. |
| `props` | object | Passed to the sim's `onInit` (see its `sim.config.json` `props`). |

Reaching a simulation's checkpoint records a progress checkpoint that counts
toward topic mastery. To author a new simulation, see the
`lms-authoring-simulations` skill.

## `<YouTube>`

Privacy-friendly, lazy video — renders a thumbnail facade until clicked, then
loads `youtube-nocookie`.

```mdx
<YouTube id="dQw4w9WgXcQ" start={90} title="Hashing explained" />
```

| Prop | Type | Notes |
|------|------|-------|
| `id` | string (required) | YouTube video id. |
| `start` | number | Start time in seconds. |
| `title` | string | Accessible label. |

## Code blocks

Use fenced code with a **language** for syntax highlighting (Shiki, build-time,
themed for light/dark; a copy button appears on hover). Always set the language.

````mdx
```python title="inspect_topology.py"
import jax
print(len(jax.devices()), "TPU chips")
```
````

- Supported languages include `python`, `js`, `ts`, `tsx`, `bash`/`sh`, `json`,
  `yaml`, and more (Shiki loads them on demand).
- `title="…"` (optional) renders a small filename chip above the block.
- Inline `code` (single backticks) stays plain monospace — use it for terms,
  identifiers, and Big-O, not multi-line code.

## Images: `<Figure>` and Markdown `![alt](src)`

Put image files in **`media/…`** and reference them as **`/media/…`**.
External URLs work too. Prefer **SVG** for diagrams (crisp, small); give diagrams a
solid light panel so they read in dark mode.

Use `<Figure>` when you want a caption or a constrained width (`alt` is required):

```mdx
<Figure
  src="/media/array-memory.svg"
  alt="Five contiguous array cells labelled with indices and addresses."
  caption="An array's elements sit in one contiguous block."
  width={520}
/>
```

| Prop | Type | Notes |
|------|------|-------|
| `src` | string (required) | `/media/…` (a file in `media/`) or an absolute URL. |
| `alt` | string (required) | Describe the content for screen readers — not "image of …". |
| `caption` | string | Shown under the image. |
| `credit` | string | Optional attribution, appended to the caption. |
| `width` | number | Max width in px (defaults to the reading column). |

A bare Markdown image also works and is auto-styled (framed, kept inside the
reading column) — use it for simple cases:

```mdx
![Five contiguous array cells labelled with indices and addresses](/media/array-memory.svg)
```

Always write meaningful `alt` text. Lazy-loading is automatic.

## `<Tip>` (inline hover/tap glossary bubble)

An inline term with a small bubble (on hover, keyboard focus, **and** tap) holding
a short explanation and an optional link. Use for **supplementary** asides —
defining a term in passing — never for essential content or required navigation.

```mdx
Resolve collisions with <Tip text="Each bucket holds a small list of colliding keys.">chaining</Tip>
or <Tip text="Probe to the next free slot instead." href="https://en.wikipedia.org/wiki/Open_addressing" linkLabel="Read more">open addressing</Tip>.
```

| Prop | Type | Notes |
|------|------|-------|
| children | inline text (required) | The visible term. |
| `text` | string (required) | The bubble's explanation. Keep it to a sentence or two. |
| `href` | string | Optional link shown in the bubble (opens in a new tab). |
| `linkLabel` | string | Link text (default "Learn more"). |

It's WCAG 1.4.13-compliant (dismissible with Esc, hoverable, persistent) and
keyboard/touch accessible. In MDX prose, wrap surrounding spaces with `{" "}` so
they aren't collapsed, e.g. `like{" "}<Tip …>chaining</Tip>{" "}or …`.

## `<Term>` (shared-glossary tip)

Like `<Tip>`, but the definition lives in a **per-path glossary** (`glossary/<pathId>.json`)
and **reused** everywhere — so a term's explanation stays consistent. Prefer
`<Term>` over `<Tip>` for anything that recurs across lessons.

```mdx
…resolve collisions with <Term>chaining</Term> or <Term>open addressing</Term>.
…each chip has six <Term id="ici">ICI</Term> links…
```

- Lookup key = the inner text, lowercased — or an explicit `id` when the shown
  text differs from the key (e.g. `<Term id="ici">ICI</Term>`).
- Define terms in the relevant path glossary `glossary/<pathId>.json`:
  ```json
  { "open addressing": { "definition": "Probe to the next free slot…", "href": "https://…", "linkLabel": "Read more" } }
  ```
- A `<Term>` must resolve in the glossary of a path that contains the topic (CI checks this). Each path's terms list on `/paths/<id>/glossary`.

Use `<Tip text="…">` for a one-off, lesson-specific aside; use `<Term>` for shared
vocabulary.

## `<Callout>`

Styled aside. Color is always reinforced with a text label.

```mdx
<Callout type="warning">Past a load factor of ~0.7, collisions get frequent.</Callout>
```

`type`: `tip` (green) | `note` (blue) | `warning` (amber). Defaults to `note`.

## `<Flashcard>`

Inline active-recall card: reveal → self-grade (Again/Hard/Good/Easy) → scheduled
by SM-2. Also authorable in frontmatter (`flashcards:`); inline lets you place a
check right after the relevant prose or simulation.

```mdx
<Flashcard front="Average lookup time of a hash table?" back="O(1) on average." />
```

## `<Quiz>`

Inline multiple-choice; correctness auto-grades into the spaced-repetition engine
(right → scheduled forward, wrong → soon). Also authorable in frontmatter
(`quiz:`).

```mdx
<Quiz
  question="What degrades hash-table performance?"
  choices={["High load factor with poor collision handling", "Integer keys", "Too few keys"]}
  answer={0}
  explanation="As the load factor rises, operations approach O(n)."
/>
```

## `<Steps>` / `<Step>`

A numbered, sequential walkthrough. Each `<Step>` has a `title`; completing it
records a checkpoint that feeds topic mastery coverage. `<Steps>` shows "X/N done".

```mdx
<Steps>
<Step title="Insert two colliding keys in the simulation">
Type `ab` then `ba` and watch them land in the same bucket.
</Step>
<Step title="Predict the next collision">
Before inserting, say which bucket a new key will hit, then verify.
</Step>
</Steps>
```

Step ids derive from a hash of the **title**, so keep titles stable once published
(changing a title resets that step's completion). Titles may contain apostrophes.
