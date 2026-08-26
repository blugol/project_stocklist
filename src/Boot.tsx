interface BootProps {
  done: number;
  total: number;
}

export function Boot({ done, total }: BootProps) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 8;
  return (
    <div className="boot">
      <div className="boot-inner">
        <p className="boot-kicker">시황 창</p>
        <h1>오늘 어디를 볼지</h1>
        <p className="boot-copy">
          햄버거를 어디에 대입할지 고르는 화면입니다. 타점은 HTS 3분봉입니다.
        </p>
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
