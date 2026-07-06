import type { ScheduleItem } from '../types';

export type IndexedScheduleItem = {
  item: ScheduleItem;
  index: number;
};

export function compareScheduleItemsByStartTime(
  a: { startTime?: string },
  b: { startTime?: string },
): number {
  if (!a.startTime) return 1;
  if (!b.startTime) return -1;
  return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
}

export function groupDailyItems(items: ScheduleItem[]): {
  rows: IndexedScheduleItem[];
  topLevel: ScheduleItem[];
  childrenByParent: Map<string, IndexedScheduleItem[]>;
} {
  const parentTitles = new Set(items.filter((item) => !item.parentName).map((item) => item.title));
  const childrenByParent = new Map<string, IndexedScheduleItem[]>();
  const rows: IndexedScheduleItem[] = [];

  items.forEach((item, index) => {
    if (item.parentName && parentTitles.has(item.parentName)) {
      const children = childrenByParent.get(item.parentName) ?? [];
      children.push({ item, index });
      childrenByParent.set(item.parentName, children);
    } else {
      rows.push({ item, index });
    }
  });

  for (const children of childrenByParent.values()) {
    children.sort((a, b) => compareScheduleItemsByStartTime(a.item, b.item));
  }

  return {
    rows,
    topLevel: rows.map(({ item }) => item),
    childrenByParent,
  };
}
