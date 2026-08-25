import type { Market, Stock } from "../types";

interface MarketItem {
  cd?: string;
  nm?: string;
  nv?: number;
  cr?: number;
  mks?: number;
  aa?: number;
  aq?: number;
  kospi?: boolean;
  kosdaq?: boolean;
  etf?: boolean;
  etn?: boolean;
}

/** 누적 거래대금(억원). aa 단위가 코스피/코스닥에서 달라 aq×현재가로 맞춤. */
function turnoverEok(item: MarketItem): number {
  const aq = item.aq ?? 0;
  const nv = item.nv ?? 0;
  if (aq > 0 && nv > 0) return Math.max(0, Math.round((aq * nv) / 1e8));
  const aa = item.aa ?? 0;
  if (aa <= 0) return 0;
  const asMillion = aa / 100;
  const cap = item.mks ?? 0;
  if (cap > 0 && asMillion > cap * 2) return Math.round(aa / 100_000);
  return Math.round(asMillion);
}

interface MarketListResponse {
  result?: {
    totCnt?: number;
    itemList?: MarketItem[];
  };
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function koreanHtml(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  const buf = await res.arrayBuffer();
  try {
    return new TextDecoder("euc-kr").decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

export async function fetchSectorMap(
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const listHtml = await koreanHtml("/api/finance/sise/sise_group.naver?type=upjong");
  const groups = [
    ...listHtml.matchAll(/sise_group_detail\.naver\?type=upjong&no=(\d+)[^>]*>([^<]+)/g),
  ].map((m) => ({ no: m[1], name: m[2].replace(/\s+/g, " ").trim() }));
  onProgress?.(0, groups.length);

  let done = 0;
  for (const batch of chunks(groups, 10)) {
    const pages = await Promise.all(
      batch.map(async (group) => {
        const html = await koreanHtml(
          `/api/finance/sise/sise_group_detail.naver?type=upjong&no=${group.no}`,
        );
        const codes = [...html.matchAll(/\/item\/main\.naver\?code=(\d{6})/g)].map((m) => m[1]);
        return { name: group.name, codes };
      }),
    );
    for (const page of pages) {
      for (const code of page.codes) {
        if (!map.has(code)) map.set(code, page.name);
      }
    }
    done += batch.length;
    onProgress?.(done, groups.length);
  }
  return map;
}

async function fetchSosok(sosok: 0 | 1): Promise<MarketItem[]> {
  const first = await fetch(
    `/api/mstock/api/json/sise/siseListJson.nhn?menu=market_sum&sosok=${sosok}&pageSize=500&page=1`,
  );
  if (!first.ok) throw new Error(String(first.status));
  const json = (await first.json()) as MarketListResponse;
  const total = json.result?.totCnt ?? 0;
  const items = [...(json.result?.itemList ?? [])];
  const pages = Math.ceil(total / 500);
  if (pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) =>
        fetch(
          `/api/mstock/api/json/sise/siseListJson.nhn?menu=market_sum&sosok=${sosok}&pageSize=500&page=${i + 2}`,
        ).then((res) => {
          if (!res.ok) throw new Error(String(res.status));
          return res.json() as Promise<MarketListResponse>;
        }),
      ),
    );
    for (const page of rest) items.push(...(page.result?.itemList ?? []));
  }
  return items;
}

function toStock(item: MarketItem, sectors: Map<string, string>): Stock | null {
  if (!item.cd || !item.nm || item.etf || item.etn) return null;
  const market: Market = item.kosdaq ? "KOSDAQ" : "KOSPI";
  return {
    name: item.nm,
    code: item.cd,
    market,
    sector: sectors.get(item.cd) ?? "기타",
    marketCap: item.mks ?? 0,
    change: item.cr ?? 0,
    price: item.nv ?? 0,
    turnover: turnoverEok(item),
  };
}

export async function fetchMarketItems(): Promise<MarketItem[]> {
  const [kospi, kosdaq] = await Promise.all([fetchSosok(0), fetchSosok(1)]);
  return [...kospi, ...kosdaq];
}

export function stocksFromItems(items: MarketItem[], sectors: Map<string, string>): Stock[] {
  const byCode = new Map<string, Stock>();
  for (const item of items) {
    const stock = toStock(item, sectors);
    if (stock && stock.marketCap > 0) byCode.set(stock.code, stock);
  }
  return [...byCode.values()];
}

export async function fetchAllStocks(sectors: Map<string, string>): Promise<Stock[]> {
  return stocksFromItems(await fetchMarketItems(), sectors);
}

export async function refreshMarket(stocks: Stock[]): Promise<Stock[] | null> {
  try {
    const sectors = new Map(stocks.map((s) => [s.code, s.sector]));
    const next = await fetchAllStocks(sectors);
    return next.length > 50 ? next : null;
  } catch {
    return null;
  }
}
