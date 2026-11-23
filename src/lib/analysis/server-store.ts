import { DEFAULT_RULE_SET, type SignalRuleSet } from "@/lib/signals";
import type { AnalysisRunResult } from "./types";

export type LoopRunState = "idle" | "running" | "ok" | "error";

export type AnalysisLoopSnapshot = {
  state: LoopRunState;
  /** Epoch ms of last completed attempt (ok or error). */
  lastRunAt: number | null;
  /** Epoch ms when the current/next scheduled run is due. */
  nextRunAt: number | null;
  lastError: string | null;
  /** Whether winners were auto-written into activeRuleSet on last ok run. */
  autoPromoted: boolean;
  promotedCount: number;
  barCount: number | null;
  source: "yahoo" | "oanda" | "sample" | null;
  interval: string | null;
  passedCount: number;
  candidateCount: number;
  activeRuleSet: SignalRuleSet;
  /** Slim ranked list for UI (top N). */
  rankedTop: AnalysisRunResult["ranked"];
  extractionNoteJa: string | null;
  asOf: number | null;
};

type Store = {
  state: LoopRunState;
  lastRunAt: number | null;
  nextRunAt: number | null;
  lastError: string | null;
  autoPromoted: boolean;
  promotedCount: number;
  lastResult: AnalysisRunResult | null;
  activeRuleSet: SignalRuleSet;
  runningSince: number | null;
};

const g = globalThis as typeof globalThis & {
  __enmyakuAnalysisStore?: Store;
};

function createStore(): Store {
  return {
    state: "idle",
    lastRunAt: null,
    nextRunAt: null,
    lastError: null,
    autoPromoted: false,
    promotedCount: 0,
    lastResult: null,
    activeRuleSet: structuredClone(DEFAULT_RULE_SET),
    runningSince: null,
  };
}

export function getAnalysisStore(): Store {
  if (!g.__enmyakuAnalysisStore) {
    g.__enmyakuAnalysisStore = createStore();
  }
  return g.__enmyakuAnalysisStore;
}

function slimResult(result: AnalysisRunResult): AnalysisRunResult {
  return {
    ...result,
    ranked: result.ranked.slice(0, 30),
  };
}

export function beginRun(store: Store = getAnalysisStore()): boolean {
  if (store.state === "running") return false;
  store.state = "running";
  store.runningSince = Date.now();
  store.lastError = null;
  return true;
}

export function finishRunOk(
  result: AnalysisRunResult,
  opts: {
    autoPromote: boolean;
    nextRunAt: number;
  },
  store: Store = getAnalysisStore(),
) {
  const slim = slimResult(result);
  store.lastResult = slim;
  store.lastRunAt = result.asOf;
  store.nextRunAt = opts.nextRunAt;
  store.state = "ok";
  store.runningSince = null;
  store.lastError = null;
  if (opts.autoPromote) {
    store.activeRuleSet = structuredClone(result.suggestedRuleSet);
    store.autoPromoted = true;
    store.promotedCount = result.suggestedRuleSet.rules.filter(
      (r) => r.enabled,
    ).length;
  }
}

export function finishRunError(
  message: string,
  nextRunAt: number,
  store: Store = getAnalysisStore(),
) {
  store.state = "error";
  store.lastRunAt = Date.now();
  store.nextRunAt = nextRunAt;
  store.lastError = message;
  store.runningSince = null;
  store.autoPromoted = false;
}

export function setActiveRuleSet(
  set: SignalRuleSet,
  store: Store = getAnalysisStore(),
) {
  store.activeRuleSet = structuredClone(set);
}

export function getLoopSnapshot(
  store: Store = getAnalysisStore(),
): AnalysisLoopSnapshot {
  const r = store.lastResult;
  return {
    state: store.state,
    lastRunAt: store.lastRunAt,
    nextRunAt: store.nextRunAt,
    lastError: store.lastError,
    autoPromoted: store.autoPromoted,
    promotedCount: store.promotedCount,
    barCount: r?.barCount ?? null,
    source: r?.source ?? null,
    interval: r?.interval ?? null,
    passedCount: r?.ranked.filter((x) => x.passed).length ?? 0,
    candidateCount: r?.ranked.length ?? 0,
    activeRuleSet: structuredClone(store.activeRuleSet),
    rankedTop: r?.ranked.slice(0, 12) ?? [],
    extractionNoteJa: r?.extraction.noteJa ?? null,
    asOf: r?.asOf ?? null,
  };
}

export function getLastAnalysisResult(
  store: Store = getAnalysisStore(),
): AnalysisRunResult | null {
  return store.lastResult ? structuredClone(store.lastResult) : null;
}
