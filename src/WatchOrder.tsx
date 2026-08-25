import { useEffect } from "react";
import { changeTextColor, formatChange } from "./lib/format";
import { ZONE_HINT, ZONE_LABEL } from "./lib/setup";
import type { WatchLane, WatchOrder, WatchPick } from "./lib/watchOrder";
import { MARKET_LABEL, watchOrderNotes, watchPickCount } from "./lib/watchOrder";
import { PIN_MAX } from "./lib/watch";
import type { Stock } from "./types";

interface WatchOrderProps {
  open: boolean;
  order: WatchOrder;
  pinned: Set<string>;
  pinCount: number;
  zoom: string | null;
  onClose: () => void;
  onFocus: (stock: Stock) => void;
  onTogglePin: (stock: Stock) => void;
}

const LANES: { key: WatchLane; title: string }[] = [
  { key: "early", title: "초입 · 돌파 관점" },
  { key: "high", title: "고구간 · 눌림을 기다림" },
  { key: "mid", title: "중간 · 추격하지 않음" },
];

export function WatchOrderPanel({
  open,
  order,
  pinned,
  pinCount,
  zoom,
  onClose,
  onFocus,
  onTogglePin,
}: WatchOrderProps) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const total = watchPickCount(order);

  return (
    <div className="guide-back" onClick={onClose}>
      <aside
        className="guide order-sheet"
        role="dialog"
        aria-labelledby="order-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="guide-top">
          <div>
            <p className="guide-kicker">오늘 어디를 볼지</p>
            <h2 id="order-title">볼 순서</h2>
          </div>
          <button type="button" className="guide-close" onClick={onClose} title="닫기">
            닫기
          </button>
        </header>

        <p className="guide-lead">
          동조 업종 {order.syncedCount}곳 중 기여가 큰 {order.sectorCount}곳입니다. 업종마다
          코스피 시총 1등과 코스닥 시총 1등입니다. 등락률 1등이 아닙니다. 타점은 HTS 3분봉에서
          봅니다.
        </p>

        {total === 0 ? (
          <p className="order-empty">지금은 동조 업종이 없습니다. 윗물이 같이 오를 때까지 기다립니다.</p>
        ) : (
          <>
            <section className="order-notes">
              <h3>업종별로 보면</h3>
              <p>
                초입 {order.early.length} · 고구간 {order.high.length} · 중간 {order.mid.length}. 이미
                골라 둔 대장입니다. 매수 사인이 아닙니다.
              </p>
              <ul>
                {watchOrderNotes(order).map((note) => (
                  <li key={note.sector}>
                    <b>{note.sector}</b>
                    {note.line}
                  </li>
                ))}
              </ul>
            </section>
          {LANES.map((lane) => {
            const rows = order[lane.key];
            if (!rows.length) return null;
            return (
              <section key={lane.key} className="order-lane">
                <h3>{lane.title}</h3>
                <p>{ZONE_HINT[lane.key]}</p>
                <ol className="order-list">
                  {rows.map((pick) => (
                    <OrderRow
                      key={pick.stock.code}
                      pick={pick}
                      pinned={pinned.has(pick.stock.code)}
                      pinFull={pinCount >= PIN_MAX && !pinned.has(pick.stock.code)}
                      active={zoom === pick.stock.sector}
                      onFocus={onFocus}
                      onTogglePin={onTogglePin}
                    />
                  ))}
                </ol>
              </section>
            );
          })}
          </>
        )}
      </aside>
    </div>
  );
}

function OrderRow({
  pick,
  pinned,
  pinFull,
  active,
  onFocus,
  onTogglePin,
}: {
  pick: WatchPick;
  pinned: boolean;
  pinFull: boolean;
  active: boolean;
  onFocus: (stock: Stock) => void;
  onTogglePin: (stock: Stock) => void;
}) {
  const { stock } = pick;
  return (
    <li className={active ? "on" : ""}>
      <button
        type="button"
        className="order-main"
        title="이 업종만 확대하고 칸을 밝힙니다"
        onClick={() => onFocus(stock)}
      >
        <span className="order-rank">{pick.rank}</span>
        <span className="order-body">
          <span className="order-name">
            {stock.name}
            <em className="order-mkt">{MARKET_LABEL[stock.market]}</em>
            <em className={`zone zone-${pick.zone}`}>{ZONE_LABEL[pick.zone]}</em>
            {pick.role === 1 ? <em className="sync">대장</em> : <em className="order-role">2번</em>}
          </span>
          <span className="order-meta">
            {stock.sector} · 동조 {pick.lit}개 +{pick.avg.toFixed(1)}%
          </span>
        </span>
        <b className="order-chg" style={{ color: changeTextColor(stock.change) }}>
          {formatChange(stock.change)}
        </b>
      </button>
      <button
        type="button"
        className={`order-pin ${pinned ? "on" : ""}`}
        disabled={pinFull}
        title={
          pinned
            ? "관심에서 뺍니다"
            : pinFull
              ? "관심은 15개까지입니다"
              : "관심에 담습니다. HTS에서 이 종목만 봅니다."
        }
        onClick={() => onTogglePin(stock)}
      >
        {pinned ? "담김" : "담기"}
      </button>
    </li>
  );
}
