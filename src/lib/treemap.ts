import type { HierarchyRectangularNode } from "d3-hierarchy";
import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import type { Market, MarketTree, SizeMode, Stock } from "../types";

function sizeOf(stock: Stock, mode: SizeMode): number {
  if (mode === "turnover") return Math.max(stock.turnover ?? 0, 1);
  return stock.marketCap;
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

export type TreemapDatum = MarketTree | { name: string; children: Stock[] } | Stock;

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

  const root = hierarchy<TreemapDatum>(source, (d) =>
    "children" in d ? d.children : undefined,
  )
    .sum((d) => ("code" in d && "marketCap" in d ? sizeOf(d, sizeMode) : 0))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  const compact = width < 640;
  treemap<TreemapDatum>()
    .tile(treemapSquarify.ratio(1.2))
    .size([width, height])
    .paddingInner(compact ? 4 : 2)
    .paddingOuter(compact ? 3 : 2)
    .paddingTop(compact ? 32 : 24)
    .round(true)(root);

  return root as HierarchyRectangularNode<TreemapDatum>;
}

export function isStock(d: TreemapDatum): d is Stock {
  return "code" in d && "marketCap" in d;
}

export type CellNode = HierarchyRectangularNode<TreemapDatum>;
