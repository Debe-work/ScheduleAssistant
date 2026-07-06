import { describe, expect, it } from 'vitest';
import type { ScheduleItem } from '../types';
import { groupDailyItems } from './scheduleItems';

describe('groupDailyItems', () => {
  it('groups children under existing top-level parent titles and sorts children by start time', () => {
    const items: ScheduleItem[] = [
      { title: 'AM-HK', source: 'daily' },
      { title: '掃除', parentName: 'AM-HK', source: 'daily', startTime: '2026-07-06T08:30:00' },
      { title: '朝食', parentName: 'AM-HK', source: 'daily', startTime: '2026-07-06T08:15:00' },
      { title: '孤立子', parentName: 'missing', source: 'daily' },
    ];

    const grouped = groupDailyItems(items);

    expect(grouped.topLevel.map((item) => item.title)).toEqual(['AM-HK', '孤立子']);
    expect(grouped.childrenByParent.get('AM-HK')?.map(({ item, index }) => [item.title, index])).toEqual([
      ['朝食', 2],
      ['掃除', 1],
    ]);
  });
});
