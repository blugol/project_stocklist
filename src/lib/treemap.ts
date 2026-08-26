import type { HierarchyRectangularNode } from "d3-hierarchy";
import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import type { Market, MarketTree, SizeMode, Stock } from "../types";

function sizeOf(stock: Stock, mode: SizeMode): number {
  if (mode === "turnover") return Math.max(stock.turnover ?? 0, 1);
  return stock.marketCap;
}

export interface OtherGroup {
  other: true;
  name: string;
  sector: string;
  stocks: Stock[];
  marketCap: number;
  turnover: number;
  change: number;
}

function sizeOfLeaf(d: Stock | OtherGroup, mode: SizeMode): number {
  if (isOther(d)) {
    if (mode === "turnover") return Math.max(d.turnover, 1);
    return Math.max(d.marketCap, 1);
  }
  return sizeOf(d, mode);
}

function packOther(stocks: Stock[], sector: string, sizeMode: SizeMode): OtherGroup {
  const marketCap = stocks.reduce((sum, s) => sum + s.marketCap, 0);
  const turnover = stocks.reduce((sum, s) => sum + (s.turnover ?? 0), 0);
  const weight = (s: Stock) => sizeOf(s, sizeMode);
  const wsum = stocks.reduce((sum, s) => sum + weight(s), 0);
  const change = stocks.reduce((sum, s) => sum + s.change * weight(s), 0) / Math.max(wsum, 1);
  return {
    other: true,
    name: `기타 ${stocks.length}`,
    sector,
    stocks: [...stocks].sort((a, b) => weight(b) - weight(a)),
    marketCap,
    turnover,
    change,
  };
}

export function buildTree(
  stocks: Stock[],
  market: Market | "ALL",
  sizeMode: SizeMode = "marketCap",
): MarketTree {
  const filtered =
    market === "ALL" ? stocks : stocks.filter((s) => s.market === market);

  const bySector = new Map<string, Stock[]>();
  for (const stock of filtered) {
    const list = bySector.get(stock.sector) ?? [];
    list.push(stock);
    bySector.set(stock.sector, list);
  }

  const children = [...bySector.entries()]
    .map(([name, items]) => ({
      name,
      children: [...items].sort((a, b) => sizeOf(b, sizeMode) - sizeOf(a, sizeMode)),
    }))
    .sort((a, b) => {
      const av = a.children.reduce((s, x) => s + sizeOf(x, sizeMode), 0);
      const bv = b.children.reduce((s, x) => s + sizeOf(x, sizeMode), 0);
      return bv - av;
    });

  return { name: "시장", children };
}

export type TreemapDatum = MarketTree | FoldedTree | FoldedSector | Stock | OtherGroup;

type FoldedSector = { name: string; children: Array<Stock | OtherGroup> };
type FoldedTree = { name: string; children: FoldedSector[] };

function layout(
  source: FoldedTree,
  width: number,
  height: number,
  sizeMode: SizeMode,
  compact: boolean,
): HierarchyRectangularNode<TreemapDatum> {
  const root = hierarchy<TreemapDatum>(source, (d) =>
    "children" in d ? d.children : undefined,
  )
    .sum((d) => (isStock(d) || isOther(d) ? sizeOfLeaf(d, sizeMode) : 0))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  treemap<TreemapDatum>()
    .tile(treemapSquarify.ratio(1.2))
    .size([width, height])
    .paddingInner(compact ? 4 : 2)
    .paddingOuter(compact ? 3 : 2)
    .paddingTop(compact ? 32 : 24)
    .round(true)(root);

  return root as HierarchyRectangularNode<TreemapDatum>;
}

function foldTiny(
  tree: MarketTree,
  root: HierarchyRectangularNode<TreemapDatum>,
  minW: number,
  minH: number,
  sizeMode: SizeMode,
): FoldedTree | null {
  const tiny = new Map<string, Stock[]>();
  const keep = new Map<string, Stock[]>();
  for (const leaf of root.leaves()) {
    if (!isStock(leaf.data)) continue;
    const w = leaf.x1 - leaf.x0;
    const h = leaf.y1 - leaf.y0;
    const sector = leaf.data.sector;
    const bucket = w < minW || h < minH ? tiny : keep;
    const list = bucket.get(sector) ?? [];
    list.push(leaf.data);
    bucket.set(sector, list);
  }

  let changed = false;
  const children = tree.children.map((sec) => {
    const rest = tiny.get(sec.name) ?? [];
    if (rest.length < 2) return sec;
    changed = true;
    const kept = [...(keep.get(sec.name) ?? [])].sort(
      (a, b) => sizeOf(b, sizeMode) - sizeOf(a, sizeMode),
    );
    return { name: sec.name, children: [...kept, packOther(rest, sec.name, sizeMode)] };
  });
  return changed ? { name: tree.name, children } : null;
}

export function layoutTreemap(
  tree: MarketTree,
  width: number,
  height: number,
  zoomSector: string | null,
  sizeMode: SizeMode = "marketCap",
): HierarchyRectangularNode<TreemapDatum> {
  const source: MarketTree = zoomSector
    ? {
        name: tree.name,
        children: tree.children.filter((c) => c.name === zoomSector),
      }
    : tree;

  const compact = width < 640;
  const minW = compact ? 64 : 44;
  const minH = compact ? 36 : 28;
  const first = layout(source, width, height, sizeMode, compact);
  const folded = foldTiny(source, first, minW, minH, sizeMode);
  if (!folded) return first;
  return layout(folded, width, height, sizeMode, compact);
}

export function isStock(d: TreemapDatum): d is Stock {
  return "code" in d && "marketCap" in d;
}

export function isOther(d: TreemapDatum): d is OtherGroup {
  return typeof d === "object" && d !== null && "other" in d && d.other === true;
}

export type CellNode = HierarchyRectangularNode<TreemapDatum>;
