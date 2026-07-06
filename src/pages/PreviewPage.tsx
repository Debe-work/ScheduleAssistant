import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ScheduleTimeline } from '../components/ScheduleTimeline';
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
    setDraft((prev) => {
      if (!prev) return prev;
      const next: ScheduleDraft = {
        ...prev,
        schedule: { ...prev.schedule, items },
      };
      saveScheduleDraft(next);
      return next;
    });
  };

  const handleTasksChange = (tasks: ScheduleDraft['tasks']) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next: ScheduleDraft = { ...prev, tasks };
      saveScheduleDraft(next);
      return next;
    });
  };

  const handleCalendarChange = (calendarEvents: ScheduleDraft['calendarEvents']) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next: ScheduleDraft = { ...prev, calendarEvents };
      saveScheduleDraft(next);
      return next;
    });
  };

  const handleRegister = async () => {
    if (!draft) return;
    if (!confirm('専用カレンダーと Google Todo に登録しますか？')) return;

    setRegistering(true);
    setResult(null);
    try {
      const res = await registerSchedule(draft.schedule, [
        ...draft.calendarEvents,
        ...draft.tasks,
      ]);
      setResult(
        `専用カレンダー作成: ${res.calendarCreated}件 / カレンダー更新: ${res.calendarUpdated}件 / Todo 新規: ${res.tasksCreated}件 / Todo 更新: ${res.tasksUpdated}件 / スキップ: ${res.skipped}件` +
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
        <h2>スケジュール</h2>
        <p className="section-hint">
          デイリータスク・Google Todo・カレンダーの取得項目を編集できます。終日予定は日付のみのため時刻は編集できません。
          登録時は時刻把握用に専用カレンダーへ予定を作り、Todo 操作用に Google Todo も作成・更新します。
        </p>
        <ScheduleTimeline
          items={draft.schedule.items}
          calendarEvents={draft.calendarEvents}
          tasks={draft.tasks}
          date={draft.schedule.date}
          onItemsChange={handleItemsChange}
          onTasksChange={handleTasksChange}
          onCalendarChange={handleCalendarChange}
        />
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
