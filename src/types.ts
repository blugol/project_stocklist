export type Market = "KOSPI" | "KOSDAQ";
export type SizeMode = "marketCap" | "turnover";

export interface Stock {
  name: string;
  code: string;
  market: Market;
  sector: string;
  marketCap: number;
  change: number;
  price: number;
  turnover?: number;
}

export interface SectorNode {
  name: string;
  children: Stock[];
}

export interface MarketTree {
  name: string;
  children: SectorNode[];
}
