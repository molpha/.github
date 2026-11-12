// Read-only access to the checked-out repository, confined to its root.
import { execFile } from "node:child_process";
import fs from "node:fs";
import nodePath from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export const MAX_READ_LINES = 1500;
export const MAX_OUTPUT_CHARS = 120_000;

/**
 * Resolves a model-supplied path inside `root`. Throws if it escapes the
 * root (lexically or through a symlink) or points into `.git`.
 * @param {string} root absolute, canonical repository root
 * @param {string} p untrusted relative path
 */
export function resolveInside(root, p) {
  const target = nodePath.resolve(root, p);
  const rel = nodePath.relative(root, target);
  if (rel === ".." || rel.startsWith(`..${nodePath.sep}`) || nodePath.isAbsolute(rel)) {
    throw new Error("path escapes the repository root");
  }
  if (rel === ".git" || rel.startsWith(`.git${nodePath.sep}`)) {
    throw new Error("the .git directory is not readable");
  }
  if (fs.existsSync(target)) {
    const real = fs.realpathSync(target);
    const realRel = nodePath.relative(root, real);
    if (realRel === ".." || realRel.startsWith(`..${nodePath.sep}`) || nodePath.isAbsolute(realRel)) {
      throw new Error("path resolves outside the repository root");
    }
  }
  return target;
}

function clip(text) {
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  return `${text.slice(0, MAX_OUTPUT_CHARS)}\n[output truncated at ${MAX_OUTPUT_CHARS} characters; narrow the request]`;
}

/** @param {string} root @param {{path: string, start_line?: number, end_line?: number}} args */
export function readFile(root, { path, start_line, end_line }) {
  const target = resolveInside(root, path);
  const stat = fs.statSync(target, { throwIfNoEntry: false });
  if (!stat) return `No such file: ${path}`;
  if (stat.isDirectory()) return `${path} is a directory; use list_files.`;
  const lines = fs.readFileSync(target, "utf8").split("\n");
  const start = Math.max(1, start_line ?? 1);
  const end = Math.min(lines.length, end_line ?? start + MAX_READ_LINES - 1, start + MAX_READ_LINES - 1);
  const body = lines
    .slice(start - 1, end)
    .map((line, i) => `${String(start + i).padStart(5)}  ${line}`)
    .join("\n");
  const tail = end < lines.length ? `\n[lines ${start}-${end} of ${lines.length}; request more with start_line]` : "";
  return clip(body + tail);
}

/** @param {string} root @param {{dir?: string}} args */
export async function listFiles(root, { dir }) {
  const where = dir ? nodePath.relative(root, resolveInside(root, dir)) || "." : ".";
  const { stdout } = await run("git", ["ls-files", "--", where], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
  const files = stdout.split("\n").filter(Boolean);
  const shown = files.slice(0, 500);
  const more = files.length > shown.length ? `\n[${files.length - shown.length} more files; narrow dir]` : "";
  return shown.join("\n") + more || `No tracked files under ${where}`;
}

/** @param {string} root @param {{pattern: string, path?: string, fixed_string?: boolean}} args */
export async function search(root, { pattern, path, fixed_string }) {
  const where = path ? nodePath.relative(root, resolveInside(root, path)) || "." : ".";
  const args = ["grep", "-n", "-I", "--no-color", fixed_string ? "-F" : "-E", "-e", pattern, "--", where];
  try {
    const { stdout } = await run("git", args, { cwd: root, maxBuffer: 32 * 1024 * 1024 });
    const lines = stdout.split("\n").filter(Boolean);
    const shown = lines.slice(0, 300);
    const more = lines.length > shown.length ? `\n[${lines.length - shown.length} more matches; narrow the pattern or path]` : "";
    return clip(shown.join("\n") + more);
  } catch (err) {
    // git grep exits 1 when nothing matches
    if (err && typeof err === "object" && "code" in err && err.code === 1) return "No matches.";
    throw err;
  }
}

/**
 * Returns a file's content at a commit, or null if absent.
 * @param {string} root @param {string} sha @param {string} file
 */
export async function showAt(root, sha, file) {
  try {
    const { stdout } = await run("git", ["show", `${sha}:${file}`], { cwd: root, maxBuffer: 8 * 1024 * 1024 });
    return stdout;
  } catch {
    return null;
  }
}
