// Reviews one pull request with the Claude API and posts a single review.
//
// Inputs (environment):
//   GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_EVENT_PATH  set by Actions
//   REVIEW_PR            PR number (defaults to the event's pull request)
//   REVIEW_MODEL         Claude model ID
//   REVIEW_EFFORT        low | medium | high | xhigh | max
//   REVIEW_MAX_ITERATIONS
//   ANTHROPIC_FEDERATION_RULE_ID, ANTHROPIC_ORGANIZATION_ID,
//   ANTHROPIC_SERVICE_ACCOUNT_ID, ANTHROPIC_WORKSPACE_ID  workload identity federation
import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { commentableLines, numberPatch } from "./diff.mjs";
import { GitHub } from "./github.mjs";
import { startIdentityTokenFile } from "./oidc.mjs";
import { SYSTEM, repoRules } from "./prompt.mjs";
import { listFiles, readFile, search, showAt } from "./repo.mjs";

const MARKER = "<!-- molpha-claude-review -->";
const BOT_LOGIN = "github-actions[bot]";
const DIFF_BUDGET_CHARS = 300_000;
const GUIDANCE_FILES = ["CLAUDE.md", "AGENTS.md", "REVIEW.md"];
const GUIDANCE_MAX_CHARS = 40_000;

const SubmitInput = z.object({
  summary: z.string().describe("Two to five sentences: what the PR does and the overall assessment"),
  findings: z.array(
    z.object({
      path: z.string(),
      line: z.number().int().min(1).describe("Line number in the new version of the file"),
      severity: z.enum(["bug", "security", "risk", "nit"]),
      title: z.string().describe("One line"),
      body: z.string().describe("What is wrong, the concrete failure, and the fix"),
    }),
  ),
});

