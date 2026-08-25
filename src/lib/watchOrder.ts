import type { Market, Stock } from "../types";
import { priceZone, SYNC } from "./setup";

/** 창에 올릴 동조 업종 수. 기여가 큰 곳부터. */
export const ORDER_SECTOR_CAP = 6;

export const MARKET_LABEL: Record<Market, string> = {
  KOSPI: "코스피",
  KOSDAQ: "코스닥",
};

export type WatchLane = "early" | "high" | "mid";

export interface WatchPick {
  rank: number;
  stock: Stock;
  zone: WatchLane;
  /** 그 시장 안 시총 순위. 1이 그 시장 대장. */
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

function byCap(a: Stock, b: Stock): number {
  return b.marketCap - a.marketCap;
}

/** 업종마다 코스피 1등, 코스닥 1등. 한쪽만 있으면 그 시장 1~2등. */
function pickLeaders(items: Stock[]): { stock: Stock; role: 1 | 2 }[] {
  const alive = (s: Stock) => priceZone(s.change) !== "down";
  const kospi = items.filter((s) => s.market === "KOSPI").sort(byCap);
  const kosdaq = items.filter((s) => s.market === "KOSDAQ").sort(byCap);
  const k = kospi.find(alive);
  const q = kosdaq.find(alive);

  if (k && q) {
    return [
      { stock: k, role: 1 },
      { stock: q, role: 1 },
    ];
  }

  return (k ? kospi : kosdaq)
    .filter(alive)
    .slice(0, 2)
    .map((stock, i) => ({ stock, role: (i + 1) as 1 | 2 }));
}

/**
 * 동조 업종의 코스피·코스닥 시총 대장을, 보는 순서대로 나눕니다.
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
      const top = [...items].sort(byCap).slice(0, SYNC.topN);
      const lit = top.filter((s) => s.change >= SYNC.lit).length;
      const avg = top.length ? top.reduce((sum, s) => sum + s.change, 0) / top.length : 0;
      const leaders = pickLeaders(items);
      const contribution = contributionBySector.get(name) ?? 0;
      return { name, lit, avg, leaders, contribution };
    })
    .filter((s) => s.leaders.length > 0)
    .sort((a, b) => b.contribution - a.contribution || b.lit - a.lit || b.avg - a.avg)
    .slice(0, ORDER_SECTOR_CAP);

  const buckets: Record<WatchLane, WatchPick[]> = { early: [], high: [], mid: [] };
  for (const sector of sectors) {
    for (const leader of sector.leaders) {
      const zone = priceZone(leader.stock.change);
      if (zone === "down") continue;
      buckets[zone].push({
        rank: 0,
        stock: leader.stock,
        zone,
        role: leader.role,
        lit: sector.lit,
        avg: sector.avg,
      });
    }
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

function viewOf(zone: WatchLane): string {
  if (zone === "early") return "초입이라 돌파입니다.";
  if (zone === "high") return "고구간이라 눌림을 기다립니다.";
  return "중간이라 추격하지 않습니다.";
}

function josaEun(market: Market): string {
  return market === "KOSPI" ? "는" : "은";
}

function zoneLine(pick: WatchPick): string {
  const label = MARKET_LABEL[pick.stock.market];
  return `${label}${josaEun(pick.stock.market)} ${viewOf(pick.zone)}`;
}

export interface WatchNote {
  sector: string;
  lines: string[];
  names: string[];
}

export interface WatchLead {
  sectors: string[];
  lines: string[];
}

/** 어디를 어떤 관점으로 볼지. 종목 수가 아닙니다. */
export function watchOrderLead(order: WatchOrder): WatchLead {
  const notes = watchOrderNotes(order);
  const sectors = notes.slice(0, 3).map((n) => n.sector);
  return {
    sectors: sectors.length ? sectors : ["동조 업종"],
    lines: ["시총 대장만 적었습니다.", "타점은 HTS 3분봉입니다."],
  };
}

/** 업종마다 코스피·코스닥 구간의 관점입니다. 새 신호가 아닙니다. */
export function watchOrderNotes(order: WatchOrder): WatchNote[] {
  const picks = [...order.early, ...order.high, ...order.mid].sort((a, b) => a.rank - b.rank);
  const grouped = new Map<string, WatchPick[]>();
  for (const pick of picks) {
    const list = grouped.get(pick.stock.sector) ?? [];
    list.push(pick);
    grouped.set(pick.stock.sector, list);
  }

  return [...grouped.entries()].map(([sector, rows]) => {
    const names = rows.map((p) => p.stock.name);
    const markets = new Set(rows.map((p) => p.stock.market));
    const zones = new Set(rows.map((p) => p.zone));
    const zone = rows[0].zone;

    if (markets.size === 2 && zones.size === 1) {
      return { sector, lines: [`양쪽 다 ${viewOf(zone)}`], names };
    }
    if (markets.size === 2) {
      return { sector, lines: rows.map(zoneLine), names };
    }

    const missing = rows[0].stock.market === "KOSPI" ? "코스닥" : "코스피";
    const only = `${MARKET_LABEL[rows[0].stock.market]}만 있습니다.`;
    const lines =
      zones.size === 1
        ? [`${only} ${viewOf(zone)}`, `${missing} 대장 없음.`]
        : [`${only} ${missing} 대장 없음.`, ...rows.map(zoneLine)];
    return { sector, lines, names };
  });
}
