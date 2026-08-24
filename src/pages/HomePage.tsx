import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from '../components/DatePicker';
import { todayString } from '../utils/date';
import { toErrorMessage } from '../utils/errors';
import { useAuth } from '../hooks/useAuth';
import { fetchCalendarEvents } from '../services/googleCalendar';
import { fetchTasks } from '../services/googleTasks';
import { loadTemplates } from '../services/templateLoader';
import { generateSchedule } from '../services/geminiAgent';
import { mergeTaskSchedulesIntoDraft } from '../services/taskScheduleMerge';
import { saveScheduleDraft } from '../storage/scheduleDraft';
import { loadStoredGeminiModel } from '../storage/geminiModelStorage';
import { getGeminiModelLabel } from '../../shared/geminiModels.ts';
import type { GeneratedSchedule } from '../types';

export function HomePage() {
  const navigate = useNavigate();
  const { authed, login } = useAuth();
  const [date, setDate] = useState(todayString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modelLabel = getGeminiModelLabel(loadStoredGeminiModel());

  const handleGenerate = async () => {
    setError(null);
    setLoading(true);
    const invokedAt = new Date().toISOString();
    try {
      const [calendarEvents, tasks, templates] = await Promise.all([
        fetchCalendarEvents(date),
        fetchTasks(date),
        loadTemplates(),
      ]);

      const schedule: GeneratedSchedule = await generateSchedule({
        date,
        invokedAt,
        calendarEvents,
        tasks,
        templates,
      });

      const tasksWithSchedules = mergeTaskSchedulesIntoDraft(tasks, schedule);

      saveScheduleDraft({ schedule, calendarEvents, tasks: tasksWithSchedules });
      navigate('/preview');
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page page-home">
      <h1>Schedule Assistant</h1>
      <p className="subtitle">デイリータスクを自動で割り振ります</p>

      <DatePicker value={date} onChange={setDate} />

      {authed === false && (
        <button type="button" className="btn btn-primary btn-block" onClick={() => login()}>
          Google アカウント連携
        </button>
      )}

      {authed && (
        <>
          <p className="home-model-note">利用モデル: {modelLabel}</p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? '生成中…' : 'スケジュール生成'}
          </button>
        </>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
