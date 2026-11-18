#!/usr/bin/env node
// Writes one self-contained HTML page for a simulation, for the PO's preview before review
// (skills/lms-authoring-simulations/SKILL.md). The page inlines the package's style.css and
// main.js with a stand-in for the sim SDK, so it opens straight from disk or any static host.
//   node scripts/sim-preview.mjs <sim-id> > preview.html
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const id = process.argv[2];
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../simulations/packages", id ?? "");
if (!id || !/^[a-z0-9-]+$/.test(id) || !fs.existsSync(path.join(dir, "main.js"))) {
  console.error("usage: node scripts/sim-preview.mjs <sim-id>   (a folder in simulations/packages with a main.js)");
  process.exit(1);
}
const read = (f) => fs.readFileSync(path.join(dir, f), "utf8");
const config = JSON.parse(read("sim.config.json"));
const title = String(config.title).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// `</` would end the inline element early, so break it up inside the inlined code.
const inline = (text) => text.replace(/<\/(script|style)/gi, "<\\/$1");

// The SDK stand-in: the same surface main.js uses, with theme "system" and the browser's motion preference.
const stub = `function createSim(opts) {
  var inited = false;
  var sim = {
    isInitialized: function () { return inited; },
    resize: function () {},
    checkpoint: function (id) { console.log("checkpoint", id); },
    event: function (name, data) { console.log("event", name, data); },
  };
  setTimeout(function () {
    inited = true;
    opts.onInit({ props: {}, theme: "system", reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches });
  }, 0);
  return sim;
}`;

process.stdout.write(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} (preview)</title>
<style>
${inline(read("style.css"))}
#app { max-width: 760px; margin: 0 auto; }
</style>
</head>
<body>
<main id="app" aria-label="${title} simulation"></main>
<script>
${stub}
</script>
<script>
${inline(read("main.js"))}
</script>
</body>
</html>
`);
