import type { GeneratedSchedule, ScheduleItem } from '../types';
import { createCalendarEvent, findOverlaps } from './googleCalendar';
import { createTask, taskExists } from './googleTasks';

export type RegisterResult = {
  calendarCreated: number;
  tasksCreated: number;
  skipped: number;
  errors: string[];
  warnings: string[];
};

export async function registerSchedule(
  schedule: GeneratedSchedule,
  existingItems: ScheduleItem[],
): Promise<RegisterResult> {
  const result: RegisterResult = {
    calendarCreated: 0,
    tasksCreated: 0,
    skipped: 0,
    errors: [],
    warnings: findOverlaps([...existingItems, ...schedule.items]),
  };

  for (const item of schedule.items.filter((i) => i.source === 'daily')) {
    try {
      if (item.startTime && item.endTime) {
        await createCalendarEvent(item);
        result.calendarCreated++;
        continue;
      }

      const exists = await taskExists(item.title, schedule.date);
      if (exists) {
        result.skipped++;
        continue;
      }
      await createTask(item, schedule.date);
      result.tasksCreated++;
    } catch (e) {
      result.errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  return result;
}
