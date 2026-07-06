import type { DailyTaskTemplate, GeneratedSchedule, ScheduleItem } from '../types';
import { readWorkerError, workerFetch } from './workerClient';

type GenerateScheduleRequest = {
  date: string;
  invokedAt: string;
  calendarEvents: ScheduleItem[];
  tasks: ScheduleItem[];
  templates: DailyTaskTemplate[];
  timeZone: string;
};

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

  const res = await workerFetch('/api/gemini/schedule', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(await readWorkerError(res, 'Gemini 生成 API エラー'));
  }

  return res.json() as Promise<GeneratedSchedule>;
}
