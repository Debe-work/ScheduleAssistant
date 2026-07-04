import { saveTokens, getTokens, clearTokens } from '../storage/tokenStore';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/tasks',
].join(' ');

const PKCE_VERIFIER_KEY = 'oauth_pkce_verifier';

function getClientId(): string {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!id) throw new Error('VITE_GOOGLE_CLIENT_ID が設定されていません');
  return id;
}

function getRedirectUri(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/$/, '') + '/';
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generatePkce(): Promise<{ verifier: string; challenge: string }> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = base64UrlEncode(array.buffer);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(digest);
  return { verifier, challenge };
}

export async function startLogin(): Promise<void> {
  const { verifier, challenge } = await generatePkce();
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function handleOAuthCallback(code: string): Promise<void> {
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  if (!verifier) throw new Error('PKCE verifier が見つかりません');

  const body = new URLSearchParams({
    client_id: getClientId(),
    code,
    code_verifier: verifier,
    grant_type: 'authorization_code',
    redirect_uri: getRedirectUri(),
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`トークン取得失敗: ${err}`);
  }

  const data = await res.json();
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);

  await saveTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: getClientId(),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) throw new Error('トークン更新に失敗しました');

  const data = await res.json();
  const tokens = await getTokens();
  await saveTokens({
    accessToken: data.access_token,
    refreshToken: tokens?.refreshToken ?? refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  });
  return data.access_token;
}

export async function getAccessToken(): Promise<string | null> {
  const tokens = await getTokens();
  if (!tokens) return null;

  if (Date.now() < tokens.expiresAt - 60_000) {
    return tokens.accessToken;
  }

  if (tokens.refreshToken) {
    return refreshAccessToken(tokens.refreshToken);
  }

  return null;
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getAccessToken();
  return token !== null;
}

export async function logout(): Promise<void> {
  await clearTokens();
}

export function parseOAuthCallback(): string | null {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');
  if (error) throw new Error(`OAuth エラー: ${error}`);
  return code;
}

export function clearOAuthParams(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('scope');
  url.searchParams.delete('authuser');
  url.searchParams.delete('prompt');
  window.history.replaceState({}, '', url.pathname + url.search);
}
