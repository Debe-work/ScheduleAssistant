const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GEMINI_GENERATE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/tasks',
].join(' ');
const SESSION_COOKIE_NAME = 'schedule_assistant_session';
const AUTH_TRANSACTION_TTL_MS = 10 * 60 * 1000;
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const ACCESS_TOKEN_SKEW_MS = 60 * 1000;

type Env = {
  AUTH_STORE: DurableObjectNamespace;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  TOKEN_ENCRYPTION_KEY: string;
  APP_ORIGINS: string;
  GEMINI_API_KEY: string;
};

type DailyTaskTemplate = {
  name: string;
  condition?: string;
  category?: string;
  detail?: string;
  startTime?: string;
  endTime?: string;
  defaultComplete?: boolean;
  children?: Omit<DailyTaskTemplate, 'category' | 'children'>[];
};

type ScheduleItem = {
  id?: string;
  title: string;
  detail?: string;
  startTime?: string;
  endTime?: string;
  source: 'calendar' | 'task' | 'daily';
  category?: string;
  parentName?: string;
  status?: 'needsAction' | 'completed';
  defaultComplete?: boolean;
};

type GeneratedSchedule = {
  date: string;
  items: ScheduleItem[];
  summary: string;
  taskSchedules?: TaskSchedule[];
};

type TaskSchedule = {
  title: string;
  startTime?: string;
  endTime?: string;
};

type GenerateScheduleRequest = {
  date: string;
  invokedAt: string;
  calendarEvents: ScheduleItem[];
  tasks: ScheduleItem[];
  templates: DailyTaskTemplate[];
  timeZone: string;
};

type AuthTransaction = {
  codeVerifier: string;
  returnTo: string;
  createdAt: number;
};

type SessionRecord = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  createdAt: number;
  updatedAt: number;
};

type EncryptedValue = {
  iv: string;
  ciphertext: string;
};

type StoredSessionRecord = {
  accessToken: EncryptedValue;
  refreshToken?: EncryptedValue;
  expiresAt: number;
  createdAt: number;
  updatedAt: number;
};

type OAuthTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
};

type GeminiResponse = {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
};

type ResolvedSession =
  | { sessionId: string; session: SessionRecord }
  | { sessionId: null; session: null; clearCookie: boolean };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (
      request.method === 'OPTIONS'
      && (url.pathname.startsWith('/api/google/') || url.pathname.startsWith('/api/gemini/'))
    ) {
      return new Response(null, {
        status: 204,
        headers: buildCorsHeaders(request, env),
      });
    }

    try {
      if (request.method === 'GET' && url.pathname === '/api/google/health') {
        return jsonResponse({ ok: true }, request, env);
      }

      if (request.method === 'GET' && url.pathname === '/api/google/login') {
        return handleLogin(request, env);
      }

      if (request.method === 'GET' && url.pathname === '/api/google/callback') {
        return handleCallback(request, env);
      }

      if (request.method === 'GET' && url.pathname === '/api/google/access-token') {
        return handleAccessToken(request, env);
      }

      if (request.method === 'GET' && url.pathname === '/api/google/session') {
        return handleSession(request, env);
      }

      if (request.method === 'POST' && url.pathname === '/api/google/logout') {
        return handleLogout(request, env, ctx);
      }

      if (request.method === 'POST' && url.pathname === '/api/gemini/schedule') {
        return handleGenerateSchedule(request, env);
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      return jsonResponse(
        { error: getPublicErrorMessage(error) },
        request,
        env,
        { status: getErrorStatus(error) },
      );
    }
  },
};

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const state = crypto.randomUUID();
  const returnTo = sanitizeReturnTo(url.searchParams.get('returnTo'), env);
  const { verifier, challenge } = await generatePkce();

  await putTransaction(env, state, {
    codeVerifier: verifier,
    returnTo,
    createdAt: Date.now(),
  });

  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: getCallbackUrl(request),
    response_type: 'code',
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
    state,
  }).toString();

  return Response.redirect(authUrl.toString(), 302);
}

