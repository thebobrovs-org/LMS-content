// Tests for the YAML-only frontmatter parser (run by `npm run gate`).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import matter from "gray-matter";
import { parseFrontmatter } from "./frontmatter.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

test("YAML frontmatter parses as before", () => {
  const { data, content } = parseFrontmatter("---\ntitle: Arrays\nlevel: 100\n---\n# Body\n", "t.mdx");
  assert.deepEqual(data, { title: "Arrays", level: 100 });
  assert.equal(content.trim(), "# Body");
});

test("code-language frontmatter is rejected and never evaluated", () => {
  const src = '---js\n{ title: (globalThis.__FRONTMATTER_RAN = true, "x") }\n---\nbody';
  assert.throws(() => parseFrontmatter(src, "topics/x.mdx"), /topics\/x\.mdx: frontmatter must be YAML/);
  assert.equal(globalThis.__FRONTMATTER_RAN, undefined);
});

test("positive control: gray-matter's defaults would have run it", () => {
  const src = '---js\n{ title: (globalThis.__FRONTMATTER_CONTROL = true, "x") }\n---\nbody';
  matter(src);
  assert.equal(globalThis.__FRONTMATTER_CONTROL, true);
  delete globalThis.__FRONTMATTER_CONTROL;
});

test("every non-YAML language is rejected", () => {
  for (const lang of ["javascript", "JS", "coffee", "json", "toml", "python"]) {
    assert.throws(() => parseFrontmatter(`---${lang}\n{}\n---\n`, "t.mdx"), /t\.mdx:/, lang);
  }
});

test("nothing parses frontmatter except through parseFrontmatter", () => {
  const offenders = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".git"].includes(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(m?js|ts)$/.test(e.name) && !e.name.endsWith(".test.mjs") && p !== path.join(root, "pipeline", "frontmatter.mjs")) {
        if (/from ["']gray-matter["']|require\(["']gray-matter["']\)/.test(fs.readFileSync(p, "utf8"))) offenders.push(path.relative(root, p));
      }
    }
  })(root);
  assert.deepEqual(offenders, []);
});
