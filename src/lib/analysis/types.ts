import type { RuleId, RuleParams, SignalRuleSet } from "@/lib/signals";

export type ScoreMetrics = {
  /** Net return as fraction of starting equity (e.g. 0.05 = +5%). */
  totalReturn: number;
  /** Max peak-to-trough drawdown as positive fraction. */
  maxDrawdown: number;
  /** Closed trades with positive PnL / total closed trades. */
  winRate: number;
  tradeCount: number;
  /** Wins − losses count (informational). */
  profitFactor: number;
};

export type ScoreFloors = {
  minTrades: number;
  maxDrawdown: number;
  minWinRate: number;
};

export const DEFAULT_SCORE_FLOORS: ScoreFloors = {
  minTrades: 4,
  maxDrawdown: 0.25,
  minWinRate: 0.35,
};

export type RuleCandidate = {
  id: string;
  ruleId: RuleId;
  labelJa: string;
  params: RuleParams[RuleId];
  source: "seed" | "web" | "search" | "youtube";
  note?: string;
  /** YouTube channel or article provenance (JA). */
  channel?: string;
};

export type RankedCandidate = RuleCandidate & {
  metrics: ScoreMetrics;
  score: number;
  passed: boolean;
  failReasons: string[];
};

export type AnalysisRunResult = {
  pair: "USD/JPY";
  interval: string;
  barCount: number;
  source: "yahoo" | "oanda" | "sample";
  asOf: number;
  floors: ScoreFloors;
  ranked: RankedCandidate[];
  extraction: {
    attempted: boolean;
    webHits: number;
    youtube: "skipped" | "seeded";
    youtubeCandidates: number;
    noteJa: string;
  };
  /** Best-of-each-rule-id pack ready to promote. */
  suggestedRuleSet: SignalRuleSet;
};
