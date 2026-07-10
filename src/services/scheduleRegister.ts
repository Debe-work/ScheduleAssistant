import type { GeneratedSchedule, ScheduleItem } from '../types';
import { toErrorMessage } from '../utils/errors';
import { formatTimeRange } from '../utils/time';
import { groupDailyItems } from '../utils/scheduleItems';
import { createCalendarEvent, ensureScheduleAssistantCalendar, findOverlaps, updateCalendarEvent } from './googleCalendar';
import { createTask, updateTask } from './googleTasks';

export type RegisterResult = {
  calendarCreated: number;
  calendarUpdated: number;
  tasksCreated: number;
  tasksUpdated: number;
  skipped: number;
  errors: string[];
  warnings: string[];
};

function buildCalendarDescription(item: ScheduleItem, children: ScheduleItem[] = []): string {
  const lines = ['Created by Schedule Assistant'];
  if (item.detail) {
    lines.push('', item.detail);
  }
  if (children.length) {
    lines.push('', '子タスク:');
    for (const child of children) {
      const time = formatTimeRange(child);
      const title = time ? `${time} ${child.title}` : child.title;
      lines.push(`- ${title}`);
      if (child.detail) lines.push(`  ${child.detail}`);
    }
  }
  return lines.join('\n');
}

function hasCalendarTime(item: ScheduleItem): boolean {
  return Boolean(item.startTime);
}

export async function registerSchedule(
  schedule: GeneratedSchedule,
  existingItems: ScheduleItem[],
): Promise<RegisterResult> {
  const result: RegisterResult = {
    calendarCreated: 0,
    calendarUpdated: 0,
    tasksCreated: 0,
    tasksUpdated: 0,
    skipped: 0,
    errors: [],
    warnings: findOverlaps([...existingItems, ...schedule.items]),
  };

  const existingTasks = existingItems.filter((i) => i.source === 'task');
  const existingCalendar = existingItems.filter((i) => i.source === 'calendar' && i.id);
  const dailyItems = schedule.items.filter((i) => i.source === 'daily');
  const { topLevel, childrenByParent } = groupDailyItems(dailyItems);
  const needsCalendar = existingTasks.some(hasCalendarTime) || topLevel.some(hasCalendarTime);
  const calendarId = needsCalendar ? await ensureScheduleAssistantCalendar() : null;

  for (const item of existingCalendar) {
    try {
      await updateCalendarEvent(item);
      result.calendarUpdated++;
    } catch (e) {
      result.errors.push(toErrorMessage(e));
    }
  }

  for (const item of existingTasks.filter((i) => i.id)) {
    try {
      await updateTask(item, schedule.date);
      result.tasksUpdated++;
      if (calendarId && hasCalendarTime(item)) {
        await createCalendarEvent(
          { ...item, title: `[Todo] ${item.title}` },
          calendarId,
          buildCalendarDescription(item),
        );
        result.calendarCreated++;
      }
    } catch (e) {
      result.errors.push(toErrorMessage(e));
    }
  }

  const existingTaskTitles = new Set(
    existingItems
      .filter((item) => item.source === 'task')
      .map((item) => item.title),
  );

  for (const parent of topLevel) {
    try {
      const children = (childrenByParent.get(parent.title) ?? []).map(({ item }) => item);
      if (calendarId && hasCalendarTime(parent)) {
        await createCalendarEvent(parent, calendarId, buildCalendarDescription(parent, children));
        result.calendarCreated++;
      }

      if (existingTaskTitles.has(parent.title)) {
        result.skipped++;
        continue;
      }

      const parentId = await createTask(parent, schedule.date);
      existingTaskTitles.add(parent.title);
      result.tasksCreated++;

      let previousChildId: string | undefined;
      for (const child of children) {
        if (existingTaskTitles.has(child.title)) {
          result.skipped++;
          continue;
        }
        const childId = await createTask(child, schedule.date, parentId, previousChildId);
        previousChildId = childId;
        existingTaskTitles.add(child.title);
        result.tasksCreated++;
      }
    } catch (e) {
      result.errors.push(toErrorMessage(e));
    }
  }

  return result;
}
