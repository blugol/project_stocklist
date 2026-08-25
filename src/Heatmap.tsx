import { useEffect, useMemo, useRef, useState } from "react";
import type { CellNode } from "./lib/treemap";
import { buildTree, isStock, layoutTreemap } from "./lib/treemap";
import { changeColor, changeTextColor, formatCap, formatChange, formatPrice } from "./lib/format";
import { priceZone, ZONE_HINT, ZONE_LABEL } from "./lib/setup";
import type { Market, SizeMode, Stock } from "./types";

interface HeatmapProps {
  stocks: Stock[];
  market: Market | "ALL";
  query: string;
  zoom: string | null;
  onZoom: (sector: string | null) => void;
  sizeMode?: SizeMode;
  flashCodes?: Set<string>;
  pinned?: Set<string>;
  synced?: Set<string>;
  onTogglePin?: (stock: Stock) => void;
}

function clipLabel(text: string, maxPx: number, fontPx: number): string {
  const max = Math.max(2, Math.floor(maxPx / (fontPx * 1.08)));
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

interface Tooltip {
  x: number;
  y: number;
  stock: Stock;
}

export function Heatmap({
  stocks,
  market,
  query,
  zoom,
  onZoom,
  sizeMode = "marketCap",
  flashCodes,
  pinned,
  synced,
  onTogglePin,
}: HeatmapProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef(onTogglePin);
  const stocksRef = useRef(stocks);
  pinRef.current = onTogglePin;
  stocksRef.current = stocks;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [docked, setDocked] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    obs.observe(el);
    const onPin = (e: MouseEvent) => {
      const cell = (e.target as Element | null)?.closest?.("g.cell");
      const code = cell?.getAttribute("data-code");
      if (!code) return;
      const stock = stocksRef.current.find((s) => s.code === code);
      if (!stock) return;
      pinRef.current?.(stock);
      if (window.matchMedia("(pointer: coarse)").matches) {
        setDocked(true);
        setTooltip({ x: 0, y: 0, stock });
      }
    };
    el.addEventListener("click", onPin);
    const onResize = () => {
      if (!window.matchMedia("(pointer: coarse)").matches) {
        setDocked(false);
        setTooltip(null);
      }
    };
    window.addEventListener("resize", onResize);
    return () => {
      obs.disconnect();
      el.removeEventListener("click", onPin);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const tree = useMemo(
    () => buildTree(stocks, market, sizeMode),
    [stocks, market, sizeMode],
  );
  const root = useMemo(() => {
    if (size.w < 8 || size.h < 8) return null;
    return layoutTreemap(tree, size.w, size.h, zoom, sizeMode);
  }, [tree, size, zoom, sizeMode]);

  const highlight = query.trim().toLowerCase();

  const compact = size.w > 0 && size.w < 640;
  const cells = root?.leaves() ?? [];
  const sectors = root?.children ?? [];

  return (
    <div className="map-wrap" ref={wrapRef}>
      {zoom && (
        <button className="back" onClick={() => onZoom(null)} type="button" title="업종 확대를 닫고 전체를 봅니다">
          ← 전체
        </button>
      )}
      {stocks.length === 0 && (
        <div className="map-empty">관심에 담은 종목이 없습니다. 칸을 눌러 담아 주세요.</div>
      )}
      {root && stocks.length > 0 && (
        <svg width={size.w} height={size.h} className="map">
          {sectors.map((sector) => {
            const d = sector.data;
            if (isStock(d)) return null;
            const label = "name" in d ? d.name : "";
            const w = sector.x1 - sector.x0;
            const barH = compact ? 30 : 22;
            const labelSize = compact ? 14 : 12;
            if (w < (compact ? 64 : 48)) return null;
            return (
              <g key={label}>
                <rect
                  x={sector.x0}
                  y={sector.y0}
                  width={w}
                  height={barH}
                  className="sector-bar"
                  onClick={() => onZoom(zoom === label ? null : label)}
                />
                <text
                  x={sector.x0 + 8}
                  y={sector.y0 + (compact ? 20 : 15)}
                  className="sector-label"
                  fontSize={labelSize}
                  onClick={() => onZoom(zoom === label ? null : label)}
                >
                  {`${clipLabel(label, w - 22, labelSize)} ›`}
                </text>
              </g>
            );
          })}
          {cells.map((node: CellNode) => {
            const stock = node.data;
            if (!isStock(stock)) return null;
            const w = node.x1 - node.x0;
            const h = node.y1 - node.y0;
            if (w < 2 || h < 2) return null;
            const match =
              !highlight ||
              stock.name.toLowerCase().includes(highlight) ||
              stock.code.includes(highlight);
            const font = compact
              ? Math.max(13, Math.min(18, w / 5.2, h / 2.4))
              : Math.max(11, Math.min(15, w / 7, h / 3.2));
            const nameBudget = Math.floor((w - 10) / (font * 1.08));
            const showName = compact
              ? w >= 72 && h >= 40 && nameBudget >= 3
              : w >= 44 && h >= 28;
            const showPct = compact
              ? w >= 58 && h >= (showName ? 56 : 32)
              : w >= 44 && h >= 42;
            const flashing = flashCodes?.has(stock.code);
            const isPinned = pinned?.has(stock.code);
            const className = [
              "cell",
              match ? "" : "dim",
              flashing ? "flash" : "",
              isPinned ? "pinned" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <g
                key={`${stock.market}-${stock.code}`}
                className={className}
                data-code={stock.code}
                onMouseMove={(e) => {
                  if (window.matchMedia("(pointer: coarse)").matches) return;
                  const box = wrapRef.current?.getBoundingClientRect();
                  if (!box) return;
                  setDocked(false);
                  setTooltip({
                    x: e.clientX - box.left,
                    y: e.clientY - box.top,
                    stock,
                  });
                }}
                onMouseLeave={() => {
                  if (window.matchMedia("(pointer: coarse)").matches) return;
                  setTooltip(null);
                }}
              >
                <rect
                  x={node.x0}
                  y={node.y0}
                  width={w}
                  height={h}
                  fill={changeColor(stock.change)}
                />
                {showName && (
                  <text
                    x={node.x0 + w / 2}
                    y={node.y0 + h / 2 - (showPct ? 6 : 0)}
                    className="cell-name"
                    fontSize={font}
                  >
                    {clipLabel(stock.name, w - 8, font)}
                  </text>
                )}
                {showPct && (
                  <text
                    x={node.x0 + w / 2}
                    y={node.y0 + h / 2 + font}
                    className="cell-pct"
                    fontSize={compact ? Math.max(12, font - 1) : Math.max(10, font - 1)}
                  >
                    {formatChange(stock.change)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {root && stocks.length > 0 && (
        <p className="map-hint">칸을 누르면 관심 · 업종 이름을 누르면 확대 · 색은 등락률</p>
      )}
      {tooltip && (
        <div
          className={`tip ${docked ? "tip-dock" : ""}`}
          style={
            docked
              ? undefined
              : {
                  left: Math.min(tooltip.x + 14, size.w - 220),
                  top: Math.min(tooltip.y + 14, size.h - 200),
                }
          }
        >
          <div className="tip-name">{tooltip.stock.name}</div>
          <div className="tip-meta">
            {tooltip.stock.market} · {tooltip.stock.code} · {tooltip.stock.sector}
            {pinned?.has(tooltip.stock.code) ? " · 관심" : " · 클릭 시 관심"}
          </div>
          <div className="tip-row">
            <span>구간</span>
            <b>
              {ZONE_LABEL[priceZone(tooltip.stock.change)]}
              {synced?.has(tooltip.stock.sector) ? " · 동조" : ""}
            </b>
          </div>
          <p className="tip-note">{ZONE_HINT[priceZone(tooltip.stock.change)]}</p>
          <div className="tip-row">
            <span>현재가</span>
            <b>{formatPrice(tooltip.stock.price)}</b>
          </div>
          <div className="tip-row">
            <span>등락률</span>
            <b style={{ color: changeTextColor(tooltip.stock.change) }}>
              {formatChange(tooltip.stock.change)}
            </b>
          </div>
          <div className="tip-row">
            <span>시가총액</span>
            <b>{formatCap(tooltip.stock.marketCap)}</b>
          </div>
          {tooltip.stock.turnover != null && tooltip.stock.turnover > 0 && (
            <div className="tip-row">
              <span>거래대금</span>
              <b>{formatCap(tooltip.stock.turnover)}</b>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
