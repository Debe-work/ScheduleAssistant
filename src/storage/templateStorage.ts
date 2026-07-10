import type { DailyTaskTemplate } from '../types';

const KEY = 'daily-task-templates:v1';

export function loadStoredTemplates(): DailyTaskTemplate[] | null {
  const raw = getLocalItem(KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isDailyTaskTemplateArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredTemplates(templates: DailyTaskTemplate[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(templates));
  } catch {
    // localStorage can be unavailable or quota-limited.
  }
}

export function clearStoredTemplates(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore storage cleanup failures
  }
}

export function hasStoredTemplates(): boolean {
  return loadStoredTemplates() !== null;
}

function isDailyTaskTemplateArray(value: unknown): value is DailyTaskTemplate[] {
  if (!Array.isArray(value)) return false;
  return value.every(isDailyTaskTemplate);
}

function isDailyTaskTemplate(value: unknown): value is DailyTaskTemplate {
  if (!isRecord(value)) return false;
  if (typeof value.name !== 'string') return false;

  const optionalStringKeys = ['condition', 'category', 'detail', 'startTime', 'endTime'] as const;
  for (const key of optionalStringKeys) {
    if (value[key] !== undefined && typeof value[key] !== 'string') return false;
  }

  if (value.defaultComplete !== undefined && typeof value.defaultComplete !== 'boolean') {
    return false;
  }

  if (value.children !== undefined) {
    if (!Array.isArray(value.children)) return false;
    for (const child of value.children) {
      if (!isRecord(child) || typeof child.name !== 'string') return false;
      if (child.category !== undefined || child.children !== undefined) return false;
    }
  }

  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getLocalItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
