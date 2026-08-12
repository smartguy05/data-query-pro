// Per-model cost accounting for eval runs.
//
// The OpenAI response carries token counts but no prices, so rates come from
// evals/pricing.json. Token semantics (verified against openai@7.4.0 types):
//   - `reasoningTokens` is a SUBSET of `outputTokens` — a breakdown, not an add-on.
//   - `cachedInputTokens` ("retrieved from the cache") and `cacheWriteTokens`
//     ("input tokens that were written to the cache") are SUBSETS of `inputTokens`.
// So fresh (full-price) input = input − cached − cacheWrite, and output is billed
// whole. Never sum the breakdowns on top of the totals.

import * as fs from "node:fs";
import * as path from "node:path";
import type { TokenUsage } from "../types";

const PRICING_PATH = path.join(__dirname, "..", "pricing.json");

interface ModelRates {
  input: number | null;
  output: number | null;
  cachedInput?: number | null;
  cacheWrite?: number | null;
}

interface PricingFile {
  per?: number;
  models?: Record<string, ModelRates>;
}

export interface CostBreakdown {
  usd: number;
  /** False when the model has no usable rates — callers should render "—". */
  priced: boolean;
}

let cached: PricingFile | null = null;

function loadPricing(): PricingFile {
  if (cached !== null) return cached;
  try {
    cached = JSON.parse(fs.readFileSync(PRICING_PATH, "utf8")) as PricingFile;
  } catch (err) {
    console.warn(`Could not read evals/pricing.json (${(err as Error).message}); costs will show as "—".`);
    cached = {};
  }
  return cached;
}

/** Remainder that lets a configured key stand in for a dated snapshot of itself. */
const SNAPSHOT_SUFFIX = /^-\d{4}-\d{2}-\d{2}$/;

/**
 * Resolve rates for a model id. Tries the exact id first, then a configured key
 * the id is a dated snapshot of ("gpt-5.4" prices "gpt-5.4-2026-03-17"), so
 * snapshots inherit their family's prices automatically. A bare prefix is NOT
 * enough — "gpt-5.4-mini" is a different model with different prices, so it
 * stays unpriced (cost renders "—") rather than silently billed at "gpt-5.4"
 * rates.
 */
function ratesFor(model: string): ModelRates | null {
  const models = loadPricing().models ?? {};
  if (models[model]) return models[model];
  const snapshotOf = Object.keys(models)
    .filter((key) => model.startsWith(key) && SNAPSHOT_SUFFIX.test(model.slice(key.length)))
    .sort((a, b) => b.length - a.length)[0];
  return snapshotOf ? models[snapshotOf] : null;
}

/** True when at least one model in pricing.json has usable rates. */
export function hasAnyPricing(): boolean {
  const models = loadPricing().models ?? {};
  return Object.values(models).some((r) => typeof r.input === "number" && typeof r.output === "number");
}

/**
 * Cost of a single request. `usage.model` (what OpenAI actually served) wins over
 * the requested name for rate lookup. Returns priced:false when rates are missing.
 */
export function computeCost(usage: TokenUsage | undefined, requestedModel: string): CostBreakdown {
  if (!usage) return { usd: 0, priced: false };
  const rates = ratesFor(usage.model || requestedModel) ?? ratesFor(requestedModel);
  if (!rates || typeof rates.input !== "number" || typeof rates.output !== "number") {
    return { usd: 0, priced: false };
  }

  const per = loadPricing().per ?? 1_000_000;
  const cachedRate = typeof rates.cachedInput === "number" ? rates.cachedInput : rates.input;
  const writeRate = typeof rates.cacheWrite === "number" ? rates.cacheWrite : rates.input;

  const cachedTokens = usage.cachedInputTokens ?? 0;
  const writeTokens = usage.cacheWriteTokens ?? 0;
  const freshTokens = Math.max(0, usage.inputTokens - cachedTokens - writeTokens);

  const usd =
    (freshTokens * rates.input +
      cachedTokens * cachedRate +
      writeTokens * writeRate +
      usage.outputTokens * rates.output) /
    per;

  return { usd, priced: true };
}

/** "$0.0421" / "$1.24" — small costs need more decimals to stay meaningful. */
export function formatUsd(usd: number): string {
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(5)}`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}
