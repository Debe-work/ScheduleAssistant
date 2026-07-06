import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearStoredTemplates,
  hasStoredTemplates,
  loadStoredTemplates,
  saveStoredTemplates,
} from './templateStorage';

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

describe('templateStorage', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: createLocalStorageMock(),
      configurable: true,
    });
  });

  afterEach(() => {
    clearStoredTemplates();
  });

  it('persists and loads templates', () => {
    const templates = [{ name: '起床', category: 'DailyTask' }];

    saveStoredTemplates(templates);

    expect(hasStoredTemplates()).toBe(true);
    expect(loadStoredTemplates()).toEqual(templates);
  });

  it('clears stored templates', () => {
    saveStoredTemplates([{ name: '起床' }]);
    clearStoredTemplates();

    expect(hasStoredTemplates()).toBe(false);
    expect(loadStoredTemplates()).toBeNull();
  });
});
