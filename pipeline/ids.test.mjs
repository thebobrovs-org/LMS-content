import { test } from "node:test";
import assert from "node:assert/strict";
import { fnv1a, itemHash, stepHash } from "./ids.mjs";

test("the hash is the app's: FNV-1a 32-bit, base36, deterministic, and sensitive to every character", () => {
  // The app keys `<topicId>#<fnv1a(prompt)>` and `step:<topicId>:<fnv1a(title)>` (LMS/lib/srs/id.ts).
  assert.equal(fnv1a(""), (0x811c9dc5 >>> 0).toString(36)); // the FNV offset basis, untouched
  // Fixed vectors (FNV-1a 32-bit of the UTF-16 code units, computed independently): a changed prime, basis, or
  // character encoding fails here. "a" is the reference vector 0xe40c292c; the others exercise multi-byte units.
  assert.equal(fnv1a("a"), (0xe40c292c).toString(36));
  assert.equal(fnv1a("a"), "1r9wi7g");
  assert.equal(fnv1a("Hello, world"), "15ason1");
  assert.equal(fnv1a("naïve ∑ 日本"), "1xiuzfw"); // code units, not bytes: what the app's charCodeAt hashes
  assert.equal(fnv1a("What does FLOPs stand for?"), "14ty5q");
  assert.equal(fnv1a("a"), fnv1a("a"));
  assert.notEqual(fnv1a("a"), fnv1a("b"));
  assert.notEqual(fnv1a("Cost?"), fnv1a("Cost? "));
  assert.match(fnv1a("Which 16-bit float overflows to infinity past ~65,504, and why?"), /^[0-9a-z]{1,7}$/);
  assert.equal(itemHash("x"), fnv1a("x"));
  assert.equal(stepHash("x"), fnv1a("x"));
});
