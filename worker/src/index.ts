const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
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

type ResolvedSession =
  | { sessionId: string; session: SessionRecord }
  | { sessionId: null; session: null; clearCookie: boolean };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/google/')) {
      return new Response(null, {
        status: 204,
        headers: buildCorsHeaders(request, env),
      });
    }

    try {
      if (request.method === 'GET' && url.pathname === '/api/google/health') {
        return jsonResponse({
          ok: true,
          hasClientId: Boolean(env.GOOGLE_CLIENT_ID),
          hasClientSecret: Boolean(env.GOOGLE_CLIENT_SECRET),
          hasAppOrigins: Boolean(env.APP_ORIGINS),
        }, request, env);
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

      return new Response('Not found', { status: 404 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      return jsonResponse({ error: message }, request, env, { status: 500 });
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
  return env.APP_ORIGINS
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
  return expected === signature ? sessionId : null;
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
