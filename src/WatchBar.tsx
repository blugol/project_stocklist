import type { ReactNode } from "react";
import type { Market, SizeMode, Stock } from "./types";
import { PIN_MAX } from "./lib/watch";
import { priceZone, ZONE_HINT, ZONE_LABEL } from "./lib/setup";

type MarketFilter = Market | "ALL";

interface WatchBarProps {
  market: MarketFilter;
  onMarket: (market: MarketFilter) => void;
  query: string;
  onQuery: (query: string) => void;
  sizeMode: SizeMode;
  onSizeMode: (mode: SizeMode) => void;
  watchOnly: boolean;
  onWatchOnly: (on: boolean) => void;
  pins: Stock[];
  synced: Set<string>;
  onUnpin: (code: string) => void;
  alertOn: boolean;
  onAlertOn: (on: boolean) => void;
  threshold: number;
  onThreshold: (value: number) => void;
}

function Group({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="tool">
      <span className="tool-k">{label}</span>
      {children}
      <span className="tool-d">{hint}</span>
    </div>
  );
}

export function WatchBar({
  market,
  onMarket,
  query,
  onQuery,
  sizeMode,
  onSizeMode,
  watchOnly,
  onWatchOnly,
  pins,
  synced,
  onUnpin,
  alertOn,
  onAlertOn,
  threshold,
  onThreshold,
}: WatchBarProps) {
  return (
    <div className="toolbar">
      <Group label="시장" hint="볼 거래소">
        <div className="tabs">
          {(["ALL", "KOSPI", "KOSDAQ"] as const).map((key) => (
            <button
              key={key}
              type="button"
              className={market === key && !watchOnly ? "on" : ""}
              title={
                key === "ALL"
                  ? "코스피와 코스닥을 함께 봅니다"
                  : key === "KOSPI"
                    ? "유가증권시장만 봅니다"
                    : "코스닥만 봅니다"
              }
              onClick={() => onMarket(key)}
            >
              {key === "ALL" ? "전체" : key === "KOSPI" ? "코스피" : "코스닥"}
            </button>
          ))}
        </div>
      </Group>

      <Group label="칸 크기" hint="넓이가 의미하는 값">
        <div className="tabs">
          <button
            type="button"
            className={sizeMode === "marketCap" ? "on" : ""}
            title="칸이 클수록 시가총액이 큽니다. 색은 등락률입니다."
            onClick={() => onSizeMode("marketCap")}
          >
            시총
          </button>
          <button
            type="button"
            className={sizeMode === "turnover" ? "on" : ""}
            title="칸이 클수록 오늘 거래대금이 큽니다. 색은 등락률입니다."
            onClick={() => onSizeMode("turnover")}
          >
            거래대금
          </button>
        </div>
      </Group>

      <Group label="관심" hint="칸을 눌러 담기">
        <div className="watch-row">
          <button
            type="button"
            className={`watch-toggle ${watchOnly ? "on" : ""}`}
            title="담아 둔 종목만 지도에 남깁니다. 다시 누르면 전체로 돌아갑니다."
            onClick={() => onWatchOnly(!watchOnly)}
          >
            {pins.length}/{PIN_MAX}
          </button>
          <label className="alert-toggle" title="담아 둔 종목이 기준 등락률을 넘으면 소리가 납니다.">
            <input
              type="checkbox"
              checked={alertOn}
              onChange={(e) => onAlertOn(e.target.checked)}
            />
            알림
          </label>
          <label className="alert-th" title="알림이 울리는 등락률입니다. 이미 넘은 종목은 다시 넘을 때만 울립니다.">
            ±
            <input
              type="number"
              min={0.5}
              max={15}
              step={0.5}
              value={threshold}
              onChange={(e) => onThreshold(Number(e.target.value) || 3)}
            />
            %
          </label>
        </div>
      </Group>

      <Group label="찾기" hint="이름·코드">
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="종목 / 코드"
          title="일치하는 칸만 밝게 남깁니다."
        />
      </Group>

      <div className="pins">
        {pins.length === 0 && (
          <span className="pins-hint">아직 담은 종목이 없습니다</span>
        )}
        {pins.map((stock) => {
          const zone = priceZone(stock.change);
          const sync = synced.has(stock.sector);
          return (
            <button
              key={stock.code}
              type="button"
              className="pin-chip"
              onClick={() => onUnpin(stock.code)}
              title={`${ZONE_HINT[zone]}${sync ? " 주도 섹터 동조." : ""} 클릭하면 관심 해제.`}
            >
              {stock.name}
              <em className={`zone zone-${zone}`}>{ZONE_LABEL[zone]}</em>
              {sync && <em className="sync">동조</em>}
              <span aria-hidden>×</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
