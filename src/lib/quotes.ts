import type { Stock } from "../types";
import { refreshMarket } from "./universe";

export interface IndexQuote {
  code: "KOSPI" | "KOSDAQ";
  value: number;
  change: number;
}

export type Session = "OPEN" | "CLOSE";

export interface LiveSnapshot {
  stocks: Stock[];
  indexes: IndexQuote[];
  session: Session;
  updatedAt: number;
}

interface NaverIndex {
  cd?: string;
  nv?: number;
  cr?: number;
  ms?: string;
}

interface NaverResponse {
  result?: {
    areas?: { name?: string; datas?: NaverIndex[] }[];
  };
}

export async function fetchIndexes(): Promise<{ indexes: IndexQuote[]; session: Session }> {
  const res = await fetch(
    `/api/naver/api/realtime?query=${encodeURIComponent("SERVICE_INDEX:KOSPI,KOSDAQ")}`,
  );
  if (!res.ok) throw new Error(String(res.status));
  const json = (await res.json()) as NaverResponse;
  const rows = json.result?.areas?.find((a) => a.name === "SERVICE_INDEX")?.datas ?? [];
  const indexes: IndexQuote[] = rows
    .filter((row): row is NaverIndex & { cd: "KOSPI" | "KOSDAQ" } =>
      row.cd === "KOSPI" || row.cd === "KOSDAQ",
    )
    .map((row) => ({
      code: row.cd,
      value: (row.nv ?? 0) / 100,
      change: row.cr ?? 0,
    }));
  const session: Session = rows.some((row) => row.ms === "OPEN") ? "OPEN" : "CLOSE";
  return { indexes, session };
}

export async function fetchLiveQuotes(base: Stock[]): Promise<LiveSnapshot | null> {
  try {
    const [meta, stocks] = await Promise.all([fetchIndexes(), refreshMarket(base)]);
    if (!stocks) return null;
    return {
      stocks,
      indexes: meta.indexes,
      session: meta.session,
      updatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}
