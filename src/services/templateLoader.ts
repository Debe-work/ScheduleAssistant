import { loadStoredTemplates } from '../storage/templateStorage';
import type { DailyTaskTemplate } from '../types';

async function loadLocalTemplate(): Promise<string> {
  const res = await fetch(`${import.meta.env.BASE_URL}templates/daily-tasks.md`);
  if (!res.ok) throw new Error('テンプレートの読み込みに失敗しました');
  return res.text();
}

function extractYamlFromMarkdown(markdown: string): string {
  const match = markdown.match(/```ya?ml\n([\s\S]*?)```/);
  if (!match) throw new Error('テンプレートに YAML ブロックが見つかりません');
  return match[1];
}

async function parseTemplate(yamlText: string): Promise<DailyTaskTemplate[]> {
  const yaml = await import('js-yaml');
  const parsed = yaml.load(yamlText) as { tasks?: DailyTaskTemplate[] };
  if (!parsed?.tasks) throw new Error('テンプレート形式が不正です');
  return parsed.tasks;
}

export async function loadDefaultTemplates(): Promise<DailyTaskTemplate[]> {
  const markdown = await loadLocalTemplate();
  const yamlText = extractYamlFromMarkdown(markdown);
  return parseTemplate(yamlText);
}

export async function loadTemplates(): Promise<DailyTaskTemplate[]> {
  const stored = loadStoredTemplates();
  if (stored) return stored;
  return loadDefaultTemplates();
}
