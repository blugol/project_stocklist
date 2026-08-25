import type { Stock } from "../types";
import { priceZone, SYNC } from "./setup";

/** 가이드와 같음. 동조 업종에서 시총 대장만 1~2개. */
export const LEADERS_PER_SECTOR = 2;

/** 창에 올릴 동조 업종 수. 기여가 큰 곳부터. */
export const ORDER_SECTOR_CAP = 6;

export type WatchLane = "early" | "high" | "mid";

export interface WatchPick {
  rank: number;
  stock: Stock;
  zone: WatchLane;
  /** 업종 안 시총 순위. 1이 대장. */
  role: 1 | 2;
  lit: number;
  avg: number;
}

export interface WatchOrder {
  early: WatchPick[];
  high: WatchPick[];
  mid: WatchPick[];
  sectorCount: number;
  syncedCount: number;
}

const LANES: WatchLane[] = ["early", "high", "mid"];

/**
 * 동조 업종의 시총 대장을, 보는 순서대로 나눕니다.
 * 기여가 큰 동조부터, 초입 → 고구간 → 중간. 하락은 뺍니다.
 * 매수 사인이 아닙니다.
 */
export function buildWatchOrder(
  stocks: Stock[],
  synced: Set<string>,
  contributionBySector: Map<string, number>,
): WatchOrder {
  const grouped = new Map<string, Stock[]>();
  for (const stock of stocks) {
    const list = grouped.get(stock.sector) ?? [];
    list.push(stock);
    grouped.set(stock.sector, list);
  }

  const sectors = [...synced]
    .map((name) => {
      const items = grouped.get(name) ?? [];
      const top = [...items].sort((a, b) => b.marketCap - a.marketCap).slice(0, SYNC.topN);
      const lit = top.filter((s) => s.change >= SYNC.lit).length;
      const avg = top.length ? top.reduce((sum, s) => sum + s.change, 0) / top.length : 0;
      const leaders = top
        .slice(0, LEADERS_PER_SECTOR)
        .filter((s) => priceZone(s.change) !== "down");
      const contribution = contributionBySector.get(name) ?? 0;
      return { name, lit, avg, leaders, contribution };
    })
    .filter((s) => s.leaders.length > 0)
    .sort((a, b) => b.contribution - a.contribution || b.lit - a.lit || b.avg - a.avg)
    .slice(0, ORDER_SECTOR_CAP);

  const buckets: Record<WatchLane, WatchPick[]> = { early: [], high: [], mid: [] };
  for (const sector of sectors) {
    sector.leaders.forEach((stock, i) => {
      const zone = priceZone(stock.change);
      if (zone === "down") return;
      buckets[zone].push({
        rank: 0,
        stock,
        zone,
        role: (i + 1) as 1 | 2,
        lit: sector.lit,
        avg: sector.avg,
      });
    });
  }

  let rank = 1;
  for (const lane of LANES) {
    for (const pick of buckets[lane]) pick.rank = rank++;
  }

  return {
    early: buckets.early,
    high: buckets.high,
    mid: buckets.mid,
    sectorCount: sectors.length,
    syncedCount: synced.size,
  };
}

export function watchPickCount(order: WatchOrder): number {
  return order.early.length + order.high.length + order.mid.length;
}
