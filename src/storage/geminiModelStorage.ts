import { DEFAULT_GEMINI_MODEL, resolveGeminiModel } from '../../shared/geminiModels.ts';

const KEY = 'gemini-model:v1';

export function loadStoredGeminiModel(): string {
  const raw = getLocalItem(KEY);
  if (!raw) return DEFAULT_GEMINI_MODEL;
  return resolveGeminiModel(raw);
}

export function saveGeminiModel(modelId: string): void {
  try {
    localStorage.setItem(KEY, resolveGeminiModel(modelId));
  } catch {
    // localStorage can be unavailable or quota-limited.
  }
}

export function clearStoredGeminiModel(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore storage cleanup failures
  }
}

function getLocalItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
