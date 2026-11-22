import { ENTRY_ALERT_COOLDOWN_MS } from "./types";

const STORAGE_KEY = "enmyaku.entry-alerts.cooldown.v1";

type CooldownMap = Record<string, number>; // alertId → lastShownMs

function readMap(): CooldownMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CooldownMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: CooldownMap) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota
  }
}

/** Drop entries older than 2× cooldown to keep storage small. */
function prune(map: CooldownMap, now: number): CooldownMap {
  const cutoff = now - ENTRY_ALERT_COOLDOWN_MS * 2;
  const next: CooldownMap = {};
  for (const [k, v] of Object.entries(map)) {
    if (v >= cutoff) next[k] = v;
  }
  return next;
}

/**
 * Returns true if this alert fingerprint may be surfaced (toast / Notification).
 * Panel can still show the live computed alert; cooldown only gates "new" noise.
 */
export function shouldAnnounce(alertId: string, now = Date.now()): boolean {
  const map = prune(readMap(), now);
  const last = map[alertId];
  if (last != null && now - last < ENTRY_ALERT_COOLDOWN_MS) {
    writeMap(map);
    return false;
  }
  map[alertId] = now;
  writeMap(map);
  return true;
}

/** Side-level soft gate: same 買い/売り within cooldown shares a bucket. */
export function shouldAnnounceSide(
  side: "long" | "short",
  now = Date.now(),
): boolean {
  return shouldAnnounce(`side:${side}`, now);
}

export function clearAlertCooldown() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
