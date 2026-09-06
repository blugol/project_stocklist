import type { Session } from "./quotes";
import { formatChange, formatIndex } from "./format";
import { ZONE_LABEL } from "./setup";
import {
  MARKET_LABEL,
  watchOrderNotes,
  type WatchLane,
  type WatchNote,
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

export interface OrderLogIndex {
  code: "KOSPI" | "KOSDAQ";
  value: number;
  change: number;
}

export interface OrderLogDay {
  date: string;
  session: Session;
  savedAt: number;
  sectors: string[];
  picks: OrderLogPick[];
  notes: WatchNote[];
  indexes: OrderLogIndex[];
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
    return parsed
      .filter(isDay)
      .map((day) => ({
        ...day,
        notes: Array.isArray(day.notes) ? day.notes : [],
        indexes: Array.isArray(day.indexes) ? day.indexes : [],
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

export function rememberOrder(
  order: WatchOrder,
  session: Session,
  indexes: OrderLogIndex[],
): void {
  const date = seoulDate();
  const notes = watchOrderNotes(order);
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
    sectors: notes.map((note) => note.sector),
    picks,
    notes,
    indexes: indexes.filter((idx) => idx.code === "KOSPI" || idx.code === "KOSDAQ"),
  };
  const prev = loadOrderLog().find((day) => day.date === date);
  const same =
    !!prev &&
    prev.session === next.session &&
    JSON.stringify(prev.picks) === JSON.stringify(next.picks) &&
    JSON.stringify(prev.notes ?? []) === JSON.stringify(next.notes) &&
    JSON.stringify(prev.indexes ?? []) === JSON.stringify(next.indexes);
  const log = [next, ...loadOrderLog().filter((day) => day.date !== date)].slice(0, MAX_DAYS);
  if (!same) localStorage.setItem(KEY, JSON.stringify(log));
  const saved = loadOrderLog();
  const text = saved.length
    ? `${formatOrderFlow(saved)}\n\n========\n\n${formatOrderLog(saved)}`
    : formatOrderLog(saved);
  void fetch("/dev/order-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  }).catch(() => {});
}

export function formatOrderDay(day: OrderLogDay): string {
  const session = day.session === "OPEN" ? "정규장" : "장마감";
  const lines = [
    `금일 대장  ${formatLogDate(day.date)}`,
    session,
  ];
  for (const idx of day.indexes ?? []) {
    lines.push(`${MARKET_LABEL[idx.code]}  ${formatIndex(idx.value)}  ${formatChange(idx.change)}`);
  }
  lines.push("");
  if (!day.picks.length) {
    lines.push("이날 동조 업종이 없었습니다.");
    return lines.join("\n");
  }
  if (day.sectors.length) {
    lines.push(`업종  ${day.sectors.join(" · ")}`);
    lines.push("");
  }
  for (const note of day.notes ?? []) {
    lines.push(note.sector);
    if (note.names.length) lines.push(note.names.join(" · "));
    for (const line of note.lines) lines.push(line);
    lines.push("");
  }
  for (const pick of day.picks) {
    const zone = isLane(pick.zone) ? ZONE_LABEL[pick.zone] : pick.zone;
    lines.push(
      `${pick.rank}. ${pick.name} (${pick.code})  ${MARKET_LABEL[pick.market]}  ${zone}  ${formatChange(pick.change)}`,
    );
    lines.push(`   ${pick.sector}`);
  }
  return lines.join("\n");
}

export function formatOrderLog(days: OrderLogDay[]): string {
  return days.map(formatOrderDay).join("\n\n--------\n\n");
}

function addDays(date: string, n: number): string {
  const t = Date.parse(`${date}T12:00:00+09:00`) + n * 86_400_000;
  return new Date(t).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

function weekStart(date: string): string {
  const dow = new Date(`${date}T12:00:00+09:00`).getUTCDay();
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

function appearStreak(hit: Set<string>, newestFirst: string[]): number {
  let n = 0;
  for (const date of newestFirst) {
    if (!hit.has(date)) break;
    n += 1;
  }
  return n;
}

export interface OrderLogCount {
  name: string;
  extra: string;
  days: number;
  streak: number;
}

export interface OrderLogFlow {
  weekLabel: string;
  monthLabel: string;
  weekSectors: OrderLogCount[];
  monthSectors: OrderLogCount[];
  stocks: OrderLogCount[];
}

function countSectors(
  days: OrderLogDay[],
  newestFirst: string[],
  keep: (date: string) => boolean,
): OrderLogCount[] {
  const map = new Map<string, string[]>();
  for (const day of days) {
    if (!keep(day.date)) continue;
    const names = day.sectors.length
      ? day.sectors
      : [...new Set(day.picks.map((pick) => pick.sector))];
    for (const name of names) {
      const list = map.get(name) ?? [];
      if (!list.includes(day.date)) list.push(day.date);
      map.set(name, list);
    }
  }
  return [...map.entries()]
    .map(([name, dates]) => ({
      name,
      extra: "",
      days: dates.length,
      streak: appearStreak(new Set(dates), newestFirst.filter(keep)),
    }))
    .sort((a, b) => b.days - a.days || b.streak - a.streak);
}

export function orderLogFlow(days: OrderLogDay[], today = seoulDate()): OrderLogFlow {
  const newestFirst = [...new Set(days.map((day) => day.date))].sort((a, b) => b.localeCompare(a));
  const week0 = weekStart(today);
  const month = today.slice(0, 7);
  const inWeek = (date: string) => date >= week0;
  const inMonth = (date: string) => date.startsWith(month);
  const stocksMap = new Map<string, { name: string; extra: string; dates: string[] }>();
  for (const day of days) {
    for (const pick of day.picks) {
      const row = stocksMap.get(pick.code) ?? { name: pick.name, extra: pick.sector, dates: [] };
      if (!row.dates.includes(day.date)) row.dates.push(day.date);
      stocksMap.set(pick.code, row);
    }
  }
  const stocks = [...stocksMap.values()]
    .map((row) => ({
      name: row.name,
      extra: row.extra,
      days: row.dates.length,
      streak: appearStreak(new Set(row.dates), newestFirst),
    }))
    .filter((row) => row.days > 1)
    .sort((a, b) => b.days - a.days || b.streak - a.streak)
    .slice(0, 16);
  return {
    weekLabel: `${formatLogDate(week0)}부터`,
    monthLabel: `${Number(month.slice(5))}월`,
    weekSectors: countSectors(days, newestFirst, inWeek).slice(0, 8),
    monthSectors: countSectors(days, newestFirst, inMonth).slice(0, 8),
    stocks,
  };
}

export function formatOrderFlow(days: OrderLogDay[]): string {
  const flow = orderLogFlow(days);
  const lines = [
    "금일 대장 흐름",
    "쌓인 날로 센 겁니다. 내일 볼 목록이 아닙니다.",
    "",
    `이번 주 동조 업종  ${flow.weekLabel}`,
  ];
  if (!flow.weekSectors.length) lines.push("이번 주 기록이 없습니다.");
  for (const row of flow.weekSectors) {
    lines.push(`${row.name}  ${row.days}일${row.streak > 1 ? `  최근 ${row.streak}일 연속` : ""}`);
  }
  lines.push("");
  lines.push(`이번 달 동조 업종  ${flow.monthLabel}`);
  if (!flow.monthSectors.length) lines.push("이번 달 기록이 없습니다.");
  for (const row of flow.monthSectors) {
    lines.push(`${row.name}  ${row.days}일${row.streak > 1 ? `  최근 ${row.streak}일 연속` : ""}`);
  }
  lines.push("");
  lines.push("여러 날 나온 대장");
  if (!flow.stocks.length) lines.push("이틀 이상 나온 종목이 없습니다.");
  for (const row of flow.stocks) {
    lines.push(
      `${row.name}  ${row.extra}  ${row.days}일${row.streak > 1 ? `  최근 ${row.streak}일 연속` : ""}`,
    );
  }
  return lines.join("\n");
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
