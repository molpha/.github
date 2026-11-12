// Keeps a fresh GitHub Actions OIDC token in a file for the Anthropic SDK's
// workload identity federation (ANTHROPIC_IDENTITY_TOKEN_FILE). The SDK
// re-reads the file on every exchange; GitHub tokens live about 5 minutes and
// each one can be exchanged once, so the file is rewritten on a timer.
import fs from "node:fs";
import nodePath from "node:path";

const AUDIENCE = "https://api.anthropic.com";
const REFRESH_MS = 3 * 60 * 1000;

async function fetchToken() {
  const url = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const bearer = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!url || !bearer) {
    throw new Error("No GitHub OIDC endpoint: the job needs `permissions: id-token: write`.");
  }
  const res = await fetch(`${url}&audience=${encodeURIComponent(AUDIENCE)}`, {
    headers: { authorization: `Bearer ${bearer}` },
  });
  if (!res.ok) throw new Error(`GitHub OIDC token request failed: ${res.status}`);
  const { value } = await res.json();
  if (!value) throw new Error("GitHub OIDC response had no token");
  return value;
}

function writeAtomic(file, value) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, value, { mode: 0o600 });
  fs.renameSync(tmp, file);
}

/**
 * Writes the first token, points the SDK at the file, and refreshes it until
 * the process exits. Call before constructing the Anthropic client.
 * @returns {Promise<() => void>} stop function
 */
export async function startIdentityTokenFile() {
  const dir = process.env.RUNNER_TEMP || fs.mkdtempSync("/tmp/claude-review-");
  const file = nodePath.join(dir, "anthropic-identity-token");
  writeAtomic(file, await fetchToken());
  process.env.ANTHROPIC_IDENTITY_TOKEN_FILE = file;
  const timer = setInterval(() => {
    fetchToken()
      .then((value) => writeAtomic(file, value))
      .catch((err) => console.warn(`OIDC refresh failed: ${err.message}`));
  }, REFRESH_MS);
  timer.unref();
  return () => clearInterval(timer);
}