function env(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing environment variable ${name}`);
  }
  return v;
}

function prNumber() {
  const explicit = process.env.REVIEW_PR;
  if (explicit) return Number(explicit);
  const event = JSON.parse(fs.readFileSync(env("GITHUB_EVENT_PATH"), "utf8"));
  const n = event.pull_request?.number;
  if (!n) throw new Error("not a pull_request event and REVIEW_PR is not set");
  return n;
}

function summaryLine(text) {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
  console.log(text);
}

async function main() {
  const root = fs.realpathSync(process.cwd());
  const repo = env("GITHUB_REPOSITORY");
  const gh = new GitHub(env("GITHUB_TOKEN"), repo);
  const n = prNumber();
  const model = env("REVIEW_MODEL", "claude-sonnet-5-5");
  const effort = env("REVIEW_EFFORT", "medium");
  const maxIterations = Number(env("REVIEW_MAX_ITERATIONS", "30"));

  const pr = await gh.pull(n);
  if (pr.state !== "open" || pr.draft) {
    summaryLine(`Skipped: PR #${n} is ${pr.draft ? "a draft" : pr.state}.`);
    return;
  }
  const headSha = pr.head.sha;
  const baseSha = pr.base.sha;

  const files = await gh.files(n);
  /** @type {Map<string, {patch?: string, lines: Set<number>}>} */
  const byPath = new Map(files.map((f) => [f.filename, { patch: f.patch, lines: commentableLines(f.patch) }]));

  const guidance = [];
  for (const file of GUIDANCE_FILES) {
    const text = await showAt(root, baseSha, file);
    if (text) guidance.push({ file, text: text.slice(0, GUIDANCE_MAX_CHARS) });
  }

  const earlier = (await gh.reviewComments(n))
    .filter((c) => c.user?.login === BOT_LOGIN && c.body?.includes(MARKER))
    .map((c) => `- ${c.path}:${c.line ?? c.original_line}: ${c.body.replace(MARKER, "").trim().split("\n")[0].slice(0, 200)}`);
  const reviewedBefore = (await gh.reviews(n)).some((r) => r.user?.login === BOT_LOGIN && r.body?.includes(MARKER));

  // Build the user message: PR metadata, the numbered diff within budget, earlier findings.
  let budget = DIFF_BUDGET_CHARS;
  const diffParts = [];
  const omitted = [];
  for (const f of files) {
    const header = `### ${f.filename} (${f.status}, +${f.additions} -${f.deletions})`;
    if (!f.patch) {
      diffParts.push(`${header}\n[no textual diff: binary, too large, or rename only]`);
      continue;
    }
    const numbered = numberPatch(f.patch);
    if (numbered.length > budget) {
      omitted.push(f.filename);
      continue;
    }
    budget -= numbered.length;
    diffParts.push(`${header}\n\`\`\`diff\n${numbered}\n\`\`\``);
  }
  const userText = [
    `Review pull request #${n} in ${repo}.`,
    `<pr_title>${pr.title}</pr_title>`,
    `<pr_description>\n${(pr.body ?? "").slice(0, 8000)}\n</pr_description>`,
    `Base ${pr.base.ref} (${baseSha.slice(0, 7)}), head ${pr.head.ref} (${headSha.slice(0, 7)}). The working tree is the head commit.`,
    `Changed files: ${files.length}. In the diffs below, each line in the new file carries its line number; removed lines have none.`,
    diffParts.join("\n\n"),
    omitted.length ? `Diffs not shown here to save space (use get_file_diff): ${omitted.join(", ")}` : "",
    earlier.length
      ? `Findings this reviewer already posted on earlier commits. Do not repeat them; report one again only if the latest changes make it worse:\n${earlier.join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  /** @type {{summary: string, findings: Array<{path: string, line: number, severity: string, title: string, body: string}>} | null} */
  let submitted = null;

  const tools = [
    betaZodTool({
      name: "read_file",
      description: "Read a file from the repository at the PR head commit, with line numbers. At most 1500 lines per call.",
      inputSchema: z.object({
        path: z.string().describe("Path relative to the repository root"),
        start_line: z.number().int().min(1).optional(),
        end_line: z.number().int().min(1).optional(),
      }),
      run: async (input) => readFile(root, input),
    }),
    betaZodTool({
      name: "search",
      description: "Search tracked files with git grep. Returns path:line:text matches, at most 300.",
      inputSchema: z.object({
        pattern: z.string().describe("Extended regular expression, or a literal string when fixed_string is true"),
        path: z.string().optional().describe("Limit to this directory or file"),
        fixed_string: z.boolean().optional(),
      }),
      run: async (input) => search(root, input),
    }),
    betaZodTool({
      name: "list_files",
      description: "List tracked files under a directory (at most 500).",
      inputSchema: z.object({ dir: z.string().optional().describe("Directory relative to the repository root") }),
      run: async (input) => listFiles(root, input),
    }),
    betaZodTool({
      name: "get_file_diff",
      description: "Get the numbered diff of one changed file in this pull request.",
      inputSchema: z.object({ path: z.string() }),
      run: async ({ path }) => {
        const f = byPath.get(path);
        if (!f) return `${path} is not changed in this pull request.`;
        return f.patch ? numberPatch(f.patch) : "[no textual diff for this file]";
      },
    }),
    betaZodTool({
      name: "submit_review",
      description: "Submit the finished review. Call exactly once, at the end.",
      inputSchema: SubmitInput,
      run: async (input) => {
        submitted = input;
        return "Review received. You are done; do not call any more tools.";
      },
    }),
  ];

  const stopRefresh = await startIdentityTokenFile();
  const client = new Anthropic();

  const runner = client.beta.messages.toolRunner({
    model,
    max_tokens: 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort },
    cache_control: { type: "ephemeral" },
    system: [{ type: "text", text: `${SYSTEM}\n\n${repoRules({ guidance })}` }],
    tools,
    messages: [{ role: "user", content: userText }],
    max_iterations: maxIterations,
    // Each turn streams: the SDK requires it for a max_tokens this large.
    stream: true,
  });

  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, turns: 0 };
  let last = null;
  for await (const turn of runner) {
    const message = await turn.finalMessage();
    last = message;
    usage.turns += 1;
    usage.input += message.usage.input_tokens ?? 0;
    usage.output += message.usage.output_tokens ?? 0;
    usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;
    usage.cacheWrite += message.usage.cache_creation_input_tokens ?? 0;
    // Stop as soon as the model calls submit_review, without another API turn.
    const call = message.content.find((b) => b.type === "tool_use" && b.name === "submit_review");
    if (call && message.stop_reason === "tool_use") {
      const parsed = SubmitInput.safeParse(call.input);
      if (parsed.success) {
        submitted = parsed.data;
        break;
      }
    }
    if (submitted) break;
  }
  stopRefresh();

  const usageLine = `${model} · effort ${effort} · ${usage.turns} turns · input ${usage.input} (+${usage.cacheRead} cached, ${usage.cacheWrite} cache writes) · output ${usage.output} tokens`;
  summaryLine(`Usage: ${usageLine}`);

  if (!submitted) {
    const reason = last?.stop_reason === "refusal" ? "the model declined the request" : `stop_reason ${last?.stop_reason ?? "none"}`;
    throw new Error(`The review ended without submit_review (${reason}, ${usage.turns} turns). Nothing was posted.`);
  }

  /** @type {{summary: string, findings: Array<{path: string, line: number, severity: string, title: string, body: string}>}} */
  const result = submitted;
  const inline = [];
  const elsewhere = [];
  for (const f of result.findings) {
    const text = `**${f.severity}: ${f.title}**\n\n${f.body}`;
    if (byPath.get(f.path)?.lines.has(f.line)) {
      inline.push({ path: f.path, line: f.line, side: "RIGHT", body: `${MARKER}\n${text}` });
    } else {
      elsewhere.push(`- \`${f.path}:${f.line}\` ${text.replace(/\n\n/g, " ")}`);
    }
  }

  summaryLine(`Findings: ${result.findings.length} (${inline.length} inline, ${elsewhere.length} outside the diff).`);
  if (result.findings.length === 0 && reviewedBefore) {
    summaryLine("No new findings and an earlier review exists; nothing posted.");
    return;
  }

  const body = [
    MARKER,
    `**Claude review** of ${headSha.slice(0, 7)}`,
    result.summary,
    result.findings.length === 0 ? "No issues found." : "",
    elsewhere.length ? `Findings outside the changed lines:\n${elsewhere.join("\n")}` : "",
    `<sub>${usageLine}. Advisory only; it does not approve or block.</sub>`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    await gh.createReview(n, { commit_id: headSha, event: "COMMENT", body, comments: inline });
  } catch (err) {
    // A line GitHub will not accept (e.g. the head moved): post everything in the body instead.
    if (!(err instanceof Error) || /** @type {any} */ (err).status !== 422 || inline.length === 0) throw err;
    const all = inline.map((c) => `- \`${c.path}:${c.line}\` ${c.body.replace(MARKER, "").trim().replace(/\n\n/g, " ")}`);
    await gh.createReview(n, { commit_id: headSha, event: "COMMENT", body: `${body}\n\nInline comments were rejected by GitHub; listed here:\n${all.join("\n")}` });
  }
  summaryLine(`Posted review on PR #${n}.`);
}

main().catch((err) => {
  if (err instanceof Anthropic.APIError) {
    console.error(`::error::Claude API error ${err.status}: ${err.message}`);
  } else {
    console.error(`::error::${err instanceof Error ? err.message : String(err)}`);
  }
  process.exit(1);
});
