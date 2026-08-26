import type { Session } from "./quotes";
import { ZONE_LABEL } from "./setup";
import {
  MARKET_LABEL,
  watchOrderNotes,
  type WatchLane,
  type WatchOrder,
} from "./watchOrder";

const KEY = "stocklist.orderLog";
const MAX_DAYS = 120;

export interface OrderLogPick {
  rank: number;
  name: string;
  code: string;
  market: "KOSPI" | "KOSDAQ";
  sector: string;
  zone: WatchLane;
  change: number;
}

export interface OrderLogDay {
  date: string;
  session: Session;
  savedAt: number;
  sectors: string[];
  picks: OrderLogPick[];
}

export function seoulDate(ts = Date.now()): string {
  return new Date(ts).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

export function formatLogDate(date: string): string {
  return new Date(`${date}T12:00:00+09:00`).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function isLane(value: unknown): value is WatchLane {
  return value === "early" || value === "high" || value === "mid";
}

function isDay(value: unknown): value is OrderLogDay {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<OrderLogDay>;
  return typeof row.date === "string" && Array.isArray(row.picks);
}

export function loadOrderLog(): OrderLogDay[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isDay).sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

export function rememberOrder(order: WatchOrder, session: Session): void {
  const date = seoulDate();
  const picks = [...order.early, ...order.high, ...order.mid]
    .sort((a, b) => a.rank - b.rank)
    .map((pick) => ({
      rank: pick.rank,
      name: pick.stock.name,
      code: pick.stock.code,
      market: pick.stock.market,
      sector: pick.stock.sector,
      zone: pick.zone,
      change: pick.stock.change,
    }));
  const next: OrderLogDay = {
    date,
    session,
    savedAt: Date.now(),
    sectors: watchOrderNotes(order).map((note) => note.sector),
    picks,
  };
  const prev = loadOrderLog().find((day) => day.date === date);
  if (
    prev &&
    prev.session === next.session &&
    JSON.stringify(prev.picks) === JSON.stringify(next.picks) &&
    JSON.stringify(prev.sectors) === JSON.stringify(next.sectors)
  ) {
    return;
  }
  const log = [next, ...loadOrderLog().filter((day) => day.date !== date)].slice(0, MAX_DAYS);
  localStorage.setItem(KEY, JSON.stringify(log));
}

export function formatOrderDay(day: OrderLogDay): string {
  const session = day.session === "OPEN" ? "정규장" : "장마감";
  const lines = [
    `시황 창 어디 볼지  ${formatLogDate(day.date)}`,
    `${session}. 매수 사인이 아닙니다. 타점은 HTS 3분봉입니다.`,
    "",
  ];
  if (!day.picks.length) {
    lines.push("이날 동조 업종이 없었습니다.");
    return lines.join("\n");
  }
  if (day.sectors.length) {
    lines.push(`업종  ${day.sectors.join(" · ")}`);
    lines.push("");
  }
  for (const pick of day.picks) {
    const zone = isLane(pick.zone) ? ZONE_LABEL[pick.zone] : pick.zone;
    const sign = pick.change > 0 ? "+" : "";
    lines.push(
      `${pick.rank}. ${pick.name} (${pick.code})  ${MARKET_LABEL[pick.market]}  ${zone}  ${sign}${pick.change.toFixed(2)}%`,
    );
    lines.push(`   ${pick.sector}`);
  }
  return lines.join("\n");
}

export function formatOrderLog(days: OrderLogDay[]): string {
  return days.map(formatOrderDay).join("\n\n--------\n\n");
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}
