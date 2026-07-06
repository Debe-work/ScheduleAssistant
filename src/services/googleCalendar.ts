import { getAccessToken } from './googleAuth';
import { formatGoogleApiError, readGoogleApiError } from './googleApiError';
import type { ScheduleItem } from '../types';

const SCHEDULE_ASSISTANT_CALENDAR_SUMMARY = 'Schedule Assistant';
const SCHEDULE_ASSISTANT_CALENDAR_COLOR = '#1a73e8';
const DEFAULT_EVENT_MINUTES = 15;

type CalendarListEntry = {
  id: string;
  summary?: string;
};

function toDateBounds(date: string): { timeMin: string; timeMax: string } {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59.999`);
  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  };
}

async function calendarFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  if (!token) throw new Error('認証が必要です');
  return fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

export async function fetchCalendarEvents(date: string): Promise<ScheduleItem[]> {
  const { timeMin, timeMax } = toDateBounds(date);
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  const res = await calendarFetch(`/calendars/primary/events?${params}`);

  if (!res.ok) {
    const detail = await readGoogleApiError(res);
    throw new Error(formatGoogleApiError('Google Calendar API', res.status, detail));
  }

  const data = await res.json();
  return (data.items ?? []).map(
    (ev: {
      id: string;
      summary?: string;
      description?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }): ScheduleItem => {
      const isAllDay = Boolean(ev.start?.date && !ev.start?.dateTime);
      return {
        id: ev.id,
        title: ev.summary ?? '(無題)',
        detail: ev.description,
        startTime: ev.start?.dateTime ?? (ev.start?.date ? `${ev.start.date}T00:00:00` : undefined),
        endTime: ev.end?.dateTime ?? (ev.end?.date ? `${ev.end.date}T00:00:00` : undefined),
        source: 'calendar',
        status: 'needsAction',
        isAllDay,
      };
    },
  );
}

async function findScheduleAssistantCalendar(): Promise<CalendarListEntry | null> {
  const res = await calendarFetch('/users/me/calendarList');
  if (!res.ok) {
    const detail = await readGoogleApiError(res);
    throw new Error(formatGoogleApiError('Google Calendar API', res.status, detail));
  }
  const data = await res.json();
  const entries = (data.items ?? []) as CalendarListEntry[];
  return entries.find((entry) => entry.summary === SCHEDULE_ASSISTANT_CALENDAR_SUMMARY) ?? null;
}

async function createScheduleAssistantCalendar(): Promise<CalendarListEntry> {
  const res = await calendarFetch('/calendars', {
    method: 'POST',
    body: JSON.stringify({
      summary: SCHEDULE_ASSISTANT_CALENDAR_SUMMARY,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  });
  if (!res.ok) {
    const detail = await readGoogleApiError(res);
    throw new Error(formatGoogleApiError('Google Calendar API', res.status, detail));
  }
  return res.json() as Promise<CalendarListEntry>;
}

async function setScheduleAssistantCalendarColor(calendarId: string): Promise<void> {
  const res = await calendarFetch(
    `/users/me/calendarList/${encodeURIComponent(calendarId)}?colorRgbFormat=true`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        backgroundColor: SCHEDULE_ASSISTANT_CALENDAR_COLOR,
        foregroundColor: '#ffffff',
        selected: true,
      }),
    },
  );
  if (!res.ok) {
    const detail = await readGoogleApiError(res);
    throw new Error(formatGoogleApiError('Google Calendar API', res.status, detail));
  }
}

export async function ensureScheduleAssistantCalendar(): Promise<string> {
  const existing = await findScheduleAssistantCalendar();
  const calendar = existing ?? await createScheduleAssistantCalendar();
  await setScheduleAssistantCalendarColor(calendar.id);
  return calendar.id;
}

function withDefaultEndTime(item: ScheduleItem): { startTime: string; endTime: string } | null {
  if (!item.startTime) return null;
  const start = new Date(item.startTime);
  if (Number.isNaN(start.getTime())) return null;
  const end = item.endTime ? new Date(item.endTime) : new Date(start.getTime() + DEFAULT_EVENT_MINUTES * 60_000);
  if (Number.isNaN(end.getTime())) return null;
  return { startTime: start.toISOString(), endTime: end.toISOString() };
}

export async function updateCalendarEvent(item: ScheduleItem): Promise<void> {
  if (!item.id) throw new Error(`Calendar 更新失敗: ID がありません (${item.title})`);

  const body: Record<string, unknown> = {
    summary: item.title,
    description: item.detail ?? '',
  };

  if (item.isAllDay && item.startTime) {
    const startDate = item.startTime.slice(0, 10);
    const endDate = item.endTime?.slice(0, 10) ?? startDate;
    body.start = { date: startDate };
    body.end = { date: endDate };
  } else if (item.startTime) {
    const range = withDefaultEndTime(item);
    if (range) {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      body.start = { dateTime: range.startTime, timeZone };
      body.end = { dateTime: range.endTime, timeZone };
    }
  }

  const res = await calendarFetch(`/calendars/primary/events/${encodeURIComponent(item.id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await readGoogleApiError(res);
    throw new Error(formatGoogleApiError('Google Calendar API', res.status, detail));
  }
}

export async function createCalendarEvent(
  item: ScheduleItem,
  calendarId = 'primary',
  description?: string,
): Promise<void> {
  const range = withDefaultEndTime(item);
  if (!range) return;

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const body = {
    summary: item.title,
    description: description ?? item.detail,
    start: { dateTime: range.startTime, timeZone },
    end: { dateTime: range.endTime, timeZone },
    extendedProperties: {
      private: {
        createdBy: 'Schedule Assistant',
        source: item.source,
      },
    },
  };

  const res = await calendarFetch(`/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

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
