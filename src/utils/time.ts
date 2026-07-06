export type ScheduleTimeParts = {
  hour: number;
  minute: number;
};

export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatTime(iso?: string, scheduleDate?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  if (scheduleDate) {
    const parts = isoToScheduleTimeParts(iso, scheduleDate);
    if (parts) return `${pad2(parts.hour)}:${pad2(parts.minute)}`;
  }

  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

export function formatOptionalTime(iso?: string): string {
  const formatted = formatTime(iso);
  return formatted === '—' ? '' : formatted;
}

export function formatTimeRange(item: { startTime?: string; endTime?: string }): string {
  if (!item.startTime) return '';
  const start = formatOptionalTime(item.startTime);
  const end = item.endTime ? formatOptionalTime(item.endTime) : '';
  return end ? `${start}-${end}` : start;
}

export function isoToScheduleTimeParts(iso: string | undefined, date: string): ScheduleTimeParts | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  const base = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime()) || Number.isNaN(base.getTime())) return null;

  const diffMinutes = Math.round((parsed.getTime() - base.getTime()) / 60_000);
  const hour = Math.floor(diffMinutes / 60);
  if (hour < 0 || hour > 26) return null;

  return { hour, minute: ((diffMinutes % 60) + 60) % 60 };
}

export function scheduleTimeToIso(date: string, hour: number, minute: number): string {
  const base = new Date(`${date}T00:00:00`);
  return new Date(base.getTime() + (hour * 60 + minute) * 60_000).toISOString();
}

export function localTimeToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

export function isoToLocalTime(iso: string): string {
  const date = new Date(iso);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}
