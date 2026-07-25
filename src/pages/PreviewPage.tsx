import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HelpHint } from '../components/HelpHint';
import { ScheduleTimeline } from '../components/ScheduleTimeline';
import { loadScheduleDraft, saveScheduleDraft, type ScheduleDraft } from '../storage/scheduleDraft';
import { RegisterResultPanel } from '../components/RegisterResultPanel';
import { registerSchedule, type RegisterResult } from '../services/scheduleRegister';
import type { GeneratedSchedule } from '../types';
import { formatScheduleDateLabel, parseScheduleDateParts } from '../utils/date';
import { toErrorMessage } from '../utils/errors';
import { splitJapaneseSentences } from '../utils/text';
import { areAllTimelineCardsExpanded } from '../utils/timelineExpansion';

export function PreviewPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<ScheduleDraft | null>(null);
  const [registering, setRegistering] = useState(false);
  const [registerResult, setRegisterResult] = useState<RegisterResult | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [expandedCardKeys, setExpandedCardKeys] = useState<string[]>([]);
  const [rowKeys, setRowKeys] = useState<string[]>([]);

  const allCardsExpanded = areAllTimelineCardsExpanded(rowKeys, expandedCardKeys);

  const handleToggleAllCards = () => {
    setExpandedCardKeys(allCardsExpanded ? [] : [...rowKeys]);
  };

  useEffect(() => {
    const loaded = loadScheduleDraft();
    if (!loaded) {
      navigate('/');
      return;
    }
    setDraft(loaded);
  }, [navigate]);

  const updateDraft = (updater: (draft: ScheduleDraft) => ScheduleDraft) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      saveScheduleDraft(next);
      return next;
    });
  };

  const handleItemsChange = (items: GeneratedSchedule['items']) => {
    updateDraft((prev) => ({
      ...prev,
      schedule: { ...prev.schedule, items },
    }));
  };

  const handleTasksChange = (tasks: ScheduleDraft['tasks']) => {
    updateDraft((prev) => ({ ...prev, tasks }));
  };

  const handleCalendarChange = (calendarEvents: ScheduleDraft['calendarEvents']) => {
    updateDraft((prev) => ({ ...prev, calendarEvents }));
  };

  const handleRegister = async () => {
    if (!draft) return;
    if (!confirm('専用カレンダーと Google Todo に登録しますか？')) return;

    setRegistering(true);
    setRegisterResult(null);
    setRegisterError(null);
    try {
      const res = await registerSchedule(draft.schedule, [
        ...draft.calendarEvents,
        ...draft.tasks,
      ]);
      setRegisterResult(res);
    } catch (e) {
      setRegisterError(toErrorMessage(e));
    } finally {
      setRegistering(false);
    }
  };

  if (!draft) return <p className="loading">読み込み中…</p>;

  const dateParts = parseScheduleDateParts(draft.schedule.date);

  return (
    <div className="page page-preview">
      <header className="preview-header">
        <div className="preview-header-card">
          <div className="preview-header-glow" aria-hidden="true" />
          <div className="preview-header-top">
            <span className="preview-header-badge">Preview</span>
            {dateParts && <span className="preview-header-weekday">{dateParts.weekdayLong}</span>}
          </div>
          {dateParts ? (
            <div className="preview-header-date" aria-label={formatScheduleDateLabel(draft.schedule.date)}>
              <span className="preview-header-date-main">
                <span className="preview-header-date-num">{dateParts.month}</span>
                <span className="preview-header-date-unit">月</span>
                <span className="preview-header-date-num">{dateParts.day}</span>
                <span className="preview-header-date-unit">日</span>
              </span>
              <span className="preview-header-year">{dateParts.year}</span>
            </div>
          ) : (
            <h1 className="preview-header-fallback">{draft.schedule.date}</h1>
          )}
          <p className="preview-header-caption">生成結果を確認してから登録</p>
        </div>
      </header>

      {draft.schedule.summary && (
        <div className="preview-summary">
          <p className="preview-summary-label">AI からの提案</p>
          <div className="preview-summary-body">
            {splitJapaneseSentences(draft.schedule.summary).map((sentence) => (
              <p key={sentence} className="preview-summary-sentence">
                {sentence}
              </p>
            ))}
          </div>
        </div>
      )}

      <section className="preview-schedule-section">
        <div className="section-heading-row">
          <h2>スケジュール</h2>
          <div className="section-heading-actions">
            {rowKeys.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm section-bulk-toggle"
                onClick={handleToggleAllCards}
              >
                {allCardsExpanded ? 'すべて閉じる' : 'すべて開く'}
              </button>
            )}
            <HelpHint label="スケジュール編集のヒント">
              <p>デイリータスク・Google Todo・カレンダーの取得項目を編集できます。</p>
              <p>終日予定は日付のみのため、時刻は編集できません。</p>
              <p>登録時は時刻把握用に専用カレンダーへ予定を作り、Todo 操作用に Google Todo も作成・更新します。</p>
            </HelpHint>
          </div>
        </div>
        <ScheduleTimeline
          items={draft.schedule.items}
          calendarEvents={draft.calendarEvents}
          tasks={draft.tasks}
          date={draft.schedule.date}
          expandedCardKeys={expandedCardKeys}
          onExpandedCardKeysChange={setExpandedCardKeys}
          onRowKeysChange={setRowKeys}
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

      {registerResult && <RegisterResultPanel result={registerResult} />}
      {registerError && <p className="error register-error">{registerError}</p>}

      <Link to="/" className="link-back">
        ← 戻る
      </Link>
    </div>
  );
}
