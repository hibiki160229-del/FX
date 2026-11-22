import type { PaperState } from "@/lib/types";
import { createInitialPaperState } from "./broker";

const KEY = "enmyaku.paper.v1";

export function loadPaperState(): PaperState {
  if (typeof window === "undefined") return createInitialPaperState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return createInitialPaperState();
    const parsed = JSON.parse(raw) as PaperState;
    if (
      typeof parsed.balance !== "number" ||
      !Array.isArray(parsed.positions) ||
      !Array.isArray(parsed.history)
    ) {
      return createInitialPaperState();
    }
    return parsed;
  } catch {
    return createInitialPaperState();
  }
}

export function savePaperState(state: PaperState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(state));
}

export function resetPaperState(): PaperState {
  const next = createInitialPaperState();
  savePaperState(next);
  return next;
}
