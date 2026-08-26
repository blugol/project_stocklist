import { useEffect } from "react";
import { SYNC } from "./lib/setup";

interface GuideProps {
  open: boolean;
  onClose: () => void;
}

export function Guide({ open, onClose }: GuideProps) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="guide-back" onClick={onClose}>
      <aside
        className="guide"
        role="dialog"
        aria-labelledby="guide-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="guide-top">
          <div>
            <p className="guide-kicker">동조 · 구간</p>
            <h2 id="guide-title">기준</h2>
          </div>
          <button type="button" className="guide-close" onClick={onClose} title="닫기">
            닫기
          </button>
        </header>

        <p className="guide-lead">동조 업종의 시총 대장을 고르고, 구간을 봅니다.</p>

        <ol className="guide-steps">
          <li>
            <b>동조 섹터</b>
            기여도 1등보다, 윗물이 같이 빨간 업종을 먼저 봅니다.
          </li>
          <li>
            <b>대장 1~2개</b>
            그 업종을 눌러 확대하고, 코스피·코스닥 시총 대장만 관심에 담습니다. 등락률 1등이
            아닙니다.
          </li>
          <li>
            <b>구간</b>
            초입이면 돌파, 고구간이면 눌림. 중간은 추격하지 않습니다.
          </li>
          <li>
            <b>HTS</b>
            담아 둔 종목만 3분봉을 엽니다. 9:00~9:30과 첫 캔들은 건너뜁니다.
          </li>
        </ol>

        <section>
          <h3>기여도</h3>
          <p>
            시총 비중 × 등락률입니다. 시장을 얼마나 밀었는지입니다. 작은 업종이 +10%여도 시총이
            작으면 기여는 작습니다.
          </p>
        </section>

        <section>
          <h3>동조</h3>
          <p>
            시총 상위 {SYNC.topN}종목 중 {SYNC.needLarge}개 이상이 +{SYNC.lit}% 이상이고, 그 평균도
            +{SYNC.avg}% 이상이면 붙습니다. 대장 혼자 오르거나 약하게만 오른 업종은 빠집니다.
          </p>
        </section>

        <section>
          <h3>등락 구간</h3>
          <ul className="guide-zones">
            <li>
              <em className="zone zone-down">하락</em> 0% 미만. 후보에서 뺍니다.
            </li>
            <li>
              <em className="zone zone-early">초입</em> 10% 미만. 돌파 관점.
            </li>
            <li>
              <em className="zone zone-mid">중간</em> 10~15%. 흐름만 봅니다.
            </li>
            <li>
              <em className="zone zone-high">고구간</em> 15% 이상. 눌림을 기다립니다.
            </li>
          </ul>
        </section>

        <section>
          <h3>쓰지 않는 신호</h3>
          <p>
            칸이 번쩍이는 것은 15초 동안 거래대금이 늘어난 표시입니다. 알림음은 관심 종목이 등락
            기준을 넘었다는 뜻입니다.
          </p>
        </section>
      </aside>
    </div>
  );
}
