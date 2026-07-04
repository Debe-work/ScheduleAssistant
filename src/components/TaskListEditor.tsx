import type { ScheduleItem } from '../types';

type TaskListEditorProps = {
  items: ScheduleItem[];
  onChange: (items: ScheduleItem[]) => void;
};

export function TaskListEditor({ items, onChange }: TaskListEditorProps) {
  const update = (index: number, patch: Partial<ScheduleItem>) => {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const add = () => {
    onChange([
      ...items,
      {
        title: '新規タスク',
        source: 'daily',
        category: 'DailyTask',
        status: 'needsAction',
      },
    ]);
  };

  return (
    <div className="editor">
      {items.map((item, index) => (
        <div key={index} className="editor-row">
          <input
            className="input"
            value={item.title}
            onChange={(e) => update(index, { title: e.target.value })}
            placeholder="タスク名"
          />
          <input
            className="input"
            type="datetime-local"
            value={item.startTime ? toLocalInput(item.startTime) : ''}
            onChange={(e) =>
              update(index, { startTime: e.target.value ? new Date(e.target.value).toISOString() : undefined })
            }
          />
          <input
            className="input"
            type="datetime-local"
            value={item.endTime ? toLocalInput(item.endTime) : ''}
            onChange={(e) =>
              update(index, { endTime: e.target.value ? new Date(e.target.value).toISOString() : undefined })
            }
          />
          <button type="button" className="btn btn-ghost" onClick={() => remove(index)}>
            削除
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-secondary" onClick={add}>
        タスク追加
      </button>
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
