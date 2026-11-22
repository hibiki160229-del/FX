import type { RuleId, RuleParams } from "@/lib/signals";
import { dedupe, LABELS } from "./seeds";
import type { RuleCandidate } from "./types";

/**
 * Fixed allowlist only — never accept caller-controlled URLs (SSRF-safe).
 * Soft-fail: empty list when egress blocks or pages change.
 */
const ALLOWED_SOURCES: { url: string; label: string }[] = [
  {
    url: "https://www.investopedia.com/terms/g/goldencross.asp",
    label: "Investopedia golden cross",
  },
  {
    url: "https://www.investopedia.com/terms/r/rsi.asp",
    label: "Investopedia RSI",
  },
  {
    url: "https://www.investopedia.com/terms/m/macd.asp",
    label: "Investopedia MACD",
  },
];

function webCand(
  ruleId: RuleId,
  params: RuleParams[RuleId],
  note: string,
): RuleCandidate {
  return {
    id: `${ruleId}:${JSON.stringify(params)}`,
    ruleId,
    labelJa: LABELS[ruleId],
    params,
    source: "web",
    note,
  };
}

function parseParamsFromText(text: string): RuleCandidate[] {
  const out: RuleCandidate[] = [];
  const lower = text.toLowerCase();

  // MA / EMA period pairs e.g. "50-day" and "200-day"
  const dayPairs = [
    ...lower.matchAll(/(\d{1,3})\s*[-/]\s*(\d{1,3})\s*(?:day|期間|日)/gi),
  ];
  for (const m of dayPairs) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b || b > 300) {
      continue;
    }
    out.push(
      webCand("ma_cross", { fast: a, slow: b }, `Web抽出 MA${a}/${b}`),
    );
    out.push(
      webCand("ema_cross", { fast: a, slow: b }, `Web抽出 EMA${a}/${b}`),
    );
  }

  // Classic 50/200 mention
  if (/\b50\b/.test(lower) && /\b200\b/.test(lower)) {
    out.push(
      webCand(
        "ma_cross",
        { fast: 50, slow: 200 },
        "Web抽出 ゴールデンクロス 50/200",
      ),
    );
  }

  // RSI 14 / 30 / 70 style
  if (/\brsi\b/.test(lower) || /相対力/.test(text)) {
    const period = /\b14\b/.test(lower) ? 14 : 14;
    out.push(
      webCand(
        "rsi_reversal",
        { period, oversold: 30, overbought: 70 },
        "Web抽出 RSI14 30/70",
      ),
    );
    if (/\b20\b/.test(lower) && /\b80\b/.test(lower)) {
      out.push(
        webCand(
          "rsi_reversal",
          { period: 14, oversold: 20, overbought: 80 },
          "Web抽出 RSI 20/80",
        ),
      );
    }
  }

  // MACD 12,26,9
  if (/\bmacd\b/.test(lower)) {
    out.push(
      webCand(
        "macd_hist_flip",
        { fast: 12, slow: 26, signal: 9 },
        "Web抽出 MACD 12/26/9",
      ),
    );
  }

  // Bollinger 20, 2
  if (/bollinger|ボリンジャー/.test(lower) || /ボリンジャー/.test(text)) {
    out.push(
      webCand("bb_touch", { period: 20, mult: 2 }, "Web抽出 BB20×2"),
    );
  }

  return out;
}

export type ExtractResult = {
  candidates: RuleCandidate[];
  webHits: number;
  attempted: boolean;
  noteJa: string;
};

/**
 * Best-effort article scrape → param hints.
 * YouTube deferred: transcripts need extra APIs / often blocked.
 */
export async function extractWebCandidates(
  timeoutMs = 4500,
): Promise<ExtractResult> {
  const collected: RuleCandidate[] = [];
  let hits = 0;
  let attempted = false;

  await Promise.all(
    ALLOWED_SOURCES.map(async ({ url, label }) => {
      attempted = true;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: {
            "User-Agent": "EnmyakuFX/1.0 (auto-analysis; educational)",
            Accept: "text/html",
          },
          next: { revalidate: 86400 },
        });
        if (!res.ok) return;
        const html = await res.text();
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .slice(0, 80_000);
        const parsed = parseParamsFromText(text);
        if (parsed.length > 0) {
          hits += 1;
          for (const c of parsed) {
            collected.push({
              ...c,
              note: `${c.note} ← ${label}`,
            });
          }
        }
      } catch {
        // egress / timeout — ignore
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  const candidates = dedupe(collected);
  const noteJa =
    hits > 0
      ? `Web記事から ${candidates.length} 件の候補パラメータを抽出（${hits} ソース）。YouTube文字起こしは今回スキップ。`
      : "Web抽出は到達不可または該当なし。シード＋パラメータ探索で継続。YouTubeは今回スキップ。";

  return { candidates, webHits: hits, attempted, noteJa };
}
