import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_GEMINI_MODEL } from '../../shared/geminiModels.ts';
import {
  clearStoredGeminiModel,
  loadStoredGeminiModel,
  saveGeminiModel,
} from './geminiModelStorage';

function createLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe('geminiModelStorage', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: createLocalStorageMock(),
      configurable: true,
    });
  });

  afterEach(() => {
    clearStoredGeminiModel();
  });

  it('returns default when nothing is stored', () => {
    expect(loadStoredGeminiModel()).toBe(DEFAULT_GEMINI_MODEL);
  });

  it('persists and loads a catalog model', () => {
    saveGeminiModel('gemini-2.5-flash');
    expect(loadStoredGeminiModel()).toBe('gemini-2.5-flash');
  });

  it('falls back to default for invalid stored values on read', () => {
    localStorage.setItem('gemini-model:v1', 'invalid-model');
    expect(loadStoredGeminiModel()).toBe(DEFAULT_GEMINI_MODEL);
  });

  it('stores resolved model ids only', () => {
    saveGeminiModel('invalid-model');
    expect(localStorage.getItem('gemini-model:v1')).toBe(DEFAULT_GEMINI_MODEL);
  });
});