async function handleCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const oauthError = url.searchParams.get('error');

  const transaction = state ? await getTransaction(env, state) : null;
  const fallbackRedirect = transaction?.returnTo ?? getDefaultAppUrl(env);

  if (oauthError) {
    if (state) {
      await deleteTransaction(env, state);
    }
    return redirectWithAuthError(request, fallbackRedirect, oauthError);
  }

  if (!state || !code || !transaction) {
    return redirectWithAuthError(request, fallbackRedirect, 'missing_oauth_state');
  }

  await deleteTransaction(env, state);
  if (Date.now() - transaction.createdAt > AUTH_TRANSACTION_TTL_MS) {
    return redirectWithAuthError(request, transaction.returnTo, 'oauth_state_expired');
  }

  const tokenData = await exchangeAuthorizationCode(request, env, code, transaction.codeVerifier);
  const now = Date.now();
  const sessionId = crypto.randomUUID();
  await putSession(env, sessionId, {
    accessToken: tokenData.accessToken,
    refreshToken: tokenData.refreshToken,
    expiresAt: tokenData.expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: transaction.returnTo,
      'Set-Cookie': await buildSessionCookie(request, env, sessionId),
    },
  });
}

async function handleAccessToken(request: Request, env: Env): Promise<Response> {
  const resolved = await resolveSession(request, env);
  if (!resolved.session) {
    return jsonResponse(
      { error: '認証が必要です' },
      request,
      env,
      {
        status: 401,
        headers: resolved.clearCookie ? { 'Set-Cookie': clearSessionCookie(request) } : undefined,
      },
    );
  }

  return jsonResponse(
    {
      accessToken: resolved.session.accessToken,
      expiresAt: resolved.session.expiresAt,
    },
    request,
    env,
  );
}

async function handleSession(request: Request, env: Env): Promise<Response> {
  const resolved = await resolveSession(request, env);
  const shouldClearCookie = 'clearCookie' in resolved && resolved.clearCookie;
  return jsonResponse(
    {
      authenticated: Boolean(resolved.session),
      expiresAt: resolved.session?.expiresAt ?? null,
    },
    request,
    env,
    {
      headers: shouldClearCookie ? { 'Set-Cookie': clearSessionCookie(request) } : undefined,
    },
  );
}

async function handleGenerateSchedule(request: Request, env: Env): Promise<Response> {
  const resolved = await resolveSession(request, env);
  if (!resolved.session) {
    return jsonResponse(
      { error: '認証が必要です' },
      request,
      env,
      {
        status: 401,
        headers: resolved.clearCookie ? { 'Set-Cookie': clearSessionCookie(request) } : undefined,
      },
    );
  }

  const params = await request.json<unknown>();
  const scheduleParams = validateGenerateScheduleRequest(params);
  try {
    const schedule = await generateSchedule(env, scheduleParams);
    return jsonResponse(schedule, request, env);
  } catch (error) {
    return jsonResponse(
      { error: getPublicErrorMessage(error) },
      request,
      env,
      { status: getErrorStatus(error) },
    );
  }
}

async function handleLogout(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const resolved = await resolveSession(request, env);
  if (resolved.sessionId) {
    await deleteSession(env, resolved.sessionId);
    const tokenToRevoke = resolved.session?.refreshToken ?? resolved.session?.accessToken;
    if (tokenToRevoke) {
      ctx.waitUntil(revokeToken(tokenToRevoke));
    }
  }

  return jsonResponse(
    { ok: true },
    request,
    env,
    { headers: { 'Set-Cookie': clearSessionCookie(request) } },
  );
}

