import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from '../components/DatePicker';
import { todayString } from '../utils/date';
import { isAuthenticated, startLogin } from '../services/googleAuth';
import { fetchCalendarEvents } from '../services/googleCalendar';
import { fetchTasks } from '../services/googleTasks';
import { loadTemplates } from '../services/templateLoader';
import { generateSchedule } from '../services/geminiAgent';
import { saveScheduleDraft } from '../storage/scheduleDraft';
import type { GeneratedSchedule } from '../types';

export function HomePage() {
  const navigate = useNavigate();
  const [date, setDate] = useState(todayString());
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isAuthenticated()
      .then(setAuthed)
      .catch(() => setAuthed(false));
  }, []);

  const handleGenerate = async () => {
    setError(null);
    setLoading(true);
    try {
      const [calendarEvents, tasks, templates] = await Promise.all([
        fetchCalendarEvents(date),
        fetchTasks(date),
        loadTemplates(),
      ]);

      const schedule: GeneratedSchedule = await generateSchedule({
        date,
        invokedAt: new Date().toISOString(),
        calendarEvents,
        tasks,
        templates,
      });

      saveScheduleDraft({ schedule, calendarEvents, tasks });
      navigate('/preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h1>Schedule Assistant</h1>
      <p className="subtitle">デイリータスクを自動で割り振ります</p>

      <DatePicker value={date} onChange={setDate} />

      {authed === false && (
        <button type="button" className="btn btn-primary btn-block" onClick={() => startLogin()}>
          Google アカウント連携
        </button>
      )}

      {authed && (
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={handleGenerate}
          disabled={loading}
        >
          {loading ? '生成中…' : 'スケジュール生成'}
        </button>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}

