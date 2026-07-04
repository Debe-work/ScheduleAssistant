import { getAccessToken } from './googleAuth';
import type { ScheduleItem } from '../types';

function toDateBounds(date: string): { timeMin: string; timeMax: string } {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59`);
  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  };
}

export async function fetchCalendarEvents(date: string): Promise<ScheduleItem[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('認証が必要です');

  const { timeMin, timeMax } = toDateBounds(date);
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) throw new Error(`Calendar API エラー: ${res.status}`);

  const data = await res.json();
  return (data.items ?? []).map(
    (ev: {
      id: string;
      summary?: string;
      description?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }): ScheduleItem => ({
      id: ev.id,
      title: ev.summary ?? '(無題)',
      detail: ev.description,
      startTime: ev.start?.dateTime ?? (ev.start?.date ? `${ev.start.date}T00:00:00` : undefined),
      endTime: ev.end?.dateTime ?? (ev.end?.date ? `${ev.end.date}T23:59:59` : undefined),
      source: 'calendar',
      status: 'needsAction',
    }),
  );
}

export async function createCalendarEvent(item: ScheduleItem): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('認証が必要です');
  if (!item.startTime || !item.endTime) return;

  const body = {
    summary: item.title,
    description: item.detail,
    start: { dateTime: item.startTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    end: { dateTime: item.endTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  };

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Calendar 登録失敗 (${item.title}): ${err}`);
  }
}

export function hasTimeOverlap(a: ScheduleItem, b: ScheduleItem): boolean {
  if (!a.startTime || !a.endTime || !b.startTime || !b.endTime) return false;
  const aStart = new Date(a.startTime).getTime();
  const aEnd = new Date(a.endTime).getTime();
  const bStart = new Date(b.startTime).getTime();
  const bEnd = new Date(b.endTime).getTime();
  return aStart < bEnd && bStart < aEnd;
}

export function findOverlaps(items: ScheduleItem[]): string[] {
  const warnings: string[] = [];
  const timed = items.filter((i) => i.startTime && i.endTime);
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      if (hasTimeOverlap(timed[i], timed[j])) {
        warnings.push(`「${timed[i].title}」と「${timed[j].title}」が重複しています`);
      }
    }
  }
  return warnings;
}

export { toDateBounds };
