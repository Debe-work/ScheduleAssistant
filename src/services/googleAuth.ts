type SessionResponse = {
  authenticated: boolean;
  expiresAt: number | null;
};

type AccessTokenResponse = {
  accessToken: string;
  expiresAt: number;
};

let accessTokenCache: AccessTokenResponse | null = null;

function getWorkerBaseUrl(): string {
  return import.meta.env.VITE_WORKER_BASE_URL?.replace(/\/$/, '') ?? '';
}

function buildWorkerUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getWorkerBaseUrl()}${normalizedPath}`;
}

function clearAccessTokenCache(): void {
  accessTokenCache = null;
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
  return `認証 API エラー: ${res.status}`;
}

async function workerFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.method && init.method !== 'GET' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(buildWorkerUrl(path), {
    ...init,
    headers,
    credentials: 'include',
  });
}

export async function startLogin(): Promise<void> {
  clearAccessTokenCache();
  const returnTo = new URL(window.location.href);
  returnTo.searchParams.delete('authError');
  const loginUrl = new URL(buildWorkerUrl('/api/google/login'), window.location.href);
  loginUrl.searchParams.set('returnTo', returnTo.toString());
  window.location.href = loginUrl.toString();
}

export async function getAccessToken(): Promise<string | null> {
  if (accessTokenCache && Date.now() < accessTokenCache.expiresAt - 60_000) {
    return accessTokenCache.accessToken;
  }

  const res = await workerFetch('/api/google/access-token');
  if (res.status === 401) {
    clearAccessTokenCache();
    return null;
  }
  if (!res.ok) {
    throw new Error(await readError(res));
  }

  const data = await res.json() as AccessTokenResponse;
  accessTokenCache = data;
  return data.accessToken;
}

export async function isAuthenticated(): Promise<boolean> {
  if (accessTokenCache && Date.now() < accessTokenCache.expiresAt - 60_000) {
    return true;
  }

  const res = await workerFetch('/api/google/session');
  if (!res.ok) {
    throw new Error(await readError(res));
  }

  const data = await res.json() as SessionResponse;
  return data.authenticated;
}

export async function logout(): Promise<void> {
  clearAccessTokenCache();
  const res = await workerFetch('/api/google/logout', { method: 'POST' });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
}
