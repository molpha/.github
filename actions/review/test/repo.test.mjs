import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import nodePath from "node:path";
import { test } from "node:test";
import { readFile, resolveInside } from "../src/repo.mjs";

const root = fs.realpathSync(fs.mkdtempSync(nodePath.join(os.tmpdir(), "review-test-")));
fs.writeFileSync(nodePath.join(root, "f.txt"), "one\ntwo\nthree\n");
fs.mkdirSync(nodePath.join(root, ".git"));
const outside = fs.realpathSync(fs.mkdtempSync(nodePath.join(os.tmpdir(), "review-outside-")));
fs.symlinkSync(outside, nodePath.join(root, "link"));

test("paths inside the root resolve", () => {
  assert.equal(resolveInside(root, "f.txt"), nodePath.join(root, "f.txt"));
});

test("parent traversal and absolute paths are rejected", () => {
  assert.throws(() => resolveInside(root, "../etc/passwd"));
  assert.throws(() => resolveInside(root, "/etc/passwd"));
});

test(".git is not readable", () => {
  assert.throws(() => resolveInside(root, ".git/config"));
});

test("symlinks out of the root are rejected", () => {
  assert.throws(() => resolveInside(root, "link"));
});

test("read_file numbers lines and honours ranges", () => {
  assert.equal(readFile(root, { path: "f.txt", start_line: 2, end_line: 2 }), "    2  two\n[lines 2-2 of 4; request more with start_line]");
});