function validateGenerateScheduleRequest(value: unknown): GenerateScheduleRequest {
  if (!isRecord(value)) {
    throw new HttpError(400, '生成リクエストの形式が不正です');
  }

  const { date, invokedAt, calendarEvents, tasks, templates, timeZone } = value;
  if (
    typeof date !== 'string'
    || typeof invokedAt !== 'string'
    || typeof timeZone !== 'string'
    || !Array.isArray(calendarEvents)
    || !Array.isArray(tasks)
    || !Array.isArray(templates)
  ) {
    throw new HttpError(400, '生成リクエストの形式が不正です');
  }

  return {
    date,
    invokedAt,
    calendarEvents: calendarEvents.map(validateScheduleItem),
    tasks: tasks.map(validateScheduleItem),
    templates: templates.map(validateDailyTaskTemplate),
    timeZone,
  };
}

function validateScheduleItem(value: unknown): ScheduleItem {
  if (!isRecord(value) || typeof value.title !== 'string' || !isScheduleSource(value.source)) {
    throw new HttpError(400, '予定データの形式が不正です');
  }

  return {
    id: optionalString(value.id),
    title: value.title,
    detail: optionalString(value.detail),
    startTime: optionalString(value.startTime),
    endTime: optionalString(value.endTime),
    source: value.source,
    category: optionalString(value.category),
    parentName: optionalString(value.parentName),
    status: isTaskStatus(value.status) ? value.status : undefined,
    defaultComplete: optionalBoolean(value.defaultComplete),
  };
}

function validateDailyTaskTemplate(value: unknown): DailyTaskTemplate {
  if (!isRecord(value) || typeof value.name !== 'string') {
    throw new HttpError(400, 'テンプレートの形式が不正です');
  }

  return {
    name: value.name,
    condition: optionalString(value.condition),
    category: optionalString(value.category),
    detail: optionalString(value.detail),
    startTime: optionalString(value.startTime),
    endTime: optionalString(value.endTime),
    defaultComplete: optionalBoolean(value.defaultComplete),
    children: Array.isArray(value.children)
      ? value.children.map(validateDailyTaskChildTemplate)
      : undefined,
  };
}

function validateDailyTaskChildTemplate(value: unknown): Omit<DailyTaskTemplate, 'category' | 'children'> {
  if (!isRecord(value) || typeof value.name !== 'string') {
    throw new HttpError(400, 'テンプレートの形式が不正です');
  }

  return {
    name: value.name,
    condition: optionalString(value.condition),
    detail: optionalString(value.detail),
    startTime: optionalString(value.startTime),
    endTime: optionalString(value.endTime),
    defaultComplete: optionalBoolean(value.defaultComplete),
  };
}

type GeminiErrorResponse = {
  error?: {
    message?: string;
    status?: string;
  };
};

type GeminiCallError = {
  status: number;
  message: string;
  retryable: boolean;
};

const MAX_GEMINI_ATTEMPTS = 2;

async function generateSchedule(env: Env, params: GenerateScheduleRequest): Promise<GeneratedSchedule> {
  if (!env.GEMINI_API_KEY) {
    throw new HttpError(500, 'Gemini API Key が設定されていません');
  }

  let lastError: HttpError | null = null;
  for (let attempt = 0; attempt < MAX_GEMINI_ATTEMPTS; attempt++) {
    const result = await callGemini(env, buildSchedulePrompt(params));
    if (result.ok) {
      return parseGeneratedSchedule(result.text);
    }

    lastError = new HttpError(result.error.status, result.error.message);
    const canRetry = attempt === 0 && result.error.retryable;
    if (!canRetry) break;
  }

  throw lastError ?? new HttpError(500, 'スケジュール生成に失敗しました');
}

async function readGeminiError(response: Response): Promise<GeminiErrorResponse['error']> {
  try {
    const data = await response.json() as GeminiErrorResponse;
    return data.error;
  } catch {
    return undefined;
  }
}

