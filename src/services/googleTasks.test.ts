import { describe, expect, it } from 'vitest';
import { extractTaskSchedule, parseTaskTimeFromNotes } from './googleTasks';

function localIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

describe('parseTaskTimeFromNotes', () => {
  it('parses Schedule Assistant time prefixes and strips them from details', () => {
    expect(parseTaskTimeFromNotes('[SA:09:30-10:15]\n資料を読む', '2026-07-06')).toEqual({
      detail: '資料を読む',
      startTime: localIso('2026-07-06', '09:30'),
      endTime: localIso('2026-07-06', '10:15'),
    });
  });

  it('parses a start-only prefix', () => {
    expect(parseTaskTimeFromNotes('[SA:14:00]\n散歩', '2026-07-06')).toEqual({
      detail: '散歩',
      startTime: localIso('2026-07-06', '14:00'),
      endTime: undefined,
    });
  });

  it('keeps notes without a time prefix as details', () => {
    expect(parseTaskTimeFromNotes('通常メモ', '2026-07-06')).toEqual({
      detail: '通常メモ',
    });
  });
});

describe('extractTaskSchedule', () => {
  it('uses timed due dates before note prefixes', () => {
    expect(
      extractTaskSchedule(
        '2026-07-06T12:00:00.000Z',
        '[SA:09:30-10:15]\n資料を読む',
        '2026-07-06',
      ),
    ).toEqual({
      detail: '資料を読む',
      startTime: '2026-07-06T12:00:00.000Z',
      endTime: localIso('2026-07-06', '10:15'),
    });
  });

  it('does not convert date-only due dates into start times', () => {
    expect(extractTaskSchedule('2026-07-06T00:00:00.000Z', '終日扱い', '2026-07-06')).toEqual({
      detail: '終日扱い',
      startTime: undefined,
      endTime: undefined,
    });
  });

  it('ignores due dates outside the requested local date', () => {
    expect(
      extractTaskSchedule('2026-07-07T12:00:00.000Z', '[SA:09:30]\n資料を読む', '2026-07-06'),
    ).toEqual({
      detail: '資料を読む',
      startTime: localIso('2026-07-06', '09:30'),
      endTime: undefined,
    });
  });
});
