export function changeColor(change: number): string {
  const clamped = Math.max(-6, Math.min(6, change));
  if (Math.abs(clamped) < 0.02) return "#5c5c5c";

  const t = Math.abs(clamped) / 6;
  if (clamped > 0) {
    return mix("#6a3a3a", "#d32f2f", ease(t));
  }
  return mix("#3a4a62", "#1e5aa8", ease(t));
}

function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

function mix(a: string, b: string, t: number): string {
  const ca = hex(a);
  const cb = hex(b);
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
  const bch = Math.round(ca[2] + (cb[2] - ca[2]) * t);
  return `rgb(${r}, ${g}, ${bch})`;
}

function hex(value: string): [number, number, number] {
  const n = value.replace("#", "");
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
  ];
}

export function formatChange(change: number): string {
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

export function formatCap(eok: number): string {
  if (eok >= 10000) {
    const jo = eok / 10000;
    return `${jo.toFixed(jo >= 10 ? 0 : 1)}조`;
  }
  return `${eok.toLocaleString("ko-KR")}억`;
}

export function formatPrice(price: number): string {
  return `${price.toLocaleString("ko-KR")}원`;
}

export function formatIndex(value: number): string {
  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatContribution(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%p`;
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
