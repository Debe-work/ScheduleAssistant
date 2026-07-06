import type { GeneratedSchedule, ScheduleItem } from '../types';

export type ScheduleDraft = {
  schedule: GeneratedSchedule;
  calendarEvents: ScheduleItem[];
  tasks: ScheduleItem[];
};

const KEY = 'schedule-draft:v1';
const LEGACY_KEY = 'schedule-draft';

export function loadScheduleDraft(): ScheduleDraft | null {
  const raw = getSessionItem(KEY) ?? getSessionItem(LEGACY_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isScheduleDraft(parsed)) {
      removeStoredDraft();
      return null;
    }
    return parsed;
  } catch {
    removeStoredDraft();
    return null;
  }
}

export function saveScheduleDraft(draft: ScheduleDraft): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
    sessionStorage.removeItem(LEGACY_KEY);
  } catch {
    // sessionStorage can be unavailable or quota-limited; keep in-memory edits working.
  }
}

function isScheduleDraft(value: unknown): value is ScheduleDraft {
  if (!isRecord(value)) return false;
  const { schedule, calendarEvents, tasks } = value;
  return (
    isRecord(schedule)
    && typeof schedule.date === 'string'
    && Array.isArray(schedule.items)
    && typeof schedule.summary === 'string'
    && Array.isArray(calendarEvents)
    && Array.isArray(tasks)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getSessionItem(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function removeStoredDraft(): void {
  try {
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore storage cleanup failures
  }
}
