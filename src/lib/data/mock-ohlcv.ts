import type { OhlcvBar } from "@/lib/types";

/** Deterministic-ish sample USD/JPY hourly bars when live fetch fails. */
export function generateMockOhlcv(count = 240, seed = 42): OhlcvBar[] {
  const bars: OhlcvBar[] = [];
  let price = 154.2;
  let t = Math.floor(Date.now() / 1000) - count * 3600;
  let s = seed;

  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };

  for (let i = 0; i < count; i++) {
    const drift = Math.sin(i / 18) * 0.08 + (rand() - 0.48) * 0.35;
    const open = price;
    const close = Math.max(140, Math.min(165, open + drift));
    const wick = 0.05 + rand() * 0.25;
    const high = Math.max(open, close) + wick * rand();
    const low = Math.min(open, close) - wick * rand();
    bars.push({
      time: t,
      open: +open.toFixed(3),
      high: +high.toFixed(3),
      low: +low.toFixed(3),
      close: +close.toFixed(3),
      volume: Math.floor(800 + rand() * 4200),
    });
    price = close;
    t += 3600;
  }
  return bars;
}