function formatGeminiError(error: GeminiErrorResponse['error'], status: number): GeminiCallError {
  const apiStatus = error?.status ?? '';
  const message = error?.message ?? `HTTP ${status}`;

  if (
    apiStatus === 'RESOURCE_EXHAUSTED'
    || message.toLowerCase().includes('quota')
    || message.toLowerCase().includes('exhausted')
  ) {
    return {
      status: 429,
      message: 'Gemini API の quota 上限に達しました。Google AI Studio で利用状況を確認してください',
      retryable: false,
    };
  }

  if (status === 429) {
    return {
      status: 429,
      message: 'Gemini API のリクエスト制限に達しました。しばらく待ってから再試行してください',
      retryable: true,
    };
  }

  return {
    status: status === 429 ? 429 : 502,
    message: `Gemini API エラー: ${message}`,
    retryable: false,
  };
}

async function callGemini(
  env: Env,
  prompt: string,
): Promise<{ ok: true; text: string } | { ok: false; error: GeminiCallError }> {
  const url = new URL(GEMINI_GENERATE_URL);
  url.searchParams.set('key', env.GEMINI_API_KEY);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const error = await readGeminiError(response);
    return { ok: false, error: formatGeminiError(error, response.status) };
  }

  const data = await response.json<GeminiResponse>();
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim();
  if (!text) {
    return {
      ok: false,
      error: {
        status: 502,
        message: 'Gemini API から生成結果が返されませんでした',
        retryable: false,
      },
    };
  }
  return { ok: true, text };
}

function buildSchedulePrompt(params: GenerateScheduleRequest): string {
  const { date, invokedAt, calendarEvents, tasks, templates, timeZone } = params;

  return `あなたは個人のデイリースケジュール調整アシスタントです。
登録日 ${date} のデイリータスクを、既存予定とテンプレートに基づいてスケジュールしてください。

## 重要ルール

1. テンプレートの \`condition\` を登録日・曜日で評価し、該当するタスクのみ登録する
2. \`startTime\` は **他の予定・タスクがない場合のデフォルト配置時刻（目安）** である
3. 当日に既存の Calendar 予定や Todo がある場合、衝突を避け **空き時間にずらして** 配置する
4. \`endTime\` が相対指定（例: 開始から40分後）の場合、開始がずれても相対関係を維持する
5. 曜日分岐（例: 月曜は6:30, それ以外は7:30）は登録日からデフォルト時刻を決定してから、ずらしルールを適用
6. 親タスクの \`children\` は親の時間枠内で順序どおりに配置する
7. \`defaultComplete: true\` のタスクは status を completed にする
8. ずらした場合は summary に理由を記載する
9. 時刻は ISO 8601 形式（タイムゾーン: ${timeZone}）で返す

## コンテキスト

- アプリ起動時刻: ${invokedAt}
- 登録日: ${date}

## 既存 Calendar 予定

${JSON.stringify(calendarEvents, null, 2)}

## 既存 Todo

${JSON.stringify(tasks, null, 2)}

## デイリータスクテンプレート

${JSON.stringify(templates, null, 2)}

## 出力形式

以下の JSON のみを返してください（マークダウン不要）:

{
  "date": "${date}",
  "items": [
    {
      "title": "タスク名",
      "detail": "詳細（任意）",
      "startTime": "ISO8601（任意）",
      "endTime": "ISO8601（任意）",
      "source": "daily",
      "category": "DailyTask",
      "parentName": "親タスク名（任意）",
      "status": "needsAction",
      "defaultComplete": false
    }
  ],
  "summary": "調整内容の説明",
  "taskSchedules": [
    {
      "title": "既存Todoのタイトル（tasks に含まれるもの）",
      "startTime": "ISO8601（任意）",
      "endTime": "ISO8601（任意）"
    }
  ]
}

既存の calendar / task は items に含めず、新規 daily タスクのみ返してください。
taskSchedules には、## 既存 Todo に列挙された各タスクの実行時刻を割り当てて返してください（時刻が不明な場合は startTime/endTime を省略可）。
時間枠のない子タスクは startTime/endTime 省略可。親タスク（AM-HK, PM-HK 等）は時間枠を持たせてください。`;
}

