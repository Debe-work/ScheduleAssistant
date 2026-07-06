import { describe, expect, it } from 'vitest';
import type { ScheduleItem } from '../types';
import { findOverlaps, hasTimeOverlap } from './googleCalendar';

function timedItem(title: string, startTime: string, endTime: string): ScheduleItem {
  return {
    title,
    source: 'calendar',
    startTime,
    endTime,
  };
}

describe('hasTimeOverlap', () => {
  it('detects overlapping timed items', () => {
    expect(
      hasTimeOverlap(
        timedItem('A', '2026-07-06T09:00:00.000Z', '2026-07-06T10:00:00.000Z'),
        timedItem('B', '2026-07-06T09:30:00.000Z', '2026-07-06T10:30:00.000Z'),
      ),
    ).toBe(true);
  });

  it('does not treat adjacent timed items as overlapping', () => {
    expect(
      hasTimeOverlap(
        timedItem('A', '2026-07-06T09:00:00.000Z', '2026-07-06T10:00:00.000Z'),
        timedItem('B', '2026-07-06T10:00:00.000Z', '2026-07-06T11:00:00.000Z'),
      ),
    ).toBe(false);
  });

  it('ignores items without complete time ranges', () => {
    expect(
      hasTimeOverlap(
        timedItem('A', '2026-07-06T09:00:00.000Z', '2026-07-06T10:00:00.000Z'),
        { title: 'B', source: 'task', startTime: '2026-07-06T09:30:00.000Z' },
      ),
    ).toBe(false);
  });
});

describe('findOverlaps', () => {
  it('returns warnings for overlapping non-all-day items', () => {
    const warnings = findOverlaps([
      timedItem('朝会', '2026-07-06T00:00:00.000Z', '2026-07-06T00:30:00.000Z'),
      timedItem('作業', '2026-07-06T00:15:00.000Z', '2026-07-06T01:00:00.000Z'),
      timedItem('休憩', '2026-07-06T01:00:00.000Z', '2026-07-06T01:30:00.000Z'),
    ]);

    expect(warnings).toEqual(['「朝会」と「作業」が重複しています']);
  });

  it('excludes all-day events from overlap warnings', () => {
    const warnings = findOverlaps([
      {
        ...timedItem('終日イベント', '2026-07-06T00:00:00.000Z', '2026-07-07T00:00:00.000Z'),
        isAllDay: true,
      },
      timedItem('作業', '2026-07-06T00:15:00.000Z', '2026-07-06T01:00:00.000Z'),
    ]);

    expect(warnings).toEqual([]);
  });
});
