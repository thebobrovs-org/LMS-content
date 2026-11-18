// scripts/sim-fit.mjs: what counts as not fitting, and its lists name real packages. The browser run itself
// is its own gate step.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { FIT, NOT_YET, SCREEN_HEIGHT, problems } from "./sim-fit.mjs";

const PACKAGES = path.join(path.dirname(fileURLToPath(import.meta.url)), "../simulations/packages");

test("a sim that fits has no problems", () => {
  assert.deepEqual(problems("s", "at load", { height: SCREEN_HEIGHT, caption: 300, controls: 500 }), []);
  assert.deepEqual(problems("s", "at load", { height: 400, caption: 200, controls: null }), []);
});

test("too tall, a caption or controls below the screen, or no caption, are each reported", () => {
  assert.equal(problems("s", "after a run", { height: SCREEN_HEIGHT + 1, caption: 300, controls: 500 }).length, 1);
  assert.match(problems("s", "at load", { height: 500, caption: 640, controls: 500 })[0], /caption/);
  assert.match(problems("s", "at load", { height: 500, caption: 300, controls: 650 })[0], /controls/);
  assert.match(problems("s", "at load", { height: 500, caption: null, controls: 300 })[0], /role="status"/);
});

test("every listed sim is a package, listed once", () => {
  const all = [...FIT, ...Object.keys(NOT_YET)];
  assert.equal(new Set(all).size, all.length);
  for (const id of all) assert.ok(fs.existsSync(path.join(PACKAGES, id, "main.js")), id);
});
