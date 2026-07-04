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
  return JSON.parse(raw) as ScheduleDraft;
}

export function saveScheduleDraft(draft: ScheduleDraft): void {
  sessionStorage.setItem(KEY, JSON.stringify(draft));
}
