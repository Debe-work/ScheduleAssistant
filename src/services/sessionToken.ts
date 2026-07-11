const SESSION_STORAGE_KEY = 'sa_session_v1';
export const SESSION_QUERY_PARAM = 'sa_session';

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, token);
  } catch {
    // private mode / quota
  }
}

export function clearSessionToken(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Capture OAuth redirect token before it can leak via history/share. */
export function captureSessionTokenFromUrl(): void {
  const url = new URL(window.location.href);
  const token = url.searchParams.get(SESSION_QUERY_PARAM);
  if (!token) {
    return;
  }

  setSessionToken(token);
  url.searchParams.delete(SESSION_QUERY_PARAM);
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}
