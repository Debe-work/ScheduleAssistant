import type { DailyTaskTemplate, GeneratedSchedule, ScheduleItem } from '../types';

type GenerateScheduleRequest = {
  date: string;
  invokedAt: string;
  calendarEvents: ScheduleItem[];
  tasks: ScheduleItem[];
  templates: DailyTaskTemplate[];
  timeZone: string;
};

function getWorkerBaseUrl(): string {
  return import.meta.env.VITE_WORKER_BASE_URL?.replace(/\/$/, '') ?? '';
}

function buildWorkerUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getWorkerBaseUrl()}${normalizedPath}`;
}

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.error === 'string') {
      return data.error;
    }
  } catch {
    // ignore JSON parse failure
  }
  return `Gemini 生成 API エラー: ${res.status}`;
}

export async function generateSchedule(params: {
  date: string;
  invokedAt: string;
  calendarEvents: ScheduleItem[];
  tasks: ScheduleItem[];
  templates: DailyTaskTemplate[];
}): Promise<GeneratedSchedule> {
  const body: GenerateScheduleRequest = {
    ...params,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  const res = await fetch(buildWorkerUrl('/api/gemini/schedule'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(await readError(res));
  }

  return res.json() as Promise<GeneratedSchedule>;
}
