// Unified-diff helpers for GitHub pull request file patches.

/**
 * Returns the new-file (RIGHT side) line numbers that appear in a patch,
 * as added or context lines. GitHub accepts review comments only on these.
 * @param {string | undefined} patch
 * @returns {Set<number>}
 */
export function commentableLines(patch) {
  const lines = new Set();
  if (!patch) return lines;
  let next = 0;
  let inHunk = false;
  for (const raw of patch.split("\n")) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      next = Number(hunk[1]);
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (raw.startsWith("+")) {
      lines.add(next);
      next += 1;
    } else if (raw.startsWith("-")) {
      // removed line: no new-file line number
    } else if (raw.startsWith("\\")) {
      // "\ No newline at end of file"
    } else {
      // context line (leading space, or an empty line inside a hunk)
      lines.add(next);
      next += 1;
    }
  }
  return lines;
}

/**
 * Prefixes each patch line with its new-file line number, so the model can
 * cite exact RIGHT-side lines. Removed lines get a "-" marker instead.
 * @param {string | undefined} patch
 * @returns {string}
 */
export function numberPatch(patch) {
  if (!patch) return "";
  const out = [];
  let next = 0;
  let inHunk = false;
  for (const raw of patch.split("\n")) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      next = Number(hunk[1]);
      inHunk = true;
      out.push(raw);
      continue;
    }
    if (!inHunk || raw.startsWith("\\")) {
      out.push(raw);
    } else if (raw.startsWith("-")) {
      out.push(`     ${raw}`);
    } else {
      out.push(`${String(next).padStart(4)} ${raw}`);
      next += 1;
    }
  }
  return out.join("\n");
}
