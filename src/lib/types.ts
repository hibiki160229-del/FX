export type OhlcvBar = {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type IndicatorId = "ma" | "ema" | "rsi" | "macd" | "bb";

export type IndicatorState = Record<IndicatorId, boolean>;

export type SignalSide = "long" | "short" | "neutral";

export type SignalHint = {
  id: string;
  side: SignalSide;
  title: string;
  reason: string;
  strength: number; // 0..1
  at: number; // unix seconds of the bar that triggered
};

export type TradeSide = "buy" | "sell";

export type Position = {
  id: string;
  side: TradeSide;
  lots: number;
  entryPrice: number;
  openedAt: number;
};

export type TradeLogEntry = {
  id: string;
  side: TradeSide;
  lots: number;
  price: number;
  pnl: number;
  at: number;
  note: string;
};

export type PaperState = {
  balance: number;
  positions: Position[];
  history: TradeLogEntry[];
  updatedAt: number;
};
