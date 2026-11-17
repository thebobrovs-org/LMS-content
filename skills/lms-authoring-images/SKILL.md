---
name: lms-authoring-images
description: Generate and wire a topic illustration (AI image, e.g. Gemini) in the Hyperstack house style. Use when adding a static diagram/illustration to a lesson alongside or instead of a simulation. Covers the REUSABLE house-style block (palette, rendering, composition, typography — the blue→teal-on-dark brand look), the per-image subject template, the text-rendering caveat, accuracy gate, and how to wire the image into the MDX (media/ + alt text).
---

# Authoring a topic illustration

Some lessons want a **static illustration** — a labelled diagram of something the
interactive sim doesn't cover, or a hero image for a section. We generate these
with an AI image model (Gemini). The job of this skill is **consistency**: every
generated image must look like it came from the same studio as the logo, the
sims, and the UI. They all share one visual system — the **blue→teal gradient on a
dark stage**.

The method is two blocks: a **STYLE block** you paste *verbatim* into every prompt,
and a **SUBJECT block** you write fresh per image. Never edit the style block to
"tweak" one image — that's how a set drifts out of sync.

## The house style block (paste verbatim — do not edit per image)

> **Style:** Editorial technical diagram in the "Hyperstack" house style — a clean,
> modern, semi-3D dimensional illustration with the polish of a Google Cloud
> keynote slide or premium developer documentation.
> **Palette:** deep navy-to-slate background gradient (#0F172A → #1E293B); the brand
> **blue→teal gradient** (electric blue #2563EB → emerald-teal #10B981) as the
> signature accent; cool white / light-slate (#E2E8F0) for text. Use *only* these
> colors plus one warm accent (amber #F59E0B) reserved for "slow / secondary"
> elements.
> **Rendering:** matte dark hardware/abstract modules with glossy edges and a soft
> cyan rim-light glow; glowing connection lines between components; gentle ambient
> depth and subtle reflections on a dark studio stage; crisp and uncluttered, not
> photorealistic.
> **Composition:** generous negative space, strong reading flow, evenly spaced
> elements each clearly labelled, rounded 12–16px panels, translucent-blue callout
> boxes for captions.
> **Typography:** clean geometric sans-serif (Inter / Google Sans style); UPPERCASE
> for section/tier labels, sentence case for captions; perfectly spelled, high
> legibility.
> **Mood:** authoritative, calm, premium, educational — "rich but clean," soft
> studio key light with cyan rim accents on dark.
> **Avoid:** photorealism, stock-photo people, neon overload, heavy lens flare,
> busy textures, watermarks, garbled or misspelled text, any colors outside the
> palette above.

## The subject block (write this fresh per image)

State the **subject, the layout/reading flow, and the exact label + caption text**
for every element. Be explicit — the model fills gaps with hallucination.

- **Pull caption text from the lesson**, word-for-word, so the image can't contradict
  the prose. (This is the accuracy gate — see below.)
- **Color-code consistently with the sims.** In TPU diagrams: **blue = ICI**
  (chip-to-pod), **amber = DCN** (between pods). If a sim already encodes a mapping,
  the image must match it.
- Give a clear flow: bottom→top, left→right, or center-out.

A filled example lives in `template/prompt-template.md` (the "chip → tens of
thousands" scale ladder).

## Settings & consistency rules (this is what keeps a set matching)

1. **Reuse the STYLE block byte-for-byte.** Only the SUBJECT changes.
2. **Attach an anchor image.** Pick one approved output as the permanent style
   anchor and attach it to every new generation: *"Match the exact visual style,
   palette, and lighting of the attached image."* A text description drifts; an
   image reference doesn't.
3. **Fix the aspect ratio per surface** — 16:9 for inline topic images; keep it the
   same across a topic so they sit uniformly.
4. **Text is the weak spot.** Even good models garble labels. Keep labels short,
   **proofread every output letter-by-letter**, regenerate if wrong, or generate the
   art clean and add labels in a vector tool for guaranteed correctness.

## Accuracy gate (same rigor as sims and prose)

- Every label/caption must be **correct and match the lesson**. Verify, don't assume.
- If the image asserts a number or relationship the lesson doesn't, fix one of them
  — they cannot disagree.
- A beautiful image with a wrong label is a defect, not an asset.

## Wiring it into a lesson

1. Save the chosen file to **`media/<topic-or-name>.png`** (or `.webp`).
2. Embed it in the MDX with descriptive **alt text** (screen-reader + SEO):
   `![A 5-rung ladder from a single TPU chip up to a multi-pod Multislice](/media/from-chip-to-pod.png)`
   or a captioned `<figure>` if the component set supports it.
3. Prefer an image that reads on **both light and dark** (our dark-stage style does);
   if not, wrap it in a neutral frame.
4. Place it where the prose introduces the idea — usually right after the section
   heading, before or beside the related `<Simulation>`.
5. Validate (`node pipeline/validate.mjs`) and preview before shipping.

## When to use an image vs a simulation

- **Simulation** when the value is in *manipulating* something (state changes,
  sweeps, "what if"). This is the default — the platform's thesis is "learn by doing."
- **Image** when the value is in *seeing a whole structure at once* (a ladder, a
  taxonomy, a labelled anatomy, a one-glance overview). Images complement sims; they
  don't replace them.
