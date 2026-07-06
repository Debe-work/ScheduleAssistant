import { useEffect, useMemo, useState } from 'react';
import type { ScheduleItem } from '../types';
import {
  compareScheduleItemsByStartTime,
  groupDailyItems,
  type IndexedScheduleItem,
} from '../utils/scheduleItems';
import { formatTime, isoToScheduleTimeParts, pad2, scheduleTimeToIso } from '../utils/time';

type ScheduleTimelineProps = {
  items: ScheduleItem[];
  calendarEvents?: ScheduleItem[];
  tasks?: ScheduleItem[];
  date: string;
  onItemsChange?: (items: ScheduleItem[]) => void;
  onTasksChange?: (tasks: ScheduleItem[]) => void;
  onCalendarChange?: (events: ScheduleItem[]) => void;
  expandedCardKeys?: string[];
  onExpandedCardKeysChange?: (keys: string[]) => void;
  onRowKeysChange?: (keys: string[]) => void;
};

type ItemKind = 'calendar' | 'task' | 'daily';

type TimelineRow = {
  item: ScheduleItem;
  kind: ItemKind;
  index?: number;
  children: IndexedScheduleItem[];
};

const HOUR_OPTIONS = Array.from({ length: 27 }, (_, hour) => hour);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, minute) => minute);

function sourceLabel(kind: ItemKind, category?: string): string {
  switch (kind) {
    case 'calendar':
      return 'カレンダー';
    case 'task':
      return category ? `Todo · ${category}` : 'Todo';
    case 'daily':
      return 'デイリー';
  }
}

function sourceBadgeClass(kind: ItemKind): string {
  switch (kind) {
    case 'calendar':
      return 'badge-source-calendar';
    case 'task':
      return 'badge-source-task';
    case 'daily':
      return 'badge-source-daily';
  }
}

function buildTimelineRows(
  dailyItems: ScheduleItem[],
  calendarEvents: ScheduleItem[],
  tasks: ScheduleItem[],
): TimelineRow[] {
  const { rows, childrenByParent } = groupDailyItems(dailyItems);

  const timeline: TimelineRow[] = [
    ...calendarEvents.map((item, index) => ({
      item,
      kind: 'calendar' as const,
      index,
      children: [] as IndexedScheduleItem[],
    })),
    ...tasks
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.status !== 'completed')
      .map(({ item, index }) => ({
        item,
        kind: 'task' as const,
        index,
        children: [] as IndexedScheduleItem[],
      })),
    ...rows.map(({ item, index }) => ({
      item,
      kind: 'daily' as const,
      index,
      children: childrenByParent.get(item.title) ?? [],
    })),
  ];

  return timeline.sort((a, b) => compareScheduleItemsByStartTime(a.item, b.item));
}

function rowKey(row: TimelineRow, idx: number): string {
  const id = row.item.id ?? row.index ?? idx;
  return `${row.kind}-${id}`;
}

type TimeEditorProps = {
  item: ScheduleItem;
  date: string;
  onUpdate: (patch: Partial<ScheduleItem>) => void;
};

