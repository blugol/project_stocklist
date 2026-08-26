import { useEffect, useMemo, useRef, useState } from "react";
import { Boot } from "./Boot";
import { Guide } from "./Guide";
import { Heatmap } from "./Heatmap";
import { SectorPanel } from "./SectorPanel";
import { WatchBar } from "./WatchBar";
import { WatchOrderPanel } from "./WatchOrder";
import { STOCKS } from "./data/stocks";
import { beep, unlockAudio } from "./lib/alertSound";
import { formatChange, formatIndex, formatTime } from "./lib/format";
import { fetchIndexes, fetchLiveQuotes, type IndexQuote, type Session } from "./lib/quotes";
import { sectorStats } from "./lib/sectors";
import { syncSectors } from "./lib/setup";
import { rememberOrder } from "./lib/orderLog";
import { buildWatchOrder } from "./lib/watchOrder";
import { applyTicks, crossedAlert } from "./lib/ticks";
import { fetchMarketItems, fetchSectorMap, stocksFromItems } from "./lib/universe";
import { loadWatch, PIN_MAX, saveWatch } from "./lib/watch";
import type { Market, SizeMode, Stock } from "./types";

type MarketFilter = Market | "ALL";

const POLL_MS = 15000;

export default function App() {
  const saved = useRef(loadWatch());
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [indexes, setIndexes] = useState<IndexQuote[]>([]);
  const [live, setLive] = useState<"idle" | "live" | "sample">("idle");
  const [full, setFull] = useState(false);
  const [boot, setBoot] = useState({ done: 0, total: 0 });
  const [session, setSession] = useState<Session>("CLOSE");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [market, setMarket] = useState<MarketFilter>("ALL");
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState<string | null>(null);
  const [sizeMode, setSizeMode] = useState<SizeMode>("marketCap");
  const [watchOnly, setWatchOnly] = useState(false);
  const [pins, setPins] = useState<string[]>(saved.current.pins);
  const [alertOn, setAlertOn] = useState(saved.current.alertOn);
  const [threshold, setThreshold] = useState(saved.current.threshold);
  const [flashCodes, setFlashCodes] = useState<Set<string>>(new Set());
  const [guide, setGuide] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const gotLive = useRef(false);
  const universe = useRef<Stock[]>([]);
  const tickCache = useRef(new Map());
  const alertRef = useRef({ alertOn, pins, threshold });
  alertRef.current = { alertOn, pins, threshold };

  useEffect(() => {
    saveWatch({ pins, alertOn, threshold });
  }, [pins, alertOn, threshold]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const load = async () => {
      const snap = await fetchLiveQuotes(universe.current);
      if (cancelled) return;
      if (snap) {
        gotLive.current = true;
        universe.current = snap.stocks;
        setStocks(snap.stocks);
        setIndexes(snap.indexes);
        setSession(snap.session);
        setUpdatedAt(snap.updatedAt);
        setLive("live");
        if (snap.stocks.length > 50) setFull(true);
      } else if (!gotLive.current) {
        universe.current = STOCKS;
        setStocks(STOCKS);
        setLive("sample");
      }
    };

    const bootApp = async () => {
      try {
        const [sectors, items, meta] = await Promise.all([
          fetchSectorMap((done, total) => {
            if (!cancelled) setBoot({ done, total });
          }),
          fetchMarketItems(),
          fetchIndexes(),
        ]);
        if (cancelled) return;
        const all = stocksFromItems(items, sectors);
        if (all.length > 50) {
          universe.current = all;
          setStocks(all);
          setFull(true);
          gotLive.current = true;
          setIndexes(meta.indexes);
          setSession(meta.session);
          setUpdatedAt(Date.now());
          setLive("live");
        } else {
          await load();
        }
      } catch {
        if (cancelled) return;
        await load();
      }
      if (cancelled) return;
      timer = window.setInterval(load, POLL_MS);
    };

    bootApp();
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (live === "idle") return undefined;
    const { surgeCodes, crossed } = applyTicks(stocks, tickCache.current, session);
    const { alertOn: on, pins: watch, threshold: line } = alertRef.current;
    if (on) {
      const hits = crossedAlert(watch, crossed, line);
      if (hits.length) beep();
    }
    if (!surgeCodes.length) return undefined;
    setFlashCodes(new Set(surgeCodes));
    const clear = window.setTimeout(() => setFlashCodes(new Set()), 1200);
    return () => window.clearTimeout(clear);
  }, [stocks, session, live]);

  const pinSet = useMemo(() => new Set(pins), [pins]);
  const pinnedStocks = useMemo(
    () => pins.map((code) => stocks.find((s) => s.code === code)).filter((s): s is Stock => Boolean(s)),
    [pins, stocks],
  );

  const scoped = useMemo(
    () => (market === "ALL" ? stocks : stocks.filter((s) => s.market === market)),
    [stocks, market],
  );
  const visible = useMemo(() => {
    if (!watchOnly) return scoped;
    return scoped.filter((s) => pinSet.has(s.code));
  }, [scoped, watchOnly, pinSet]);

  const stats = useMemo(() => sectorStats(scoped), [scoped]);
  const synced = useMemo(() => syncSectors(scoped), [scoped]);
  const watchOrder = useMemo(() => {
    const contribution = new Map(stats.map((s) => [s.name, s.contribution]));
    return buildWatchOrder(scoped, synced, contribution);
  }, [scoped, synced, stats]);
  const logOrder = useMemo(() => {
    if (market === "ALL") return watchOrder;
    const allStats = sectorStats(stocks);
    const allSynced = syncSectors(stocks);
    const contribution = new Map(allStats.map((s) => [s.name, s.contribution]));
    return buildWatchOrder(stocks, allSynced, contribution);
  }, [market, watchOrder, stocks]);
  const sectorCount = useMemo(() => new Set(scoped.map((s) => s.sector)).size, [scoped]);

  useEffect(() => {
    if (live !== "live") return;
    rememberOrder(logOrder, session, indexes);
  }, [live, logOrder, session, indexes]);

  const avg =
    scoped.reduce((s, x) => s + x.change * x.marketCap, 0) /
    Math.max(scoped.reduce((s, x) => s + x.marketCap, 0), 1);

  const sessionLabel = session === "OPEN" ? "정규장" : "장마감";
  const status =
    live === "live"
      ? `${sessionLabel} ${updatedAt ? formatTime(updatedAt) : ""}`.trim()
      : live === "sample"
        ? "샘플"
        : "불러오는 중";

  const togglePin = (stock: Stock) => {
    setPins((prev) => {
      if (prev.includes(stock.code)) return prev.filter((code) => code !== stock.code);
      if (prev.length >= PIN_MAX) return prev;
      return [...prev, stock.code];
    });
  };

  if (live === "idle") {
    return <Boot done={boot.done} total={boot.total} />;
  }

  return (
    <div className="app">
      <header className="chrome">
        <div className="board">
          <div className="indexes">
            {indexes.map((idx) => (
              <div key={idx.code} className="idx">
                <span className="idx-name">{idx.code === "KOSPI" ? "코스피" : "코스닥"}</span>
                <b className="idx-val">{formatIndex(idx.value)}</b>
                <b className={idx.change >= 0 ? "up" : "down"}>{formatChange(idx.change)}</b>
              </div>
            ))}
            <div className="idx">
              <span className="idx-name">시총가중</span>
              <b className={`idx-val ${avg >= 0 ? "up" : "down"}`}>
                {avg >= 0 ? "+" : ""}
                {avg.toFixed(2)}%
              </b>
            </div>
          </div>
          <div className="board-side">
            <span className="status" title={full ? "ETF·ETN 제외" : "업종 목록을 가져오는 중입니다"}>
              {live === "live" && (
                <span className="live-mark">
                  <i />
                </span>
              )}
              {status}
              {" · "}
              {watchOnly ? visible.length : scoped.length}종목
              {full ? ` · ${sectorCount}업종` : " · 목록 준비 중"}
            </span>
            <div className="legend" title="칸 색. 파랑은 하락, 빨강은 상승">
              <span>−6%</span>
              <div className="bar" />
              <span>+6%</span>
            </div>
            <div className="board-actions">
              <button
                type="button"
                className={`guide-open order-open ${orderOpen ? "on" : ""}`}
                aria-expanded={orderOpen}
                title="동조 업종의 시총 대장을 엽니다"
                onClick={() => {
                  setGuide(false);
                  setOrderOpen(true);
                }}
              >
                금일 주도주
                {watchOrder.early.length > 0 && (
                  <i className="order-count">{watchOrder.early.length}</i>
                )}
              </button>
              <button
                type="button"
                className={`guide-open ${guide ? "on" : ""}`}
                aria-expanded={guide}
                title="동조와 구간 기준을 엽니다"
                onClick={() => {
                  setOrderOpen(false);
                  setGuide(true);
                }}
              >
                기준
              </button>
            </div>
          </div>
        </div>

        <WatchBar
          market={market}
          onMarket={(key) => {
            setMarket(key);
            setWatchOnly(false);
            setZoom(null);
          }}
          query={query}
          onQuery={setQuery}
          sizeMode={sizeMode}
          onSizeMode={setSizeMode}
          watchOnly={watchOnly}
          onWatchOnly={(on) => {
            setWatchOnly(on);
            setZoom(null);
          }}
          pins={pinnedStocks}
          synced={synced}
          onUnpin={(code) => setPins((prev) => prev.filter((c) => c !== code))}
          alertOn={alertOn}
          onAlertOn={(on) => {
            if (on) unlockAudio();
            setAlertOn(on);
          }}
          threshold={threshold}
          onThreshold={setThreshold}
        />
      </header>

      <div className="stage">
        <Heatmap
          stocks={visible}
          market="ALL"
          query={query}
          zoom={zoom}
          onZoom={setZoom}
          sizeMode={sizeMode}
          flashCodes={flashCodes}
          pinned={pinSet}
          synced={synced}
          onTogglePin={togglePin}
        />
        <SectorPanel stats={stats} synced={synced} zoom={zoom} onZoom={setZoom} />
      </div>
      <WatchOrderPanel
        open={orderOpen}
        order={watchOrder}
        pinned={pinSet}
        pinCount={pins.length}
        zoom={zoom}
        onClose={() => setOrderOpen(false)}
        onFocus={(stock) => {
          setWatchOnly(false);
          setZoom(stock.sector);
          setQuery(stock.name);
        }}
        onTogglePin={togglePin}
      />
      <Guide open={guide} onClose={() => setGuide(false)} />
    </div>
  );
}
