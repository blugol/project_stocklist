interface BootProps {
  done: number;
  total: number;
}

export function Boot({ done, total }: BootProps) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 8;
  return (
    <div className="boot">
      <div className="boot-inner">
        <p className="boot-kicker">코스피 · 코스닥</p>
        <h1>금일 대장</h1>
        <p className="boot-copy">동조 업종의 시총 대장을 고릅니다.</p>
        <ol className="boot-steps">
          <li>동조 업종</li>
          <li>코스피 · 코스닥 시총 대장</li>
          <li>구간 → HTS 3분봉</li>
        </ol>
        <div className="boot-track" aria-hidden>
          <div className="boot-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
