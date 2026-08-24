import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyInvocationTimeRule, callGemini } from './index';

const fetchMock = vi.fn();

describe('callGemini', () => {
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('calls Interactions API with private structured output settings', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      status: 'completed',
      steps: [
        { type: 'thought' },
        {
          type: 'model_output',
          content: [
            { type: 'text', text: '{"date":"2026-08-25",' },
            { type: 'text', text: '"items":[],"summary":"調整なし"}' },
          ],
        },
      ],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(callGemini(
      { GEMINI_API_KEY: 'test-key' },
      'schedule prompt',
      'gemini-3.5-flash-lite',
    )).resolves.toEqual({
      ok: true,
      text: '{"date":"2026-08-25","items":[],"summary":"調整なし"}',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
    expect(new Headers(init.headers).get('x-goog-api-key')).toBe('test-key');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: 'gemini-3.5-flash-lite',
      input: 'schedule prompt',
      store: false,
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: {
          type: 'object',
          required: ['date', 'items', 'summary'],
        },
      },
    });
  });

  it('ignores non-output steps and returns an error for empty output', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      status: 'completed',
      steps: [{ type: 'thought' }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(callGemini(
      { GEMINI_API_KEY: 'test-key' },
      'schedule prompt',
      'gemini-3.5-flash-lite',
    )).resolves.toEqual({
      ok: false,
      error: {
        status: 502,
        message: 'Gemini API から生成結果が返されませんでした',
        retryable: false,
      },
    });
  });

  it('returns failed Interaction errors without parsing output', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      status: 'failed',
      steps: [{ type: 'model_output', error: { message: 'model failed' } }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(callGemini(
      { GEMINI_API_KEY: 'test-key' },
      'schedule prompt',
      'gemini-3.5-flash-lite',
    )).resolves.toEqual({
      ok: false,
      error: {
        status: 502,
        message: 'model failed',
        retryable: false,
      },
    });
  });

  it('maps quota and rate-limit responses to existing error contracts', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      error: { status: 'RESOURCE_EXHAUSTED', message: 'quota exhausted' },
    }), { status: 429 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      error: { message: 'try again later' },
    }), { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(callGemini(
      { GEMINI_API_KEY: 'test-key' },
      'schedule prompt',
      'gemini-3.5-flash-lite',
    )).resolves.toMatchObject({
      ok: false,
      error: {
        status: 429,
        retryable: false,
      },
    });
    await expect(callGemini(
      { GEMINI_API_KEY: 'test-key' },
      'schedule prompt',
      'gemini-3.5-flash-lite',
    )).resolves.toEqual({
      ok: false,
      error: {
        status: 429,
        message: 'Gemini API のリクエスト制限に達しました。しばらく待ってから再試行してください',
        retryable: true,
      },
    });
  });
});

describe('applyInvocationTimeRule', () => {
  const params = {
    date: '2026-08-25',
    invokedAt: '2026-08-24T23:24:15.000Z',
    timeZone: 'Asia/Tokyo',
    templates: [
      {
        name: '起床',
        startTime: 'アプリを呼び出した瞬間',
        detail: '洗顔、飲水、水筒用意',
        category: 'DailyTask',
        defaultComplete: true,
      },
    ],
  };

  it('pins the wake task to the invocation instant instead of model output', () => {
    const result = applyInvocationTimeRule(
      {
        date: params.date,
        summary: '調整なし',
        items: [{
          title: '起床',
          source: 'daily',
          startTime: '2026-08-24T23:00:00.000Z',
          endTime: '2026-08-24T23:15:00.000Z',
          status: 'needsAction',
        }],
      },
      params,
    );

    expect(result.items).toEqual([{
      title: '起床',
      source: 'daily',
      detail: '洗顔、飲水、水筒用意',
      category: 'DailyTask',
      startTime: '2026-08-24T23:24:15.000Z',
      endTime: undefined,
      status: 'completed',
      defaultComplete: true,
    }]);
  });

  it('adds the wake task when the model omits it', () => {
    const result = applyInvocationTimeRule(
      {
        date: params.date,
        summary: '調整なし',
        items: [],
      },
      params,
    );

    expect(result.items).toContainEqual({
      title: '起床',
      source: 'daily',
      detail: '洗顔、飲水、水筒用意',
      category: 'DailyTask',
      startTime: '2026-08-24T23:24:15.000Z',
      endTime: undefined,
      status: 'completed',
      defaultComplete: true,
    });
  });

  it('removes the invocation-only task for a different registered date', () => {
    const result = applyInvocationTimeRule(
      {
        date: '2026-08-26',
        summary: '調整なし',
        items: [{
          title: '起床',
          source: 'daily',
          startTime: '2026-08-25T23:00:00.000Z',
        }],
      },
      { ...params, date: '2026-08-26' },
    );

    expect(result.items).toEqual([]);
  });
});
