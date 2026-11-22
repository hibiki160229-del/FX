import type { PaperState, Position, TradeLogEntry, TradeSide } from "@/lib/types";

export const INITIAL_BALANCE = 1_000_000; // JPY virtual
export const LOT_JPY_NOTIONAL = 100_000; // 1 lot ≈ ¥100k notional for paper PnL

export function createInitialPaperState(): PaperState {
  return {
    balance: INITIAL_BALANCE,
    positions: [],
    history: [],
    updatedAt: Date.now(),
  };
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Unrealized PnL in JPY for open positions at mark. */
export function unrealizedPnl(positions: Position[], mark: number): number {
  return positions.reduce((sum, p) => {
    const dir = p.side === "buy" ? 1 : -1;
    const pipMove = (mark - p.entryPrice) * dir;
    return sum + pipMove * (p.lots * LOT_JPY_NOTIONAL);
  }, 0);
}

export function openMarket(
  state: PaperState,
  side: TradeSide,
  lots: number,
  price: number,
): PaperState {
  if (lots <= 0 || !Number.isFinite(price)) return state;

  const cost = lots * LOT_JPY_NOTIONAL * 0.02; // tiny paper margin lock
  if (state.balance < cost) return state;

  const position: Position = {
    id: uid("pos"),
    side,
    lots,
    entryPrice: price,
    openedAt: Date.now(),
  };

  const entry: TradeLogEntry = {
    id: uid("tr"),
    side,
    lots,
    price,
    pnl: 0,
    at: Date.now(),
    note: side === "buy" ? "成行買い（仮想）" : "成行売り（仮想）",
  };

  return {
    balance: state.balance - cost,
    positions: [...state.positions, position],
    history: [entry, ...state.history].slice(0, 100),
    updatedAt: Date.now(),
  };
}

/** Close one position at mark; realize PnL back to balance. */
export function closePosition(
  state: PaperState,
  positionId: string,
  mark: number,
): PaperState {
  const pos = state.positions.find((p) => p.id === positionId);
  if (!pos) return state;

  const dir = pos.side === "buy" ? 1 : -1;
  const pnl = (mark - pos.entryPrice) * dir * (pos.lots * LOT_JPY_NOTIONAL);
  const marginBack = pos.lots * LOT_JPY_NOTIONAL * 0.02;

  const closeSide: TradeSide = pos.side === "buy" ? "sell" : "buy";
  const entry: TradeLogEntry = {
    id: uid("tr"),
    side: closeSide,
    lots: pos.lots,
    price: mark,
    pnl,
    at: Date.now(),
    note: "決済（仮想）",
  };

  return {
    balance: state.balance + marginBack + pnl,
    positions: state.positions.filter((p) => p.id !== positionId),
    history: [entry, ...state.history].slice(0, 100),
    updatedAt: Date.now(),
  };
}

export function equity(state: PaperState, mark: number): number {
  return state.balance + unrealizedPnl(state.positions, mark);
}