function parseGeneratedSchedule(text: string): GeneratedSchedule {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('JSON が見つかりません');
  }

  const parsed: unknown = JSON.parse(jsonMatch[0]);
  if (!isRecord(parsed) || typeof parsed.date !== 'string' || !Array.isArray(parsed.items)) {
    throw new Error('スキーマが不正です');
  }

  return {
    date: parsed.date,
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    items: parsed.items
      .filter((item): item is Record<string, unknown> => isRecord(item))
      .filter((item) => item.source !== 'calendar' && item.source !== 'task')
      .map((item) => validateGeneratedScheduleItem({ ...item, source: 'daily' })),
    taskSchedules: Array.isArray(parsed.taskSchedules)
      ? parsed.taskSchedules
          .filter((item): item is Record<string, unknown> => isRecord(item))
          .map(validateTaskSchedule)
      : undefined,
  };
}

function validateTaskSchedule(value: Record<string, unknown>): TaskSchedule {
  const title = value.title;
  if (typeof title !== 'string' || !title.trim()) {
    throw new Error('taskSchedules の title が不正です');
  }
  return {
    title,
    startTime: optionalString(value.startTime),
    endTime: optionalString(value.endTime),
  };
}

function validateGeneratedScheduleItem(value: unknown): ScheduleItem {
  const item = validateScheduleItem(value);
  if (item.source !== 'daily') {
    throw new Error('生成結果に daily 以外の予定が含まれています');
  }
  return item;
}

async function resolveSession(request: Request, env: Env): Promise<ResolvedSession> {
  const cookieValue = parseCookies(request.headers.get('Cookie') ?? '')[SESSION_COOKIE_NAME];
  if (!cookieValue) {
    return { sessionId: null, session: null, clearCookie: false };
  }

  const sessionId = await verifySessionCookie(cookieValue, env);
  if (!sessionId) {
    return { sessionId: null, session: null, clearCookie: true };
  }

  const stored = await getSession(env, sessionId);
  if (!stored) {
    return { sessionId: null, session: null, clearCookie: true };
  }

  const session = await decryptSessionRecord(stored, env);
  const now = Date.now();
  if (now - session.createdAt > SESSION_MAX_AGE_MS) {
    await deleteSession(env, sessionId);
    return { sessionId: null, session: null, clearCookie: true };
  }

  if (now < session.expiresAt - ACCESS_TOKEN_SKEW_MS) {
    return { sessionId, session };
  }

  if (!session.refreshToken) {
    await deleteSession(env, sessionId);
    return { sessionId: null, session: null, clearCookie: true };
  }

  try {
    const refreshed = await refreshAccessToken(env, session.refreshToken);
    const nextSession: SessionRecord = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? session.refreshToken,
      expiresAt: refreshed.expiresAt,
      createdAt: session.createdAt,
      updatedAt: now,
    };
    await putSession(env, sessionId, nextSession);
    return { sessionId, session: nextSession };
  } catch {
    await deleteSession(env, sessionId);
    return { sessionId: null, session: null, clearCookie: true };
  }
}

async function exchangeAuthorizationCode(
  request: Request,
  env: Env,
  code: string,
  codeVerifier: string,
): Promise<{ accessToken: string; refreshToken?: string; expiresAt: number }> {
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: getCallbackUrl(request),
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${await response.text()}`);
  }

  const data = await response.json<OAuthTokenResponse>();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

async function refreshAccessToken(
  env: Env,
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken?: string; expiresAt: number }> {
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${await response.text()}`);
  }

  const data = await response.json<OAuthTokenResponse>();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

async function revokeToken(token: string): Promise<void> {
  await fetch(GOOGLE_REVOKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  }).catch(() => {});
}

