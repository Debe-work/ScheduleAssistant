import { getSessionToken } from './sessionToken';

export function getWorkerBaseUrl(): string {
  return import.meta.env.VITE_WORKER_BASE_URL?.replace(/\/$/, '') ?? '';
}

export function buildWorkerUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getWorkerBaseUrl()}${normalizedPath}`;
}

export async function readWorkerError(res: Response, fallbackLabel: string): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.error === 'string') {
      return data.error;
    }
  } catch {
    // ignore JSON parse failure
  }
  return `${fallbackLabel}: ${res.status}`;
}

export async function workerFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.method && init.method !== 'GET' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const sessionToken = getSessionToken();
  if (sessionToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${sessionToken}`);
  }

  return fetch(buildWorkerUrl(path), {
    ...init,
    headers,
    credentials: 'include',
  });
}