function TimeEditor({ item, date, onUpdate }: TimeEditorProps) {
  const startParts = isoToScheduleTimeParts(item.startTime, date);
  const endParts = isoToScheduleTimeParts(item.endTime, date);

  const updateStartTime = (hourValue: string, minuteValue: string) => {
    const nextStartTime = hourValue === ''
      ? undefined
      : scheduleTimeToIso(date, Number(hourValue), minuteValue === '' ? 0 : Number(minuteValue));
    const patch: Partial<ScheduleItem> = { startTime: nextStartTime };
    if (item.startTime && item.endTime && nextStartTime) {
      const diff = new Date(nextStartTime).getTime() - new Date(item.startTime).getTime();
      const endTime = new Date(item.endTime);
      if (!Number.isNaN(diff) && !Number.isNaN(endTime.getTime())) {
        patch.endTime = new Date(endTime.getTime() + diff).toISOString();
      }
    }
    onUpdate(patch);
  };

  const updateEndTime = (hourValue: string, minuteValue: string) => {
    onUpdate({
      endTime: hourValue === ''
        ? undefined
        : scheduleTimeToIso(date, Number(hourValue), minuteValue === '' ? 0 : Number(minuteValue)),
    });
  };

  const renderTimeSelects = (
    parts: { hour: number; minute: number } | null,
    onChange: (hourValue: string, minuteValue: string) => void,
    clearLabel: string,
    onClear: () => void,
  ) => {
    const hourValue = parts ? String(parts.hour) : '';
    const minuteValue = parts ? String(parts.minute) : '';
    return (
      <div className="timeline-time-input-wrap">
        <div className="timeline-time-selects">
          <select
            className="input input-sm timeline-time-select"
            value={hourValue}
            onChange={(e) => onChange(e.target.value, minuteValue)}
            aria-label="時"
          >
            <option value="">--</option>
            {HOUR_OPTIONS.map((hour) => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </select>
          <span className="timeline-time-separator">:</span>
          <select
            className="input input-sm timeline-time-select"
            value={minuteValue}
            onChange={(e) => onChange(hourValue, e.target.value)}
            disabled={hourValue === ''}
            aria-label="分"
          >
            <option value="">--</option>
            {MINUTE_OPTIONS.map((minute) => (
              <option key={minute} value={minute}>
                {pad2(minute)}
              </option>
            ))}
          </select>
        </div>
        {parts && (
          <button
            type="button"
            className="btn btn-ghost btn-sm timeline-time-clear"
            onClick={onClear}
            aria-label={clearLabel}
            title="クリア"
          >
            ×
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="timeline-edit-times timeline-edit-times--stacked">
      <label className="timeline-edit-field">
        <span className="timeline-edit-label">開始</span>
        {renderTimeSelects(
          startParts,
          updateStartTime,
          '開始時刻をクリア',
          () => onUpdate({ startTime: undefined }),
        )}
      </label>
      <label className="timeline-edit-field">
        <span className="timeline-edit-label">終了</span>
        {renderTimeSelects(
          endParts,
          updateEndTime,
          '終了時刻をクリア',
          () => onUpdate({ endTime: undefined }),
        )}
      </label>
    </div>
  );
}
type ChildItemProps = {
  child: ScheduleItem;
  date: string;
  onUpdate: (patch: Partial<ScheduleItem>) => void;
  onRemove: () => void;
};

function ChildItem({ child, date, onUpdate, onRemove }: ChildItemProps) {
  return (
    <li className="timeline-child-item">
      <div className="timeline-child-row">
        <span className="timeline-child-time-col">
          {formatTime(child.startTime, date)}
          {child.endTime && (
            <>
              <span className="timeline-child-time-sep">–</span>
              {formatTime(child.endTime, date)}
            </>
          )}
        </span>
        <label className="timeline-edit-field timeline-edit-field--grow">
          <span className="timeline-edit-label">名前</span>
          <input
            className="input input-sm"
            value={child.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
          />
        </label>
      </div>
      {child.detail && <p className="timeline-child-detail">{child.detail}</p>}
      <div className="timeline-child-actions">
        <TimeEditor item={child} date={date} onUpdate={onUpdate} />
        <button type="button" className="btn btn-ghost btn-sm timeline-remove" onClick={onRemove}>
          削除
        </button>
      </div>
    </li>
  );
}

type TimelineCardProps = {
  row: TimelineRow;
  rowId: string;
  date: string;
  cardExpanded: boolean;
  onCardToggle: () => void;
  childExpanded: boolean;
  onChildToggle: () => void;
  onUpdateDaily: (index: number, patch: Partial<ScheduleItem>) => void;
  onUpdateTask: (index: number, patch: Partial<ScheduleItem>) => void;
  onUpdateCalendar: (index: number, patch: Partial<ScheduleItem>) => void;
  onRemoveDaily: (index: number, childIndexes?: number[]) => void;
};

function TimelineCard({
  row,
  rowId,
  date,
  cardExpanded,
  onCardToggle,
  childExpanded,
  onChildToggle,
  onUpdateDaily,
  onUpdateTask,
  onUpdateCalendar,
  onRemoveDaily,
}: TimelineCardProps) {
  const { item, kind, index, children } = row;
  const hasChildren = children.length > 0;
  const isCalendar = kind === 'calendar';
  const isAllDay = isCalendar && item.isAllDay;
  const editable = kind === 'daily' || kind === 'task' || isCalendar;
  const timeEditable = editable && !isAllDay;
  const badgeClass = sourceBadgeClass(kind);

  const update = (patch: Partial<ScheduleItem>) => {
    if (index === undefined) {
      return;
    }
    if (kind === 'daily') onUpdateDaily(index, patch);
    else if (kind === 'task') onUpdateTask(index, patch);
    else if (kind === 'calendar') onUpdateCalendar(index, patch);
  };

  return (
    <li
      className={`timeline-item source-${item.source} timeline-item--editable${cardExpanded ? '' : ' timeline-item--collapsed'}`}
    >
      <div className="timeline-time-col">
        <span className="timeline-time">{formatTime(item.startTime, date)}</span>
        {item.endTime && <span className="timeline-time-end">{formatTime(item.endTime, date)}</span>}
      </div>

      <div className={`timeline-card${cardExpanded ? '' : ' timeline-card--collapsed'}`}>
        {!cardExpanded ? (
          <button
            type="button"
            className="timeline-card-collapsed"
            onClick={onCardToggle}
            aria-expanded={false}
            aria-label={`${item.title} を開く`}
          >
            <span className="timeline-card-collapsed-dot" aria-hidden />
            <span className="timeline-card-collapsed-title">{item.title}</span>
            {hasChildren && (
              <span className="timeline-card-collapsed-meta">{children.length}件</span>
            )}
            <span className="accordion-chevron timeline-card-collapsed-chevron" aria-hidden>
              ›
            </span>
          </button>
        ) : (
          <>
            <div className="timeline-card-toolbar">
              <span className={`badge ${badgeClass}`}>
                {sourceLabel(kind, item.category)}
                {isAllDay && <span className="badge badge-all-day">終日</span>}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm timeline-card-close"
                onClick={onCardToggle}
                aria-label={`${item.title} を閉じる`}
              >
                閉じる
              </button>
            </div>

            <div className="timeline-card-top">
              {editable ? (
                <label className="timeline-edit-field">
                  <span className="timeline-edit-label">名前</span>
                  <input
                    className="input input-sm"
                    value={item.title}
                    onChange={(e) => update({ title: e.target.value })}
                  />
                </label>
              ) : (
                <strong className="timeline-title">{item.title}</strong>
              )}

              {editable ? (
                <label className="timeline-edit-field">
                  <span className="timeline-edit-label">詳細</span>
                  <input
                    className="input input-sm"
                    value={item.detail ?? ''}
                    placeholder="（なし）"
                    onChange={(e) => update({ detail: e.target.value || undefined })}
                  />
                </label>
              ) : (
                item.detail && <p className="detail">{item.detail}</p>
              )}

              {timeEditable && (
                <div className="timeline-card-actions">
                  <TimeEditor item={item} date={date} onUpdate={update} />
                  {kind === 'daily' && index !== undefined && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm timeline-remove"
                      onClick={() => onRemoveDaily(index, children.map((child) => child.index))}
                    >
                      削除
                    </button>
                  )}
                </div>
              )}

              {kind === 'daily' && !timeEditable && index !== undefined && (
                <div className="timeline-card-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm timeline-remove"
                    onClick={() => onRemoveDaily(index, children.map((child) => child.index))}
                  >
                    削除
                  </button>
                </div>
              )}
            </div>

            {hasChildren && (
              <>
                <button
                  type="button"
                  className="timeline-accordion-bar"
                  onClick={onChildToggle}
                  aria-expanded={childExpanded}
                  aria-controls={`children-${rowId}`}
                >
                  <span className={`accordion-chevron${childExpanded ? ' accordion-chevron--open' : ''}`} aria-hidden>
                    ›
                  </span>
                  <span className="timeline-accordion-label">子タスク</span>
                  <span className="timeline-accordion-count">{children.length}件</span>
                </button>

                <div
                  id={`children-${rowId}`}
                  className={`timeline-children${childExpanded ? ' timeline-children--open' : ''}`}
                  hidden={!childExpanded}
                >
                  <ul className="timeline-child-list">
                    {children.map(({ item: child, index: childIndex }) => (
                      <ChildItem
                        key={`child-${childIndex}`}
                        child={child}
                        date={date}
                        onUpdate={(patch) => onUpdateDaily(childIndex, patch)}
                        onRemove={() => onRemoveDaily(childIndex)}
                      />
                    ))}
                  </ul>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </li>
  );
}

export function ScheduleTimeline({
  items,
  calendarEvents = [],
  tasks = [],
  date,
  onItemsChange,
  onTasksChange,
  onCalendarChange,
  expandedCardKeys,
  onExpandedCardKeysChange,
  onRowKeysChange,
}: ScheduleTimelineProps) {
  const [internalExpandedCardKeys, setInternalExpandedCardKeys] = useState<string[]>([]);
  const [childExpandedKeys, setChildExpandedKeys] = useState<Set<string>>(new Set());

  const cardExpandedKeys = expandedCardKeys ?? internalExpandedCardKeys;
  const setCardExpandedKeys = onExpandedCardKeysChange ?? setInternalExpandedCardKeys;

  const cardExpandedKeySet = useMemo(() => new Set(cardExpandedKeys), [cardExpandedKeys]);
  const isCardExpanded = (key: string) => cardExpandedKeySet.has(key);

  const rows = useMemo(
    () => buildTimelineRows(items, calendarEvents, tasks),
    [items, calendarEvents, tasks],
  );

  const rowKeys = useMemo(() => rows.map((row, idx) => rowKey(row, idx)), [rows]);

  useEffect(() => {
    onRowKeysChange?.(rowKeys);
  }, [rowKeys, onRowKeysChange]);

  const updateDaily = (index: number, patch: Partial<ScheduleItem>) => {
    if (!onItemsChange) return;
    const oldTitle = items[index]?.title;
    const newTitle = patch.title;
    onItemsChange(
      items.map((item, i) => {
        if (i === index) return { ...item, ...patch };
        if (newTitle && oldTitle && item.parentName === oldTitle) {
          return { ...item, parentName: newTitle };
        }
        return item;
      }),
    );
  };

  const updateTask = (index: number, patch: Partial<ScheduleItem>) => {
    if (!onTasksChange) return;
    onTasksChange(tasks.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const updateCalendar = (index: number, patch: Partial<ScheduleItem>) => {
    if (!onCalendarChange) return;
    onCalendarChange(calendarEvents.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeDaily = (index: number, childIndexes: number[] = []) => {
    if (!onItemsChange) return;
    const removed = items[index];
    const removeIndexes = new Set([index, ...childIndexes]);
    onItemsChange(
      items.filter((item, i) => !removeIndexes.has(i) && (!removed || item.parentName !== removed.title)),
    );
  };

  const addDaily = () => {
    if (!onItemsChange) return;
    const newIndex = items.length;
    onItemsChange([
      ...items,
      {
        title: '新規タスク',
        source: 'daily',
        category: 'DailyTask',
        status: 'needsAction',
      },
    ]);
    setCardExpandedKeys([...cardExpandedKeys, `daily-${newIndex}`]);
  };

  const toggleCard = (key: string) => {
    setCardExpandedKeys(
      isCardExpanded(key)
        ? cardExpandedKeys.filter((entry) => entry !== key)
        : [...cardExpandedKeys, key],
    );
  };

  const toggleChild = (key: string) => {
    setChildExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (rows.length === 0) {
    return (
      <div className="timeline-empty">
        <p className="empty">予定がありません</p>
        {onItemsChange && (
          <button type="button" className="btn btn-secondary" onClick={addDaily}>
            タスクを追加
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="timeline-wrap">
      <ul className="timeline">
        {rows.map((row, idx) => {
          const key = rowKey(row, idx);
          return (
            <TimelineCard
              key={key}
              row={row}
              rowId={key}
              date={date}
              cardExpanded={isCardExpanded(key)}
              onCardToggle={() => toggleCard(key)}
              childExpanded={childExpandedKeys.has(key)}
              onChildToggle={() => toggleChild(key)}
              onUpdateDaily={updateDaily}
              onUpdateTask={updateTask}
              onUpdateCalendar={updateCalendar}
              onRemoveDaily={removeDaily}
            />
          );
        })}
      </ul>
      {onItemsChange && (
        <button type="button" className="btn btn-secondary btn-block timeline-add" onClick={addDaily}>
          デイリータスクを追加
        </button>
      )}
    </div>
  );
}
