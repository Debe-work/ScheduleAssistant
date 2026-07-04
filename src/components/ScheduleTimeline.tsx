import type { ScheduleItem } from '../types';

type ScheduleTimelineProps = {
  items: ScheduleItem[];
  existingItems?: ScheduleItem[];
};

function formatTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

export function ScheduleTimeline({ items, existingItems = [] }: ScheduleTimelineProps) {
  const all = [
    ...existingItems.map((i) => ({ ...i, readonly: true })),
    ...items.map((i) => ({ ...i, readonly: false })),
  ].sort((a, b) => {
    if (!a.startTime) return 1;
    if (!b.startTime) return -1;
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });

  if (all.length === 0) {
    return <p className="empty">予定がありません</p>;
  }

  return (
    <ul className="timeline">
      {all.map((item, idx) => (
        <li key={`${item.title}-${idx}`} className={`timeline-item source-${item.source}`}>
          <div className="timeline-time">
            {formatTime(item.startTime)}
            {item.endTime && ` – ${formatTime(item.endTime)}`}
          </div>
          <div className="timeline-body">
            <strong>{item.title}</strong>
            {item.detail && <p className="detail">{item.detail}</p>}
            <span className="badge">{item.source}</span>
            {item.parentName && <span className="badge">↳ {item.parentName}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
