import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GeneratedSchedule, ScheduleItem } from '../types';
import {
  createCalendarEvent,
  ensureScheduleAssistantCalendar,
  findOverlaps,
  updateCalendarEvent,
} from './googleCalendar';
import { updateTask } from './googleTasks';
import { registerSchedule } from './scheduleRegister';

vi.mock('./googleCalendar', () => ({
  createCalendarEvent: vi.fn(),
  ensureScheduleAssistantCalendar: vi.fn(),
  findOverlaps: vi.fn(),
  updateCalendarEvent: vi.fn(),
}));

vi.mock('./googleTasks', () => ({
  updateTask: vi.fn(),
}));

const createCalendarEventMock = vi.mocked(createCalendarEvent);
const ensureScheduleAssistantCalendarMock = vi.mocked(ensureScheduleAssistantCalendar);
const findOverlapsMock = vi.mocked(findOverlaps);
const updateCalendarEventMock = vi.mocked(updateCalendarEvent);
const updateTaskMock = vi.mocked(updateTask);

function dailyItem(item: Omit<ScheduleItem, 'source'>): ScheduleItem {
  return { ...item, source: 'daily' };
}

describe('registerSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureScheduleAssistantCalendarMock.mockResolvedValue('schedule-assistant-calendar');
    createCalendarEventMock.mockResolvedValue(undefined);
    updateCalendarEventMock.mockResolvedValue(undefined);
    updateTaskMock.mockResolvedValue(undefined);
    findOverlapsMock.mockReturnValue([]);
  });

  it('updates existing items and creates daily calendar events without Google Tasks', async () => {
    const existingItems: ScheduleItem[] = [
      {
        id: 'calendar-1',
        title: '既存予定',
        source: 'calendar',
        startTime: '2026-07-06T10:00:00',
        endTime: '2026-07-06T10:30:00',
      },
      {
        id: 'task-1',
        listId: 'list-1',
        title: '既存Todo',
        source: 'task',
        startTime: '2026-07-06T11:00:00',
        endTime: '2026-07-06T11:30:00',
      },
    ];
    const schedule: GeneratedSchedule = {
      date: '2026-07-06',
      summary: '生成しました',
      items: [
        dailyItem({
          title: 'AM-HK',
          category: 'DailyTask',
          startTime: '2026-07-06T08:00:00',
          endTime: '2026-07-06T09:00:00',
        }),
        dailyItem({
          title: '掃除',
          parentName: 'AM-HK',
          startTime: '2026-07-06T08:30:00',
          endTime: '2026-07-06T08:45:00',
        }),
        dailyItem({
          title: '朝食',
          parentName: 'AM-HK',
          startTime: '2026-07-06T08:15:00',
          endTime: '2026-07-06T08:25:00',
        }),
      ],
    };

    const result = await registerSchedule(schedule, existingItems);

    expect(result).toEqual({
      calendarCreated: 2,
      calendarUpdated: 1,
      tasksUpdated: 1,
      errors: [],
      warnings: [],
    });
    expect(ensureScheduleAssistantCalendarMock).toHaveBeenCalledTimes(1);
    expect(updateCalendarEventMock).toHaveBeenCalledWith(existingItems[0]);
    expect(updateTaskMock).toHaveBeenCalledWith(existingItems[1], '2026-07-06');
    expect(createCalendarEventMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ title: '[Todo] 既存Todo' }),
      'schedule-assistant-calendar',
      expect.stringContaining('Created by Schedule Assistant'),
    );
    expect(createCalendarEventMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ title: 'AM-HK' }),
      'schedule-assistant-calendar',
      expect.stringContaining('- 08:15-08:25 朝食'),
    );
    expect(createCalendarEventMock).toHaveBeenCalledTimes(2);
  });

  it('registers a daily item on the calendar even when a Todo has the same title', async () => {
    const result = await registerSchedule(
      {
        date: '2026-07-06',
        summary: '生成しました',
        items: [
          dailyItem({
            title: '既存Todo',
            startTime: '2026-07-06T12:00:00',
            endTime: '2026-07-06T12:30:00',
          }),
          dailyItem({ title: '時刻なし' }),
        ],
      },
      [{ title: '既存Todo', source: 'task' }],
    );

    expect(result.calendarCreated).toBe(1);
    expect(result.tasksUpdated).toBe(0);
    expect(updateTaskMock).not.toHaveBeenCalled();
    expect(createCalendarEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: '既存Todo' }),
      'schedule-assistant-calendar',
      expect.any(String),
    );
  });

  it('collects warnings and per-item errors while continuing registration', async () => {
    findOverlapsMock.mockReturnValue(['「既存予定」と「追加タスク」が重複しています']);
    updateCalendarEventMock.mockRejectedValueOnce(new Error('Calendar 更新失敗'));

    const result = await registerSchedule(
      {
        date: '2026-07-06',
        summary: '生成しました',
        items: [dailyItem({ title: '追加タスク' })],
      },
      [{ id: 'calendar-1', title: '既存予定', source: 'calendar' }],
    );

    expect(result.warnings).toEqual(['「既存予定」と「追加タスク」が重複しています']);
    expect(result.errors).toEqual(['Calendar 更新失敗']);
    expect(result.calendarCreated).toBe(0);
    expect(createCalendarEventMock).not.toHaveBeenCalled();
  });
});
