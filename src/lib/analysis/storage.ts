import {
  DEFAULT_RULE_SET,
  type RuleId,
  type SignalRuleSet,
} from "@/lib/signals";
import type { AnalysisRunResult, RankedCandidate } from "./types";

const RULE_KEY = "enmyaku.signals.v1";
const ANALYSIS_KEY = "enmyaku.analysis.last.v1";

function isRuleSet(v: unknown): v is SignalRuleSet {
  if (!v || typeof v !== "object") return false;
  const o = v as SignalRuleSet;
  return (
    o.version === 1 &&
    o.pair === "USD/JPY" &&
    Array.isArray(o.rules) &&
    o.rules.every(
      (r) =>
        typeof r.id === "string" &&
        typeof r.labelJa === "string" &&
        typeof r.enabled === "boolean" &&
        r.params != null,
    )
  );
}

export function loadSignalRuleSet(): SignalRuleSet {
  if (typeof window === "undefined") return DEFAULT_RULE_SET;
  try {
    const raw = window.localStorage.getItem(RULE_KEY);
    if (!raw) return DEFAULT_RULE_SET;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRuleSet(parsed)) return DEFAULT_RULE_SET;
    return parsed;
  } catch {
    return DEFAULT_RULE_SET;
  }
}

export function saveSignalRuleSet(set: SignalRuleSet) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RULE_KEY, JSON.stringify(set));
}

export function resetSignalRuleSet(): SignalRuleSet {
  saveSignalRuleSet(DEFAULT_RULE_SET);
  return DEFAULT_RULE_SET;
}

/** Merge selected ranked winners into an active rule set (by rule id). */
export function promoteCandidates(
  current: SignalRuleSet,
  winners: RankedCandidate[],
): SignalRuleSet {
  const byId = new Map<RuleId, RankedCandidate>();
  for (const w of winners) {
    const prev = byId.get(w.ruleId);
    if (!prev || w.score > prev.score) byId.set(w.ruleId, w);
  }

  return {
    version: 1,
    pair: "USD/JPY",
    rules: current.rules.map((rule) => {
      const win = byId.get(rule.id);
      if (!win) return rule;
      return {
        ...rule,
        enabled: true,
        params: win.params as never,
      };
    }),
  };
}

/** Promote the pipeline's suggested pack (one best per rule id). */
export function promoteSuggested(suggested: SignalRuleSet): SignalRuleSet {
  saveSignalRuleSet(suggested);
  return suggested;
}

export function saveLastAnalysis(result: AnalysisRunResult) {
  if (typeof window === "undefined") return;
  try {
    // Persist a slim copy (top 30) to avoid huge localStorage.
    const slim: AnalysisRunResult = {
      ...result,
      ranked: result.ranked.slice(0, 30),
    };
    window.localStorage.setItem(ANALYSIS_KEY, JSON.stringify(slim));
  } catch {
    // quota — ignore
  }
}

export function loadLastAnalysis(): AnalysisRunResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ANALYSIS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AnalysisRunResult;
  } catch {
    return null;
  }
}
