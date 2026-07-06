import { describe, expect, it, vi } from 'vitest';
import { formatScheduleDateLabel, parseScheduleDateParts, todayString } from './date';

describe('formatScheduleDateLabel', () => {
  it('formats a schedule date with a Japanese weekday label', () => {
    expect(formatScheduleDateLabel('2026-07-06')).toBe('2026年7月6日（月）');
  });

  it('returns the original value for invalid dates', () => {
    expect(formatScheduleDateLabel('not-a-date')).toBe('not-a-date');
  });
});

describe('parseScheduleDateParts', () => {
  it('returns date parts and weekday labels', () => {
    expect(parseScheduleDateParts('2026-07-06')).toEqual({
      year: 2026,
      month: 7,
      day: 6,
      weekdayShort: '月',
      weekdayLong: '月曜日',
    });
  });

  it('returns null for invalid dates', () => {
    expect(parseScheduleDateParts('not-a-date')).toBeNull();
  });
});

describe('todayString', () => {
  it('formats the current local date as yyyy-mm-dd', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-06T12:34:56'));

    expect(todayString()).toBe('2026-07-06');

    vi.useRealTimers();
  });
});
