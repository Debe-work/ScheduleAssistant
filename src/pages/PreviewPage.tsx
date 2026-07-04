import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ScheduleTimeline } from '../components/ScheduleTimeline';
import { TaskListEditor } from '../components/TaskListEditor';
import { loadScheduleDraft, saveScheduleDraft, type ScheduleDraft } from '../storage/scheduleDraft';
import { registerSchedule } from '../services/scheduleRegister';
import type { GeneratedSchedule } from '../types';

export function PreviewPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<ScheduleDraft | null>(null);
  const [registering, setRegistering] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadScheduleDraft();
    if (!loaded) {
      navigate('/');
      return;
    }
    setDraft(loaded);
  }, [navigate]);

  const handleItemsChange = (items: GeneratedSchedule['items']) => {
    if (!draft) return;
    const next: ScheduleDraft = {
      ...draft,
      schedule: { ...draft.schedule, items },
    };
    setDraft(next);
    saveScheduleDraft(next);
  };

  const handleRegister = async () => {
    if (!draft) return;
    if (!confirm('Google Calendar / Todo に登録しますか？')) return;

    setRegistering(true);
    setResult(null);
    try {
      const res = await registerSchedule(draft.schedule, [
        ...draft.calendarEvents,
        ...draft.tasks,
      ]);
      setResult(
        `Calendar: ${res.calendarCreated}件 / Todo: ${res.tasksCreated}件 / スキップ: ${res.skipped}件` +
          (res.errors.length ? `\nエラー: ${res.errors.join(', ')}` : '') +
          (res.warnings.length ? `\n警告: ${res.warnings.join(', ')}` : ''),
      );
    } catch (e) {
      setResult(e instanceof Error ? e.message : String(e));
    } finally {
      setRegistering(false);
    }
  };

  if (!draft) return <p className="loading">読み込み中…</p>;

  return (
    <div className="page">
      <h1>プレビュー</h1>
      {draft.schedule.summary && <p className="summary">{draft.schedule.summary}</p>}

      <section>
        <h2>タイムライン</h2>
        <ScheduleTimeline
          items={draft.schedule.items}
          existingItems={[...draft.calendarEvents, ...draft.tasks]}
        />
      </section>

      <section>
        <h2>編集</h2>
        <TaskListEditor items={draft.schedule.items} onChange={handleItemsChange} />
      </section>

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={handleRegister}
        disabled={registering}
      >
        {registering ? '登録中…' : 'Google に登録'}
      </button>

      {result && <pre className="result">{result}</pre>}

      <Link to="/" className="link-back">
        ← 戻る
      </Link>
    </div>
  );
}
