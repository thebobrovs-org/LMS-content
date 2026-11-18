#!/usr/bin/env node
// "Fit the screen" (skills/lms-authoring-simulations/SKILL.md): on a 1280x720 laptop the LMS frame is
// 1100 px wide and the browser leaves about 600 px of height, so a sim on the FIT list must stay within
// 600 px there, at load and after its main action has run to the end, with its caption (role="status")
// and its controls on that screen. Loads each package in Chromium with a stand-in for the sim SDK, as
// scripts/sim-preview.mjs does, from a temporary copy of the package. Run by `npm run gate`; CI installs the browser first.
//   node scripts/sim-fit.mjs [sim-id...]
// Text is measured in Inter (Debian/Ubuntu package fonts-inter), whose widths are close to the system fonts
// learners' laptops use (Segoe UI, San Francisco). Without it, Linux falls back to a much wider face (DejaVu
// Sans) and the same sim measures 10% taller, so the result would depend on the machine, not the sim.
// SIM_FIT_CHROMIUM=<path> launches that Chromium instead of Playwright's own download;
// SIM_FIT_SHOTS=<dir> saves a screenshot of each sim after its run.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const PACKAGES = path.join(path.dirname(fileURLToPath(import.meta.url)), "../simulations/packages");
export const FRAME_WIDTH = 1100;
export const SCREEN_HEIGHT = 600;
const MAX_STEPS = 40;

/** Sims held to the rule. A new sim joins when it fits; the skill's design checklist asks for it. */
export const FIT = [
  "agent-loop-stepper",
  "approval-gate-explorer",
  "capstone-architecture-explorer",
  "context-budget-explorer",
  "continuous-eval-loop",
  "customization-guarantees-flow",
  "cx-route-resolver",
  "gateway-registry-flow",
  "hybrid-agent-flow",
  "oauth-consent-pause",
  "orchestration-patterns",
  "platform-map-explorer",
  "a2a-vs-mcp-flow",
  "threat-defence-flow",
  "rag-retrieval-tuner",
  "state-scope-explorer",
  "trajectory-match-explorer",
  "workflow-vs-agent-stepper",
  "workflow-canvas-flow",
  "enterprise-data-flow",
];
/** On-kit sims still taller than the screen, each with its owner, until they're refitted and move to FIT. */
export const NOT_YET = {
  "access-boundary-explorer": "codex",
  "guardrail-visibility": "codex",
  "media-reference-explorer": "codex",
};

const SDK_STUB = `window.__events = [];
function createSim(opts) {
  var inited = false;
  var sim = {
    isInitialized: function () { return inited; },
    resize: function () {},
    checkpoint: function (id) { window.__events.push(["checkpoint", id]); },
    event: function (name) { window.__events.push(["event", name]); },
  };
  setTimeout(function () { inited = true; opts.onInit({ props: {}, theme: "light", reducedMotion: true }); }, 0);
  return sim;
}`;

/** A copy of the package with the SDK stand-in as its sim-sdk.js, opened as its own index.html. */
function stage(id, root) {
  const dir = fs.mkdtempSync(path.join(root, `${id}-`));
  for (const f of fs.readdirSync(path.join(PACKAGES, id))) fs.copyFileSync(path.join(PACKAGES, id, f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, "sim-sdk.js"), SDK_STUB);
  return pathToFileURL(path.join(dir, "index.html")).href;
}

/** The sim's height, and the bottom of its caption and its controls, in the page as it stands. */
const MEASURE = () => {
  const bottom = (el) => (el ? el.getBoundingClientRect().bottom + scrollY : null);
  const status = document.querySelector('[role="status"]');
  const controls = [...document.querySelectorAll(".controls")];
  return {
    height: document.body.scrollHeight,
    caption: bottom(status),
    controls: controls.length ? Math.max(...controls.map(bottom)) : null,
  };
};