function getCallbackUrl(request: Request): string {
  return new URL('/api/google/callback', request.url).toString();
}

function sanitizeReturnTo(returnTo: string | null, env: Env): string {
  const fallback = getDefaultAppUrl(env);
  if (!returnTo) {
    return fallback;
  }

  try {
    const url = new URL(returnTo);
    const allowedOrigins = getAllowedOrigins(env);
    if (!allowedOrigins.includes(url.origin)) {
      return fallback;
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      return fallback;
    }
    return url.toString();
  } catch {
    return fallback;
  }
}

function getAllowedOrigins(env: Env): string[] {
  return (env.APP_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function getDefaultAppUrl(env: Env): string {
  return getAllowedOrigins(env)[0] ?? 'http://localhost:5173/';
}

function buildCorsHeaders(request: Request, env: Env): HeadersInit {
  const headers = new Headers({
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    Vary: 'Origin',
  });

  const origin = request.headers.get('Origin');
  if (origin && getAllowedOrigins(env).includes(origin.replace(/\/$/, ''))) {
    headers.set('Access-Control-Allow-Origin', origin);
  }

  return headers;
}

function jsonResponse(
  data: unknown,
  request: Request,
  env: Env,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const corsHeaders = new Headers(buildCorsHeaders(request, env));
  corsHeaders.forEach((value, key) => {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  });
  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function getErrorStatus(error: unknown): number {
  return error instanceof HttpError ? error.status : 500;
}

function getPublicErrorMessage(error: unknown): string {
  if (error instanceof HttpError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return '処理に失敗しました';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function isScheduleSource(value: unknown): value is ScheduleItem['source'] {
  return value === 'calendar' || value === 'task' || value === 'daily';
}

function isTaskStatus(value: unknown): value is NonNullable<ScheduleItem['status']> {
  return value === 'needsAction' || value === 'completed';
}

async function buildSessionCookie(request: Request, env: Env, sessionId: string): Promise<string> {
  const signedValue = await signSessionId(sessionId, env);
  return buildCookieString(request, signedValue, SESSION_MAX_AGE_MS / 1000);
}

function clearSessionCookie(request: Request): string {
  return buildCookieString(request, '', 0);
}

function buildCookieString(request: Request, value: string, maxAgeSeconds: number): string {
  const hostname = new URL(request.url).hostname;
  const secure = !isLocalHostname(hostname);
  const sameSite = secure ? 'None' : 'Lax';
  const parts = [
    `${SESSION_COOKIE_NAME}=${value}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
    `SameSite=${sameSite}`,
  ];
  if (secure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

async function signSessionId(sessionId: string, env: Env): Promise<string> {
  const signature = await signValue(sessionId, env.SESSION_SECRET);
  return `${sessionId}.${signature}`;
}

async function verifySessionCookie(value: string, env: Env): Promise<string | null> {
  const [sessionId, signature] = value.split('.');
  if (!sessionId || !signature) {
    return null;
  }
  const expected = await signValue(sessionId, env.SESSION_SECRET);
  return constantTimeEqual(expected, signature) ? sessionId : null;
}

async function signValue(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

async function generatePkce(): Promise<{ verifier: string; challenge: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = base64UrlEncode(bytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(new Uint8Array(digest));
  return { verifier, challenge };
}

function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < aBytes.length; index++) {
    difference |= aBytes[index] ^ bBytes[index];
  }
  return difference === 0;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function encryptString(value: string, secret: string): Promise<EncryptedValue> {
  const key = await getEncryptionKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(value),
  );
  return {
    iv: base64UrlEncode(iv),
    ciphertext: base64UrlEncode(new Uint8Array(ciphertext)),
  };
}

async function decryptString(value: EncryptedValue, secret: string): Promise<string> {
  const key = await getEncryptionKey(secret);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64UrlDecode(value.iv) },
    key,
    base64UrlDecode(value.ciphertext),
  );
  return new TextDecoder().decode(plaintext);
}

async function getEncryptionKey(secret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', material, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptSessionRecord(session: SessionRecord, env: Env): Promise<StoredSessionRecord> {
  return {
    accessToken: await encryptString(session.accessToken, env.TOKEN_ENCRYPTION_KEY),
    refreshToken: session.refreshToken
      ? await encryptString(session.refreshToken, env.TOKEN_ENCRYPTION_KEY)
      : undefined,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

async function decryptSessionRecord(session: StoredSessionRecord, env: Env): Promise<SessionRecord> {
  return {
    accessToken: await decryptString(session.accessToken, env.TOKEN_ENCRYPTION_KEY),
    refreshToken: session.refreshToken
      ? await decryptString(session.refreshToken, env.TOKEN_ENCRYPTION_KEY)
      : undefined,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

function parseCookies(cookieHeader: string): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf('=');
        if (separatorIndex === -1) {
          return [part, ''];
        }
        return [part.slice(0, separatorIndex), part.slice(separatorIndex + 1)];
      }),
  );
}

async function redirectWithAuthError(
  request: Request,
  returnTo: string,
  authError: string,
): Promise<Response> {
  const url = new URL(returnTo);
  url.searchParams.set('authError', authError);
  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      'Set-Cookie': clearSessionCookie(request),
    },
  });
}

function getStoreStub(env: Env): DurableObjectStub {
  return env.AUTH_STORE.get(env.AUTH_STORE.idFromName('schedule-assistant-auth-store'));
}

async function putTransaction(env: Env, state: string, transaction: AuthTransaction): Promise<void> {
  const stub = getStoreStub(env);
  await stub.fetch(`https://store/transactions/${state}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transaction),
  });
}

async function getTransaction(env: Env, state: string): Promise<AuthTransaction | null> {
  const stub = getStoreStub(env);
  const response = await stub.fetch(`https://store/transactions/${state}`);
  if (response.status === 404) {
    return null;
  }
  return response.json<AuthTransaction>();
}

async function deleteTransaction(env: Env, state: string): Promise<void> {
  const stub = getStoreStub(env);
  await stub.fetch(`https://store/transactions/${state}`, { method: 'DELETE' });
}

async function putSession(env: Env, sessionId: string, session: SessionRecord): Promise<void> {
  const stub = getStoreStub(env);
  const stored = await encryptSessionRecord(session, env);
  await stub.fetch(`https://store/sessions/${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stored),
  });
}

async function getSession(env: Env, sessionId: string): Promise<StoredSessionRecord | null> {
  const stub = getStoreStub(env);
  const response = await stub.fetch(`https://store/sessions/${sessionId}`);
  if (response.status === 404) {
    return null;
  }
  return response.json<StoredSessionRecord>();
}

async function deleteSession(env: Env, sessionId: string): Promise<void> {
  const stub = getStoreStub(env);
  await stub.fetch(`https://store/sessions/${sessionId}`, { method: 'DELETE' });
}

export class AuthStore {
  constructor(private readonly ctx: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean);
    const [collection, id] = segments;

    if (!collection || !id) {
      return new Response('Not found', { status: 404 });
    }

    const key = `${collection}:${id}`;

    if (request.method === 'GET') {
      const value = await this.ctx.storage.get<StoredSessionRecord | AuthTransaction>(key);
      if (!value) {
        return new Response('Not found', { status: 404 });
      }
      return Response.json(value);
    }

    if (request.method === 'POST') {
      const value = await request.json<StoredSessionRecord | AuthTransaction>();
      await this.ctx.storage.put(key, value);
      return new Response(null, { status: 204 });
    }

    if (request.method === 'DELETE') {
      await this.ctx.storage.delete(key);
      return new Response(null, { status: 204 });
    }

    return new Response('Method not allowed', { status: 405 });
  }
}
