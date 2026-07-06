import { buildWorkerUrl, readWorkerError, workerFetch } from './workerClient';

type SessionResponse = {
  authenticated: boolean;
  expiresAt: number | null;
};

type AccessTokenResponse = {
  accessToken: string;
  expiresAt: number;
};

let accessTokenCache: AccessTokenResponse | null = null;

function clearAccessTokenCache(): void {
  accessTokenCache = null;
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
    throw new Error(await readWorkerError(res, '認証 API エラー'));
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
    throw new Error(await readWorkerError(res, '認証 API エラー'));
  }

  const data = await res.json() as SessionResponse;
  return data.authenticated;
}

export async function logout(): Promise<void> {
  clearAccessTokenCache();
  const res = await workerFetch('/api/google/logout', { method: 'POST' });
  if (!res.ok) {
    throw new Error(await readWorkerError(res, '認証 API エラー'));
  }
}
