import type { OhlcvBar } from "@/lib/types";

export type PriceSourceId = "oanda" | "yahoo" | "sample";

export type LiveQuote = {
  pair: "USD/JPY";
  bid: number;
  ask: number;
  mid: number;
  time: number; // unix ms
  source: PriceSourceId;
  mode: "stream" | "poll" | "candle";
};

export type OhlcvResult = {
  bars: OhlcvBar[];
  source: PriceSourceId;
  pair: "USD/JPY";
  interval: string;
  asOf: number;
};

export type ProviderStatus = {
  preferred: PriceSourceId;
  oandaConfigured: boolean;
  oandaReachable: boolean | null;
  activeSource: PriceSourceId | null;
  mode: LiveQuote["mode"] | "ohlcv" | null;
  detailJa: string;
};

export type PriceProvider = {
  id: PriceSourceId;
  getQuote(): Promise<LiveQuote | null>;
  getOhlcv?(range: string, interval: string): Promise<OhlcvResult | null>;
};
