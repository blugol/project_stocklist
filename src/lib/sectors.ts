import type { Stock } from "../types";

export interface SectorStat {
  name: string;
  change: number;
  contribution: number;
  marketCap: number;
  count: number;
  leader: Stock;
}

export function sectorStats(stocks: Stock[]): SectorStat[] {
  const totalCap = stocks.reduce((sum, s) => sum + s.marketCap, 0);
  if (totalCap <= 0) return [];

  const grouped = new Map<string, Stock[]>();
  for (const stock of stocks) {
    const list = grouped.get(stock.sector) ?? [];
    list.push(stock);
    grouped.set(stock.sector, list);
  }

  return [...grouped.entries()]
    .map(([name, items]) => {
      const marketCap = items.reduce((sum, s) => sum + s.marketCap, 0);
      const weighted = items.reduce((sum, s) => sum + s.change * s.marketCap, 0);
      const leader = [...items].sort(
        (a, b) => Math.abs(b.change * b.marketCap) - Math.abs(a.change * a.marketCap),
      )[0];
      return {
        name,
        change: weighted / marketCap,
        contribution: weighted / totalCap,
        marketCap,
        count: items.length,
        leader,
      };
    })
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
}

export function leadingSectors(stats: SectorStat[]) {
  const up = [...stats].filter((s) => s.contribution > 0).sort((a, b) => b.contribution - a.contribution);
  const down = [...stats].filter((s) => s.contribution < 0).sort((a, b) => a.contribution - b.contribution);
  return { up: up[0] ?? null, down: down[0] ?? null };
}
