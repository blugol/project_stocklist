import type { Stock } from "../types";

export type PriceZone = "down" | "early" | "mid" | "high";

export function priceZone(change: number): PriceZone {
  if (change < 0) return "down";
  if (change < 10) return "early";
  if (change < 15) return "mid";
  return "high";
}

export const ZONE_LABEL: Record<PriceZone, string> = {
  down: "하락",
  early: "초입",
  mid: "중간",
  high: "고구간",
};

export const ZONE_HINT: Record<PriceZone, string> = {
  down: "당일 하락. 돌파·눌림 타점이 아닙니다.",
  early: "10% 미만. 돌파 관점.",
  mid: "10~15%. 추격보다 흐름만 봅니다.",
  high: "15% 이상. 눌림을 기다립니다.",
};

export const SYNC = {
  topN: 5,
  lit: 2,
  avg: 1.5,
  needLarge: 3,
  needSmall: 2,
} as const;

/** 시총 상위 대장이 같이 빨개질 때만 동조. 1등만, 또는 약하게만 오른 섹터는 제외. */
export function syncSectors(stocks: Stock[]): Set<string> {
  const grouped = new Map<string, Stock[]>();
  for (const stock of stocks) {
    const list = grouped.get(stock.sector) ?? [];
    list.push(stock);
    grouped.set(stock.sector, list);
  }

  const names = new Set<string>();
  for (const [name, items] of grouped) {
    const top = [...items].sort((a, b) => b.marketCap - a.marketCap).slice(0, SYNC.topN);
    if (top.length < 2) continue;
    const lit = top.filter((s) => s.change >= SYNC.lit).length;
    const avg = top.reduce((sum, s) => sum + s.change, 0) / top.length;
    const need = top.length >= 4 ? SYNC.needLarge : SYNC.needSmall;
    if (lit >= need && avg >= SYNC.avg) names.add(name);
  }
  return names;
}
