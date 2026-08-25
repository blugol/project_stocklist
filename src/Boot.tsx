interface BootProps {
  done: number;
  total: number;
}

export function Boot({ done, total }: BootProps) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 8;
  return (
    <div className="boot">
      <p className="boot-kicker">시황 창</p>
      <h1>코스피 · 코스닥</h1>
      <p className="boot-copy">목록이 채워지기 전에는 지도를 열지 않습니다.</p>
      <div className="boot-track" aria-hidden>
        <div className="boot-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="boot-stat">
        {total > 0 ? `업종 ${done} / ${total}` : "시세와 업종을 같이 불러오는 중"}
      </p>
    </div>
  );
}
