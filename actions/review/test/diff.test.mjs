import assert from "node:assert/strict";
import { test } from "node:test";
import { commentableLines, numberPatch } from "../src/diff.mjs";

const patch = [
  "@@ -1,4 +1,5 @@",
  " a",
  "-b",
  "+B",
  "+C",
  " d",
  "\\ No newline at end of file",
  "@@ -10,2 +11,2 @@ func x()",
  " k",
  "-l",
  "+L",
].join("\n");

test("commentable lines are added and context lines on the new side", () => {
  assert.deepEqual([...commentableLines(patch)].sort((x, y) => x - y), [1, 2, 3, 4, 11, 12]);
});

test("missing patch has no commentable lines", () => {
  assert.equal(commentableLines(undefined).size, 0);
});

test("numbered patch carries new-file line numbers", () => {
  const out = numberPatch(patch).split("\n");
  assert.equal(out[1], "   1  a");
  assert.equal(out[2], "     -b");
  assert.equal(out[3], "   2 +B");
  assert.equal(out[10], "  12 +L");
});
