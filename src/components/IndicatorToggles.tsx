"use client";

import type { IndicatorId, IndicatorState } from "@/lib/types";

const LABELS: { id: IndicatorId; label: string; hint: string }[] = [
  { id: "ma", label: "MA", hint: "移動平均 20/50" },
  { id: "ema", label: "EMA", hint: "指数移動平均 12/26" },
  { id: "bb", label: "BB", hint: "ボリンジャーバンド" },
  { id: "rsi", label: "RSI", hint: "相対力指数" },
  { id: "macd", label: "MACD", hint: "MACD" },
];

type Props = {
  value: IndicatorState;
  onChange: (next: IndicatorState) => void;
};

export function IndicatorToggles({ value, onChange }: Props) {
  return (
    <div className="indicator-row" role="group" aria-label="テクニカル指標">
      {LABELS.map(({ id, label, hint }) => {
        const on = value[id];
        return (
          <button
            key={id}
            type="button"
            className={`indicator-chip ${on ? "is-on" : ""}`}
            aria-pressed={on}
            title={hint}
            onClick={() => onChange({ ...value, [id]: !on })}
          >
            <span className="indicator-chip__label">{label}</span>
            <span className="indicator-chip__hint">{hint}</span>
          </button>
        );
      })}
    </div>
  );
}
