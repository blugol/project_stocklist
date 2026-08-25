import type { Session } from "./quotes";
import type { Stock } from "../types";

interface Tick {
  turnover: number;
  delta: number;
  change: number;
  primed: boolean;
}

const MIN_DELTA = 10;
const SURGE_MUL = 2.4;
const FLASH_CAP = 12;

export function applyTicks(
  stocks: Stock[],
  cache: Map<string, Tick>,
  session: Session,
): { surgeCodes: string[]; crossed: Map<string, { prev: number; next: number }> } {
  const surged: { code: string; delta: number }[] = [];
  const crossed = new Map<string, { prev: number; next: number }>();

  for (const stock of stocks) {
    const turnover = stock.turnover ?? 0;
    const prev = cache.get(stock.code);
    if (!prev) {
      cache.set(stock.code, {
        turnover,
        delta: 0,
        change: stock.change,
        primed: false,
      });
      continue;
    }

    const delta = Math.max(0, turnover - prev.turnover);

    if (!prev.primed) {
      cache.set(stock.code, { turnover, delta, change: stock.change, primed: true });
      continue;
    }

    crossed.set(stock.code, { prev: prev.change, next: stock.change });

    if (
      session === "OPEN" &&
      prev.delta > 0 &&
      delta >= prev.delta * SURGE_MUL &&
      delta >= MIN_DELTA
    ) {
      surged.push({ code: stock.code, delta });
    }

    cache.set(stock.code, { turnover, delta, change: stock.change, primed: true });
  }

  surged.sort((a, b) => b.delta - a.delta);
  return {
    surgeCodes: surged.slice(0, FLASH_CAP).map((s) => s.code),
    crossed,
  };
}

export function crossedAlert(
  codes: Iterable<string>,
  crossed: Map<string, { prev: number; next: number }>,
  threshold: number,
): string[] {
  if (threshold <= 0) return [];
  const hits: string[] = [];
  for (const code of codes) {
    const row = crossed.get(code);
    if (!row) continue;
    if (Math.abs(row.prev) < threshold && Math.abs(row.next) >= threshold) hits.push(code);
  }
  return hits;
}
