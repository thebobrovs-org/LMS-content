#!/usr/bin/env node
/**
 * Compiles a BentoFlowSpec JSON file into a standard LMS simulation package
 * under simulations/packages/<id>/ with sim-sdk.js, dark-mode, reduced-motion,
 * and checkpoint integration.
 *
 * Usage:
 *   node scripts/compile-bentoflow.mjs <flow.json> <sim-id>
 */
import fs from "node:fs";
import path from "node:path";
import { compileBentoFlow } from "../simulations/bentoflow/packages/core/src/index.ts";
import { buildPlayableLmsHtml } from "../simulations/bentoflow/packages/player/src/index.ts";

const [flowPath, simId] = process.argv.slice(2);
if (!flowPath || !simId) {
  console.error("Usage: node scripts/compile-bentoflow.mjs <flow.json> <sim-id>");
  process.exit(1);
}

const spec = JSON.parse(fs.readFileSync(flowPath, "utf8"));
const compiled = compileBentoFlow(spec);
const fullHtml = buildPlayableLmsHtml(compiled, { flowId: simId, compactInline: true });

// Extract <style>, <body> inner HTML, and <script> from the standalone player HTML
const styleMatch = /<style>([\s\S]*?)<\/style>/.exec(fullHtml);
const bodyMatch = /<body>([\s\S]*?)<script>/.exec(fullHtml);
const scriptMatch = /<script>([\s\S]*?)<\/script>/.exec(fullHtml);

if (!styleMatch || !bodyMatch || !scriptMatch) {
  throw new Error("Failed to split BentoFlow player HTML into style/body/script.");
}

const rawCss = styleMatch[1].trim();
const bodyHtml = bodyMatch[1].trim();
const rawJs = scriptMatch[1].trim();

const pkgDir = path.join(process.cwd(), "simulations", "packages", simId);
fs.mkdirSync(pkgDir, { recursive: true });

const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// 1. index.html (classic script loading sim-sdk.js + main.js, no inline scripts/styles)
const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escAttr(spec.title)}</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main id="app" aria-label="${escAttr(spec.title)} simulation">
${bodyHtml}
    </main>
    <script src="./sim-sdk.js"></script>
    <script src="./main.js"></script>
  </body>
</html>
`;

// 2. style.css (with LMS [data-theme="light"] / [data-theme="dark"] tokens & reduced-motion support)
const styleCss = `:root {
  --bg: #ffffff;
  --fg: #0f172a;
  --muted: #475569;
  --surface: #f8fafc;
  --border: #e2e8f0;
  --primary: #2563eb;
  --primary-contrast: #ffffff;
  --accent: #0f766e;
  --danger: #b91c1c;
}
[data-theme="light"] {
  --bg: #ffffff;
  --fg: #0f172a;
  --muted: #475569;
  --surface: #f8fafc;
  --border: #e2e8f0;
  --primary: #2563eb;
  --primary-contrast: #ffffff;
  --accent: #0f766e;
  --danger: #b91c1c;
}
[data-theme="dark"] {
  --bg: #1a1a1a;
  --fg: #e5e7eb;
  --muted: #9ca3af;
  --surface: #242424;
  --border: #2e2e2e;
  --primary: #60a5fa;
  --primary-contrast: #0b1220;
  --accent: #2dd4bf;
  --danger: #f87171;
}

${rawCss}

body {
  background: transparent;
  color: var(--fg);
}
.bf-player-shell {
  background: var(--bg);
  border-color: var(--border);
}
.bf-topbar,
.bf-narration-dock {
  background: var(--surface);
  border-color: var(--border);
}
.bf-pill,
.bf-btn {
  background: var(--bg);
  border-color: var(--border);
  color: var(--fg);
}
.bf-btn-primary,
.bf-pill.active {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--primary-contrast);
}
.bf-narration-title {
  color: var(--fg);
}
.bf-narration-body {
  color: var(--muted);
}
.bf-stage {
  background: #ffffff;
}
@media (prefers-reduced-motion: reduce) {
  .bf-card, .bf-edge, .bf-card-ring, .bf-pill, .bf-btn {
    transition: none !important;
  }
}
`;

// 3. main.js (classic IIFE + window.createSim bridge + visibility pause)
const mainJs = `(function () {
  var sim = typeof window.createSim === "function"
    ? window.createSim({
        onInit: function (opts) {
          var theme = (opts && opts.theme) || "system";
          if (theme === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
            theme = "dark";
          }
          document.documentElement.dataset.theme = theme;
          if (opts && opts.reducedMotion) {
            document.documentElement.dataset.reducedMotion = "true";
          }
          notifyResize();
        },
      })
    : null;

  function notifyResize() {
    if (!sim) return;
    requestAnimationFrame(function () {
      sim.resize(document.documentElement.scrollHeight);
    });
  }

  ${rawJs}

  // Bridge completion badge & visibility pause to LMS sim-sdk
  var badge = document.getElementById("bf-complete-badge");
  if (badge && sim && typeof MutationObserver !== "undefined") {
    var doneSent = false;
    new MutationObserver(function () {
      if (!doneSent && badge.classList.contains("visible")) {
        doneSent = true;
        sim.checkpoint("complete");
      }
      notifyResize();
    }).observe(badge, { attributes: true, attributeFilter: ["class"] });
  }

  var dock = document.querySelector(".bf-narration-dock");
  if (dock && sim && typeof MutationObserver !== "undefined") {
    new MutationObserver(notifyResize).observe(dock, { childList: true, subtree: true, characterData: true });
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden && typeof playing !== "undefined" && playing) {
      var playBtn = document.getElementById("bf-play");
      if (playBtn) playBtn.click();
    }
  });

  window.addEventListener("load", notifyResize);
})();
`;

// 4. sim.config.json
const simConfig = {
  id: simId,
  title: spec.title,
  version: "1.0.0",
  props: {},
  checkpoints: [
    {
      id: "complete",
      hint: "Simulate or step through all paths in the diagram.",
    },
  ],
};

fs.writeFileSync(path.join(pkgDir, "index.html"), indexHtml);
fs.writeFileSync(path.join(pkgDir, "style.css"), styleCss);
fs.writeFileSync(path.join(pkgDir, "main.js"), mainJs);
fs.writeFileSync(path.join(pkgDir, "sim.config.json"), JSON.stringify(simConfig, null, 2) + "\n");

console.log(`Compiled BentoFlow simulation '${simId}' -> simulations/packages/${simId}/`);
console.log(`Spatial report:`, JSON.stringify(compiled.report));
