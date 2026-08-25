import { changeColor, formatChange, formatContribution } from "./lib/format";
import { leadingSectors, type SectorStat } from "./lib/sectors";

interface SectorPanelProps {
  stats: SectorStat[];
  synced: Set<string>;
  zoom: string | null;
  onZoom: (sector: string | null) => void;
}

export function SectorPanel({ stats, synced, zoom, onZoom }: SectorPanelProps) {
  const { up, down } = leadingSectors(stats);
  const maxAbs = Math.max(...stats.map((s) => Math.abs(s.contribution)), 0.01);

  return (
    <aside className="sector-panel">
      <div className="sheet-handle" aria-hidden />
      <div className="lead-cards">
        {up && (
          <button
            type="button"
            className={`lead-card ${zoom === up.name ? "on" : ""}`}
            title={
              synced.has(up.name)
                ? "시총 상위 종목이 같이 오르는 섹터입니다. 눌러서 확대합니다."
                : "이 업종만 확대해서 봅니다. 다시 누르면 전체로 돌아갑니다."
            }
            onClick={() => onZoom(zoom === up.name ? null : up.name)}
          >
            <span className="lead-kicker up">
              상승 주도{synced.has(up.name) ? " · 동조" : ""}
            </span>
            <strong>{up.name}</strong>
            <span className="up">{formatChange(up.change)}</span>
            <em>
              {up.leader.name} {formatChange(up.leader.change)}
            </em>
          </button>
        )}
        {down && (
          <button
            type="button"
            className={`lead-card ${zoom === down.name ? "on" : ""}`}
            title="이 업종만 확대해서 봅니다. 다시 누르면 전체로 돌아갑니다."
            onClick={() => onZoom(zoom === down.name ? null : down.name)}
          >
            <span className="lead-kicker down">하락 주도</span>
            <strong>{down.name}</strong>
            <span className="down">{formatChange(down.change)}</span>
            <em>
              {down.leader.name} {formatChange(down.leader.change)}
            </em>
          </button>
        )}
      </div>

      <div className="sector-head">
        <h2>기여도</h2>
        <p>시총 비중 × 등락률. 동조는 윗물이 같이 오를 때입니다.</p>
      </div>

      <ul className="sector-list">
        {stats.map((stat) => {
          const width = (Math.abs(stat.contribution) / maxAbs) * 100;
          const active = zoom === stat.name;
          return (
            <li key={stat.name}>
              <button
                type="button"
                className={active ? "on" : ""}
                title={`${stat.name}만 확대해서 봅니다`}
                onClick={() => onZoom(active ? null : stat.name)}
              >
                <div className="row">
                  <span className="name">
                    {stat.name}
                    {synced.has(stat.name) && <em className="sync">동조</em>}
                  </span>
                  <span className={stat.change >= 0 ? "up" : "down"}>
                    {formatChange(stat.change)}
                  </span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${width}%`,
                      background: changeColor(stat.contribution * 8),
                    }}
                  />
                </div>
                <div className="row sub">
                  <span>
                    {stat.leader.name} · {stat.count}종목
                  </span>
                  <span>기여 {formatContribution(stat.contribution)}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