/** Runs the sim's main action: Step until it stops changing anything (a stepper), or else the primary button once. */
async function runToEnd(p) {
  if (!(await p.$("#step"))) {
    const primary = await p.$("button.primary");
    if (primary) await primary.click();
    await p.waitForTimeout(50);
    return;
  }
  for (let i = 0; i < MAX_STEPS; i++) {
    const step = await p.$("#step:not([disabled])");
    if (!step) return;
    const before = await p.evaluate(() => document.body.innerHTML);
    await step.click();
    await p.waitForTimeout(50);
    if ((await p.evaluate(() => document.body.innerHTML)) === before) return;
  }
}

export function problems(id, when, m) {
  const out = [];
  if (m.height > SCREEN_HEIGHT) out.push(`${id} (${when}): ${m.height} px tall, over ${SCREEN_HEIGHT}`);
  if (m.caption === null) out.push(`${id}: no role="status" caption`);
  else if (m.caption > SCREEN_HEIGHT) out.push(`${id} (${when}): the caption ends at ${Math.round(m.caption)} px, below the screen`);
  if (m.controls !== null && m.controls > SCREEN_HEIGHT) out.push(`${id} (${when}): the controls end at ${Math.round(m.controls)} px, below the screen`);
  return out;
}

/** A fontconfig file that makes the sans-serif families the sims ask for resolve to Inter. */
function fontConfig(root) {
  const families = ["system-ui", "ui-sans-serif", "-apple-system", "Segoe UI", "Roboto", "sans-serif", "sans"];
  // prepend_first puts Inter ahead of whatever the system's own rules already put first (an <alias> would land behind them).
  const alias = (f) => `<match target="pattern"><test name="family" qual="any"><string>${f}</string></test><edit name="family" mode="prepend_first" binding="strong"><string>Inter</string></edit></match>`;
  const file = path.join(root, "fonts.conf");
  fs.writeFileSync(file, `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig><include ignore_missing="yes">/etc/fonts/fonts.conf</include>${families.map(alias).join("")}</fontconfig>\n`);
  return file;
}

function hasInter() {
  try {
    return /\bInter\b/.test(execFileSync("fc-list", [":family=Inter", "family"], { encoding: "utf8" }));
  } catch {
    return false;
  }
}

async function main() {
  if (!hasInter()) {
    console.error("sim-fit measures text in Inter: install it first (apt-get install fonts-inter).");
    process.exit(1);
  }
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : FIT;
  const failures = [];
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sim-fit-"));
  const env = { ...process.env, FONTCONFIG_FILE: fontConfig(root) };
  const browser = await chromium.launch({ env, ...(process.env.SIM_FIT_CHROMIUM ? { executablePath: process.env.SIM_FIT_CHROMIUM } : {}) });
  try {
    for (const id of ids) {
      const p = await browser.newPage({ viewport: { width: FRAME_WIDTH, height: 720 }, reducedMotion: "reduce" });
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(stage(id, root));
      await p.waitForTimeout(100);
      const start = await p.evaluate(MEASURE);
      await runToEnd(p);
      const end = await p.evaluate(MEASURE);
      if (process.env.SIM_FIT_SHOTS) await p.screenshot({ path: path.join(process.env.SIM_FIT_SHOTS, `${id}.png`), fullPage: true });
      const found = [...problems(id, "at load", start), ...problems(id, "after a run", end), ...errors.map((e) => `${id}: ${e}`)];
      console.log(`${found.length ? "✖" : "✔"} ${id}: ${start.height} px at load, ${end.height} px after a run`);
      failures.push(...found);
      await p.close();
    }
  } finally {
    await browser.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
  for (const id of Object.keys(NOT_YET)) console.log(`· ${id}: not yet held to the rule (${NOT_YET[id]})`);
  if (failures.length) {
    console.error(`\n${failures.join("\n")}\n\nSee "Fit the screen" in skills/lms-authoring-simulations/SKILL.md.`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
