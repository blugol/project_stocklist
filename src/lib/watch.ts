const KEY = "stocklist.watch";
export const PIN_MAX = 15;

export interface WatchState {
  pins: string[];
  alertOn: boolean;
  threshold: number;
}

const fallback: WatchState = { pins: [], alertOn: false, threshold: 3 };

export function loadWatch(): WatchState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<WatchState>;
    const pins = Array.isArray(parsed.pins)
      ? parsed.pins.filter((c): c is string => typeof c === "string").slice(0, PIN_MAX)
      : [];
    const threshold =
      typeof parsed.threshold === "number" && parsed.threshold > 0 ? parsed.threshold : 3;
    return { pins, alertOn: Boolean(parsed.alertOn), threshold };
  } catch {
    return fallback;
  }
}

export function saveWatch(state: WatchState) {
  localStorage.setItem(KEY, JSON.stringify(state));
}
