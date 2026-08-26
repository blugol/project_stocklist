import { useEffect, useState } from "react";
import { changeTextColor, formatChange } from "./lib/format";
import {
  copyText,
  downloadText,
  formatLogDate,
  formatOrderDay,
  formatOrderLog,
  loadOrderLog,
  type OrderLogDay,
} from "./lib/orderLog";
import { ZONE_HINT, ZONE_LABEL } from "./lib/setup";
import type { WatchLane, WatchOrder, WatchPick } from "./lib/watchOrder";
import { MARKET_LABEL, watchOrderLead, watchOrderNotes, watchPickCount } from "./lib/watchOrder";
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
  const [view, setView] = useState<"today" | "log">("today");
  const [days, setDays] = useState<OrderLogDay[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [hint, setHint] = useState("");

  useEffect(() => {
    if (!open) {
      setView("today");
      setPicked(null);
      setHint("");
      return undefined;
    }
    setDays(loadOrderLog());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const total = watchPickCount(order);
  const lead = total > 0 ? watchOrderLead(order) : null;
  const day = picked ? days.find((row) => row.date === picked) : null;

  const tell = (ok: boolean) => {
    setHint(ok ? "복사했습니다" : "복사하지 못했습니다");
    window.setTimeout(() => setHint(""), 1600);
  };

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
            <p className="guide-kicker">{view === "today" ? "동조 업종 대장" : "날짜별 목록"}</p>
            <h2 id="order-title">{view === "today" ? "금일 주도주" : "기록"}</h2>
          </div>
          <button type="button" className="guide-close" onClick={onClose} title="닫기">
            닫기
          </button>
        </header>

        <div className="order-switch" role="tablist" aria-label="금일 주도주와 기록">
          <button
            type="button"
            role="tab"
            aria-selected={view === "today"}
            className={view === "today" ? "on" : ""}
            onClick={() => {
              setView("today");
              setPicked(null);
              setHint("");
            }}
          >
            오늘
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "log"}
            className={view === "log" ? "on" : ""}
            onClick={() => {
              setView("log");
              setDays(loadOrderLog());
              setHint("");
            }}
          >
            기록
          </button>
        </div>

        {view === "log" ? (
          <OrderLog
            days={days}
            day={day}
            hint={hint}
            onOpen={(date) => {
              setPicked(date);
              setHint("");
            }}
            onBack={() => {
              setPicked(null);
              setHint("");
            }}
            onCopyDay={async (row) => tell(await copyText(formatOrderDay(row)))}
            onSaveDay={(row) => downloadText(`금일주도주-${row.date}.txt`, formatOrderDay(row))}
            onCopyAll={async () => tell(await copyText(formatOrderLog(days)))}
            onSaveAll={() => downloadText("금일주도주-기록.txt", formatOrderLog(days))}
          />
        ) : !lead ? (
          <p className="guide-lead">지금은 동조 업종이 없습니다. 윗물이 같이 오를 때까지 기다립니다.</p>
        ) : (
          <>
            <section className="order-hero">
              <p className="order-hero-kicker">먼저 볼 업종</p>
              <ul className="order-hero-tags">
                {lead.sectors.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
              {lead.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </section>

            <section className="order-notes">
              <h3>업종별로 보면</h3>
              <p>시총 대장 기준입니다. 등락률 1등이 아닙니다.</p>
              <ul>
                {watchOrderNotes(order).map((note) => (
                  <li key={note.sector}>
                    <b>{note.sector}</b>
                    {note.lines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                    <span className="order-note-names">
                      {note.names.map((name) => (
                        <em key={name}>{name}</em>
                      ))}
                    </span>
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

function OrderLog({
  days,
  day,
  hint,
  onOpen,
  onBack,
  onCopyDay,
  onSaveDay,
  onCopyAll,
  onSaveAll,
}: {
  days: OrderLogDay[];
  day: OrderLogDay | null | undefined;
  hint: string;
  onOpen: (date: string) => void;
  onBack: () => void;
  onCopyDay: (day: OrderLogDay) => void;
  onSaveDay: (day: OrderLogDay) => void;
  onCopyAll: () => void;
  onSaveAll: () => void;
}) {
  if (day) {
    return (
      <section className="order-log-day">
        <button type="button" className="order-log-back" onClick={onBack}>
          ← 목록
        </button>
        <h3>{formatLogDate(day.date)}</h3>
        <p>
          {day.session === "OPEN" ? "정규장" : "장마감"}에 남겼습니다.
        </p>
        {!day.picks.length ? (
          <p className="order-empty">이날 동조 업종이 없었습니다.</p>
        ) : (
          <>
            {day.sectors.length > 0 && (
              <ul className="order-hero-tags">
                {day.sectors.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            )}
            <ol className="order-log-picks">
              {day.picks.map((pick) => (
                <li key={`${pick.code}-${pick.rank}`}>
                  <span>
                    <b>
                      {pick.rank}. {pick.name}
                    </b>
                    <em>
                      {MARKET_LABEL[pick.market]} · {ZONE_LABEL[pick.zone]} · {pick.sector}
                    </em>
                  </span>
                  <strong className={pick.change >= 0 ? "up" : "down"}>{formatChange(pick.change)}</strong>
                </li>
              ))}
            </ol>
          </>
        )}
        <div className="order-log-actions">
          <button type="button" onClick={() => onCopyDay(day)}>
            이 날 복사
          </button>
          <button type="button" onClick={() => onSaveDay(day)}>
            txt 받기
          </button>
        </div>
        {hint && <p className="order-log-hint">{hint}</p>}
      </section>
    );
  }

  if (!days.length) {
    return (
      <p className="guide-lead">
        아직 쌓인 날이 없습니다. 시세가 뜨면 오늘 목록부터 이 기기에 남깁니다.
      </p>
    );
  }

  return (
    <section className="order-log">
      <p className="guide-lead">날짜별로 남긴 목록입니다.</p>
      <ul className="order-log-list">
        {days.map((row) => (
          <li key={row.date}>
            <button type="button" onClick={() => onOpen(row.date)}>
              <b>{formatLogDate(row.date)}</b>
              <span>
                {row.picks.length
                  ? row.picks.map((pick) => pick.name).join(" · ")
                  : "동조 없음"}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="order-log-actions">
        <button type="button" onClick={onCopyAll}>
          전체 복사
        </button>
        <button type="button" onClick={onSaveAll}>
          전체 txt
        </button>
      </div>
      {hint && <p className="order-log-hint">{hint}</p>}
    </section>
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
          <span className="order-head">
            <span className="order-title">{stock.name}</span>
            <b className="order-chg" style={{ color: changeTextColor(stock.change) }}>
              {formatChange(stock.change)}
            </b>
          </span>
          <span className="order-tags">
            <em className="order-mkt">{MARKET_LABEL[stock.market]}</em>
            <em className={`zone zone-${pick.zone}`}>{ZONE_LABEL[pick.zone]}</em>
            {pick.role === 1 ? <em className="sync">대장</em> : <em className="order-role">2번</em>}
          </span>
          <span className="order-meta">
            {stock.sector} · 동조 {pick.lit}개 +{pick.avg.toFixed(1)}%
          </span>
        </span>
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
