import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildSchedulePrompt, parseGeneratedSchedule } from '../prompts/dailySchedule';
import type { DailyTaskTemplate, GeneratedSchedule, ScheduleItem } from '../types';

function getApiKey(): string {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) throw new Error('VITE_GEMINI_API_KEY が設定されていません');
  return key;
}

export async function generateSchedule(params: {
  date: string;
  invokedAt: string;
  calendarEvents: ScheduleItem[];
  tasks: ScheduleItem[];
  templates: DailyTaskTemplate[];
}): Promise<GeneratedSchedule> {
  const genAI = new GoogleGenerativeAI(getApiKey());
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  const prompt = buildSchedulePrompt(params);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return parseGeneratedSchedule(text);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastError ?? new Error('スケジュール生成に失敗しました');
}
