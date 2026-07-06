import type { GeneratedSchedule, ScheduleItem } from '../types';

export type ScheduleDraft = {
  schedule: GeneratedSchedule;
  calendarEvents: ScheduleItem[];
  tasks: ScheduleItem[];
};

const KEY = 'schedule-draft';

export function loadScheduleDraft(): ScheduleDraft | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isScheduleDraft(parsed)) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    sessionStorage.removeItem(KEY);
    return null;
  }
}

export function saveScheduleDraft(draft: ScheduleDraft): void {
  sessionStorage.setItem(KEY, JSON.stringify(draft));
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
