import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GeneratedSchedule } from '../types';
import { generateSchedule } from './geminiAgent';

const fetchMock = vi.fn();

const baseParams = {
  date: '2026-07-06',
  invokedAt: '2026-07-06T07:00:00.000Z',
  calendarEvents: [],
  tasks: [],
  templates: [],
};

describe('generateSchedule', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_WORKER_BASE_URL', 'https://worker.example/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('posts schedule generation params to the Worker with credentials', async () => {
    const schedule: GeneratedSchedule = {
      date: '2026-07-06',
      summary: '生成しました',
      items: [
        {
          title: 'AM-HK',
          source: 'daily',
          startTime: '2026-07-06T00:00:00.000Z',
          endTime: '2026-07-06T01:00:00.000Z',
        },
      ],
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(schedule), { status: 200 }));

    await expect(generateSchedule(baseParams)).resolves.toEqual(schedule);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://worker.example/api/gemini/schedule');
    expect(init).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    expect(JSON.parse(init.body as string)).toMatchObject({
      ...baseParams,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  });

  it('throws Worker error messages from JSON error responses', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Gemini API の quota 上限に達しました' }), { status: 429 }),
    );

    await expect(generateSchedule(baseParams)).rejects.toThrow('Gemini API の quota 上限に達しました');
  });

  it('falls back to a generic error when the response body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('service unavailable', { status: 503 }));

    await expect(generateSchedule(baseParams)).rejects.toThrow('Gemini 生成 API エラー: 503');
  });
});
