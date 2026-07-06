import { describe, expect, it } from 'vitest';
import type { GeneratedSchedule, ScheduleItem } from '../types';
import { applyTaskSchedules, mergeTaskSchedulesIntoDraft } from './taskScheduleMerge';

describe('applyTaskSchedules', () => {
  it('fills missing task times from generated task schedules', () => {
    const tasks: ScheduleItem[] = [
      { title: 'メール確認', source: 'task' },
      {
        title: '既に時間あり',
        source: 'task',
        startTime: '2026-07-06T01:00:00.000Z',
        endTime: '2026-07-06T01:30:00.000Z',
      },
    ];

    const result = applyTaskSchedules(tasks, [
      {
        title: 'メール確認',
        startTime: '2026-07-06T00:00:00.000Z',
        endTime: '2026-07-06T00:30:00.000Z',
      },
      {
        title: '既に時間あり',
        startTime: '2026-07-06T02:00:00.000Z',
        endTime: '2026-07-06T02:30:00.000Z',
      },
    ]);

    expect(result[0]).toMatchObject({
      startTime: '2026-07-06T00:00:00.000Z',
      endTime: '2026-07-06T00:30:00.000Z',
    });
    expect(result[1]).toMatchObject({
      startTime: '2026-07-06T01:00:00.000Z',
      endTime: '2026-07-06T01:30:00.000Z',
    });
  });

  it('returns the original task array when no task schedules are provided', () => {
    const tasks: ScheduleItem[] = [{ title: '買い物', source: 'task' }];

    expect(applyTaskSchedules(tasks, undefined)).toBe(tasks);
    expect(applyTaskSchedules(tasks, [])).toBe(tasks);
  });
});

describe('mergeTaskSchedulesIntoDraft', () => {
  it('applies generated task schedules to draft tasks', () => {
    const tasks: ScheduleItem[] = [{ title: '読書', source: 'task' }];
    const schedule: GeneratedSchedule = {
      date: '2026-07-06',
      summary: '割り当てました',
      items: [],
      taskSchedules: [
        {
          title: '読書',
          startTime: '2026-07-06T11:00:00.000Z',
        },
      ],
    };

    expect(mergeTaskSchedulesIntoDraft(tasks, schedule)[0]?.startTime).toBe('2026-07-06T11:00:00.000Z');
  });
});
