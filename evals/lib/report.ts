// Self-contained HTML report generator for the NL→SQL eval harness.
// Pure string building — no dependencies. The caller writes the returned
// document to disk and opens it in a browser.

import type {
  EvalQuestion,
  FailureClass,
  RunConfig,
  TrialResult,
} from "../types";
import { formatUsd } from "./pricing";

const FAILURE_CLASSES: FailureClass[] = [
  "generation-mock-fallback",
  "generation-error",
  "json-parse-fallback",
  "validation-rejection",
  "execution-error",
  "empty-result",
  "result-mismatch",
];

const FAILURE_LABELS: Record<FailureClass, string> = {
  "generation-mock-fallback": "mock fallback",
  "generation-error": "generation error",
  "json-parse-fallback": "JSON parse fallback",
  "validation-rejection": "validation rejection",
  "execution-error": "execution error",
  "empty-result": "empty result",
  "result-mismatch": "result mismatch",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(text: string, max = 70): string {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return "—";
  return ((numerator / denominator) * 100).toFixed(1) + "%";
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function p95(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function fmtNum(value: number | null, digits = 0): string {
  if (value === null || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

function fmtLatency(ms: number | null): string {
  if (ms === null || Number.isNaN(ms)) return "—";
  return ms >= 1000 ? (ms / 1000).toFixed(1) + "s" : Math.round(ms) + "ms";
}

/**
 * Sum of `costUsd` over trials that carried a price, plus the token totals over
 * trials that reported usage. `totalCostUsd` is null when NO trial for the model
 * was priced (the model has no rates in evals/pricing.json). Each trial's own
 * figures already cover every attempt the harness made, retries included.
 *
 * Token semantics (see evals/types.ts): reasoning tokens are a SUBSET of output
 * tokens and cached input tokens are a SUBSET of input tokens — these totals are
 * breakdowns and must never be added on top of each other.
 */
interface CostStats {
  totalCostUsd: number | null;
  pricedTrials: number;
  meanCostUsd: number | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalReasoningTokens: number;
  totalCachedInputTokens: number;
}

interface ModelStats extends CostStats {
  model: string;
  total: number;
  passed: number;
  meanConfidence: number | null;
  meanGenerateMs: number | null;
  medianGenerateMs: number | null;
  p95GenerateMs: number | null;
  meanExecuteMs: number | null;
  failureCounts: Record<FailureClass, number>;
}

function computeCostStats(trials: TrialResult[]): CostStats {
  let costSum = 0;
  let pricedTrials = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalReasoningTokens = 0;
  let totalCachedInputTokens = 0;
  for (const t of trials) {
    if (t.costUsd !== null) {
      costSum += t.costUsd;
      pricedTrials++;
    }
    if (t.usage) {
      totalInputTokens += t.usage.inputTokens;
      totalOutputTokens += t.usage.outputTokens;
      totalReasoningTokens += t.usage.reasoningTokens;
      totalCachedInputTokens += t.usage.cachedInputTokens;
    }
  }
  const totalCostUsd = pricedTrials > 0 ? costSum : null;
  return {
    totalCostUsd,
    pricedTrials,
    meanCostUsd: totalCostUsd !== null ? totalCostUsd / pricedTrials : null,
    totalInputTokens,
    totalOutputTokens,
    totalReasoningTokens,
    totalCachedInputTokens,
  };
}

/** "$0.0421" or "$0.0421 (3/6 priced)" when only some trials carried a price. */
function fmtCostCell(
  usd: number | null,
  pricedTrials: number,
  totalTrials: number
): string {
  if (usd === null) return "—";
  const cost = escapeHtml(formatUsd(usd));
  if (pricedTrials < totalTrials) {
    return `${cost} <span class="partial-note">(${pricedTrials}/${totalTrials} priced)</span>`;
  }
  return cost;
}

function fmtTokens(count: number): string {
  return count.toLocaleString("en-US");
}

function computeModelStats(model: string, trials: TrialResult[]): ModelStats {
  const failureCounts = Object.fromEntries(
    FAILURE_CLASSES.map((fc) => [fc, 0])
  ) as Record<FailureClass, number>;
  const confidences: number[] = [];
  const generateMs: number[] = [];
  const executeMs: number[] = [];
  let passed = 0;
  for (const t of trials) {
    if (t.pass) passed++;
    if (t.failureClass !== null) failureCounts[t.failureClass]++;
    if (t.confidence !== null) confidences.push(t.confidence);
    // Harness-level failures have no timing at all — counting them as 0ms would
    // make a flaky model look faster than it is.
    if (t.generateMs !== null) generateMs.push(t.generateMs);
    if (t.executeMs !== null) executeMs.push(t.executeMs);
  }
  return {
    model,
    total: trials.length,
    passed,
    meanConfidence: mean(confidences),
    meanGenerateMs: mean(generateMs),
    medianGenerateMs: median(generateMs),
    p95GenerateMs: p95(generateMs),
    meanExecuteMs: mean(executeMs),
    failureCounts,
    ...computeCostStats(trials),
  };
}

function dominantFailure(trials: TrialResult[]): FailureClass | null {
  const counts = new Map<FailureClass, number>();
  for (const t of trials) {
    if (t.failureClass !== null) {
      counts.set(t.failureClass, (counts.get(t.failureClass) ?? 0) + 1);
    }
  }
  let best: FailureClass | null = null;
  let bestCount = 0;
  for (const [fc, count] of counts) {
    if (count > bestCount) {
      best = fc;
      bestCount = count;
    }
  }
  return best;
}

function rankingSection(models: string[], byModel: Map<string, TrialResult[]>): string {
  const entries = models.map((model) => {
    const trials = byModel.get(model) ?? [];
    const passing = trials.filter((t) => t.pass);
    const medianGen = median(
      passing
        .filter((t) => t.generateMs !== null)
        .map((t) => t.generateMs as number)
    );
    const medianExec = median(
      passing
        .filter((t) => t.executeMs !== null)
        .map((t) => t.executeMs as number)
    );
    return {
      model,
      total: trials.length,
      passed: passing.length,
      medianGen,
      medianExec,
      ...computeCostStats(trials),
    };
  });
  entries.sort((a, b) => {
    if (a.passed !== b.passed) return b.passed - a.passed;
    // Faster median generate latency (over passing trials) wins ties.
    // Models with no passing trials have no latency and sort last.
    if (a.medianGen === null && b.medianGen === null) return 0;
    if (a.medianGen === null) return 1;
    if (b.medianGen === null) return -1;
    return a.medianGen - b.medianGen;
  });
  const rows = entries
    .map(
      (e, i) => `<tr>
        <td class="num">${i + 1}</td>
        <td>${escapeHtml(e.model)}</td>
        <td>${e.passed}/${e.total} (${pct(e.passed, e.total)})</td>
        <td class="num">${fmtNum(e.medianGen)}</td>
        <td class="num">${fmtNum(e.medianExec)}</td>
        <td class="num">${fmtCostCell(e.totalCostUsd, e.pricedTrials, e.total)}</td>
        <td class="num">${e.meanCostUsd !== null ? escapeHtml(formatUsd(e.meanCostUsd)) : "—"}</td>
      </tr>`
    )
    .join("\n");

  const unpriced = entries.filter((e) => e.totalCostUsd === null);
  let pricingNote = "";
  if (unpriced.length === entries.length && entries.length > 0) {
    pricingNote = `<p class="rank-note">No costs are shown: <code>evals/pricing.json</code> has no rates for any model in this run. Add rates there to see cost per model.</p>`;
  } else if (unpriced.length > 0) {
    const names = unpriced.map((e) => escapeHtml(e.model)).join(", ");
    pricingNote = `<p class="rank-note">Cost shows &mdash; for ${names} because <code>evals/pricing.json</code> has no rates configured for ${unpriced.length === 1 ? "that model" : "those models"}.</p>`;
  }

  return `<h2>Model ranking</h2>
  <p class="rank-note">Ranked by pass count (descending), then by median generate latency over passing trials (ascending) — a model that returns equally good SQL but faster ranks higher; failing trials are excluded from the ranking latency because fallbacks distort timings. Cost is reported for reference only and does not affect the ranking.</p>
  <div class="scroll">
  <table>
    <thead>
      <tr>
        <th>Rank</th>
        <th>Model</th>
        <th>Pass rate</th>
        <th>Median generate ms (passing)</th>
        <th>Median execute ms (passing)</th>
        <th>Total cost</th>
        <th>Cost / query</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  </div>
  ${pricingNote}`;
}

function calibrationSection(models: string[], byModel: Map<string, TrialResult[]>): string {
  const rows = models
    .map((model) => {
      const trials = byModel.get(model) ?? [];
      const high = trials.filter((t) => t.confidence !== null && t.confidence >= 0.5);
      const low = trials.filter((t) => t.confidence !== null && t.confidence < 0.5);
      const highPass = high.filter((t) => t.pass).length;
      const lowPass = low.filter((t) => t.pass).length;
      const passConf = trials
        .filter((t) => t.pass && t.confidence !== null)
        .map((t) => t.confidence as number);
      const failConf = trials
        .filter((t) => !t.pass && t.confidence !== null)
        .map((t) => t.confidence as number);
      return `<tr>
        <td>${escapeHtml(model)}</td>
        <td>${highPass}/${high.length} (${pct(highPass, high.length)})</td>
        <td>${lowPass}/${low.length} (${pct(lowPass, low.length)})</td>
        <td>${fmtNum(mean(passConf), 2)}</td>
        <td>${fmtNum(mean(failConf), 2)}</td>
      </tr>`;
    })
    .join("\n");
  return `<h2>Confidence calibration</h2>
  <div class="scroll">
  <table>
    <thead>
      <tr>
        <th>Model</th>
        <th>Pass rate (confidence &ge; 0.5)</th>
        <th>Pass rate (confidence &lt; 0.5)</th>
        <th>Mean confidence (passing)</th>
        <th>Mean confidence (failing)</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  </div>`;
}

export function renderHtmlReport(opts: {
  runId: string;
  timestamp: string;
  config: RunConfig;
  questions: EvalQuestion[];
  trials: TrialResult[];
}): string {
  const { runId, timestamp, config, questions, trials } = opts;

  const models = config.models.slice();
  const byModel = new Map<string, TrialResult[]>();
  for (const model of models) byModel.set(model, []);
  for (const t of trials) {
    const bucket = byModel.get(t.model);
    if (bucket) {
      bucket.push(t);
    } else {
      byModel.set(t.model, [t]);
      models.push(t.model);
    }
  }

  // --- Per-model summary table ---
  const modelStats = models.map((m) => computeModelStats(m, byModel.get(m) ?? []));
  const failureHeaders = FAILURE_CLASSES.map(
    (fc) => `<th class="fc">${escapeHtml(FAILURE_LABELS[fc])}</th>`
  ).join("");
  const summaryRows = modelStats
    .map((s) => {
      const failureCells = FAILURE_CLASSES.map((fc) => {
        const count = s.failureCounts[fc];
        return `<td class="num${count > 0 ? " nonzero" : ""}">${count}</td>`;
      }).join("");
      return `<tr>
        <td>${escapeHtml(s.model)}</td>
        <td>${s.passed}/${s.total} (${pct(s.passed, s.total)})</td>
        <td class="num">${fmtNum(s.meanConfidence, 2)}</td>
        <td class="num">${fmtNum(s.meanGenerateMs)}</td>
        <td class="num">${fmtNum(s.medianGenerateMs)}</td>
        <td class="num">${fmtNum(s.p95GenerateMs)}</td>
        <td class="num">${fmtNum(s.meanExecuteMs)}</td>
        <td class="num">${fmtCostCell(s.totalCostUsd, s.pricedTrials, s.total)}</td>
        <td class="num">${fmtTokens(s.totalInputTokens)}</td>
        <td class="num">${fmtTokens(s.totalOutputTokens)}</td>
        <td class="num">${fmtTokens(s.totalReasoningTokens)}</td>
        ${failureCells}
      </tr>`;
    })
    .join("\n");

  // --- Per-question matrix ---
  const trialsByQuestionModel = new Map<string, TrialResult[]>();
  for (const t of trials) {
    const key = `${t.questionId} ${t.model}`;
    const bucket = trialsByQuestionModel.get(key);
    if (bucket) bucket.push(t);
    else trialsByQuestionModel.set(key, [t]);
  }
  const matrixModelHeaders = models
    .map((m) => `<th>${escapeHtml(m)}</th>`)
    .join("");
  const matrixRows = questions
    .map((q) => {
      const cells = models
        .map((model) => {
          const cellTrials =
            trialsByQuestionModel.get(`${q.id} ${model}`) ?? [];
          if (cellTrials.length === 0) {
            return `<td class="cell none-run">—</td>`;
          }
          const k = cellTrials.filter((t) => t.pass).length;
          const n = cellTrials.length;
          const cls = k === n ? "all-pass" : k === 0 ? "no-pass" : "part-pass";
          let detail = "";
          if (k < n) {
            const dom = dominantFailure(cellTrials);
            if (dom !== null) {
              detail = `<br><span class="fc-note">${escapeHtml(FAILURE_LABELS[dom])}</span>`;
            }
          }
          const cellMedianGen = median(
            cellTrials
              .filter((t) => t.generateMs !== null)
              .map((t) => t.generateMs as number)
          );
          const latency =
            cellMedianGen !== null
              ? `<br><span class="lat-note">${escapeHtml(fmtLatency(cellMedianGen))}</span>`
              : "";
          return `<td class="cell ${cls}">${k}/${n}${detail}${latency}</td>`;
        })
        .join("");
      const tags = q.tags.map((t) => escapeHtml(t)).join(", ");
      return `<tr>
        <td class="qid">${escapeHtml(q.id)}</td>
        <td title="${escapeHtml(q.question)}">${escapeHtml(truncate(q.question))}</td>
        <td class="tags">${tags}</td>
        <td class="mode">${escapeHtml(q.mode)}</td>
        ${cells}
      </tr>`;
    })
    .join("\n");

  // --- Appendix: failing trials ---
  const failing = trials.filter((t) => !t.pass);
  const appendix =
    failing.length === 0
      ? `<p class="ok">No failing trials. Every trial passed.</p>`
      : failing
          .map((t) => {
            const fc = t.failureClass !== null ? FAILURE_LABELS[t.failureClass] : "unknown";
            return `<div class="failure">
        <div class="failure-head">
          <span class="qid">${escapeHtml(t.questionId)}</span>
          <span class="model">${escapeHtml(t.model)}</span>
          <span>trial ${t.trial}</span>
          <span class="badge">${escapeHtml(fc)}</span>
          <span>confidence: ${t.confidence !== null ? t.confidence.toFixed(2) : "—"}</span>
        </div>
        <pre>${t.generatedSql !== null ? escapeHtml(t.generatedSql) : "(no SQL generated)"}</pre>
        ${t.failureDetail !== null ? `<p class="detail">${escapeHtml(t.failureDetail)}</p>` : ""}
      </div>`;
          })
          .join("\n");

  // Config summary — NEVER include credentials. Only host + database name from db.
  const configItems = [
    ["Run ID", runId],
    ["Timestamp", timestamp],
    ["Models", models.join(", ")],
    ["Trials per question", String(config.trials)],
    ["Questions", String(questions.length)],
    ["Base URL", config.baseUrl],
    ["Database", `${config.db.host}/${config.db.database}`],
    ["Concurrency", String(config.concurrency)],
  ]
    .map(
      ([label, value]) =>
        `<div class="meta-item"><span class="meta-label">${escapeHtml(label)}</span><span class="meta-value">${escapeHtml(value)}</span></div>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NL→SQL Eval Report — ${escapeHtml(runId)}</title>
<style>
  :root {
    --green: #1a7f37;
    --green-bg: #e6f4ea;
    --amber: #b58105;
    --amber-bg: #fbf0d9;
    --red: #cf222e;
    --red-bg: #fdedee;
    --border: #d0d7de;
    --muted: #57606a;
    --zebra: #f6f8fa;
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1f2328;
    background: #ffffff;
    margin: 0;
    padding: 24px;
    line-height: 1.5;
  }
  main { max-width: 1100px; margin: 0 auto; }
  h1 { font-size: 1.6rem; margin: 0 0 4px; }
  h2 { font-size: 1.2rem; margin: 32px 0 12px; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
  .meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 8px 24px;
    margin: 16px 0 8px;
    padding: 12px 16px;
    background: var(--zebra);
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  .meta-item { display: flex; flex-direction: column; }
  .meta-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .meta-value { font-size: 0.9rem; word-break: break-all; }
  .scroll { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
  th, td { border: 1px solid var(--border); padding: 6px 10px; text-align: left; vertical-align: top; }
  th { background: var(--zebra); font-weight: 600; white-space: nowrap; }
  tbody tr:nth-child(even) { background: var(--zebra); }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.num.nonzero { font-weight: 600; }
  th.fc { font-size: 0.72rem; }
  td.cell { text-align: center; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.cell.all-pass { background: var(--green-bg); color: var(--green); font-weight: 600; }
  td.cell.part-pass { background: var(--amber-bg); color: var(--amber); font-weight: 600; }
  td.cell.no-pass { background: var(--red-bg); color: var(--red); font-weight: 600; }
  td.cell.none-run { color: var(--muted); }
  .fc-note { font-size: 0.68rem; font-weight: 400; color: var(--muted); }
  .lat-note { font-size: 0.68rem; font-weight: 400; color: var(--muted); }
  .rank-note { font-size: 0.85rem; color: var(--muted); margin: 0 0 10px; }
  .rank-note code { font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace; font-size: 0.8rem; background: var(--zebra); border: 1px solid var(--border); border-radius: 4px; padding: 0 4px; }
  .partial-note { font-size: 0.68rem; font-weight: 400; color: var(--muted); white-space: nowrap; }
  td.qid, .qid { font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace; white-space: nowrap; }
  td.tags, td.mode { font-size: 0.78rem; color: var(--muted); white-space: nowrap; }
  .failure {
    border: 1px solid var(--border);
    border-left: 4px solid var(--red);
    border-radius: 6px;
    margin: 12px 0;
    padding: 10px 14px;
    background: #fff;
  }
  .failure-head { display: flex; flex-wrap: wrap; gap: 12px; align-items: baseline; font-size: 0.85rem; margin-bottom: 6px; }
  .failure-head .model { font-weight: 600; }
  .badge {
    background: var(--red-bg);
    color: var(--red);
    border-radius: 999px;
    padding: 1px 10px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  pre {
    background: var(--zebra);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px 12px;
    overflow-x: auto;
    font-size: 0.8rem;
    font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
    margin: 6px 0;
  }
  .detail { font-size: 0.82rem; color: var(--muted); margin: 4px 0 0; }
  .ok { color: var(--green); font-weight: 600; }
</style>
</head>
<body>
<main>
  <h1>NL→SQL Eval Report</h1>
  <div class="meta">
${configItems}
  </div>

  ${rankingSection(models, byModel)}

  <h2>Per-model summary</h2>
  <div class="scroll">
  <table>
    <thead>
      <tr>
        <th>Model</th>
        <th>Pass rate</th>
        <th>Mean confidence</th>
        <th>Mean generate ms</th>
        <th>Median generate ms</th>
        <th>p95 generate ms</th>
        <th>Mean execute ms</th>
        <th>Total cost</th>
        <th>Input tokens</th>
        <th>Output tokens</th>
        <th>Reasoning tokens</th>
        ${failureHeaders}
      </tr>
    </thead>
    <tbody>
${summaryRows}
    </tbody>
  </table>
  </div>

  ${calibrationSection(models, byModel)}

  <h2>Per-question results</h2>
  <div class="scroll">
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Question</th>
        <th>Tags</th>
        <th>Mode</th>
        ${matrixModelHeaders}
      </tr>
    </thead>
    <tbody>
${matrixRows}
    </tbody>
  </table>
  </div>

  <h2>Appendix: failing trials (${failing.length})</h2>
${appendix}
</main>
</body>
</html>
`;
}
