const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;

export function todayString(): string {
  const d = new Date();
  return formatLocalDateString(d);
}

export function formatScheduleDateLabel(dateString: string): string {
  const parts = parseScheduleDateParts(dateString);
  if (!parts) return dateString;
  return `${parts.year}年${parts.month}月${parts.day}日（${parts.weekdayShort}）`;
}

export function parseScheduleDateParts(dateString: string): {
  year: number;
  month: number;
  day: number;
  weekdayShort: string;
  weekdayLong: string;
} | null {
  const d = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const weekdayShort = WEEKDAY_LABELS[d.getDay()];
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    weekdayShort,
    weekdayLong: `${weekdayShort}曜日`,
  };
}

export function formatLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
