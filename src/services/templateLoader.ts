import yaml from 'js-yaml';
import type { DailyTaskTemplate } from '../types';

export interface TemplateSource {
  load(): Promise<string>;
}

export class LocalTemplateSource implements TemplateSource {
  async load(): Promise<string> {
    const res = await fetch(`${import.meta.env.BASE_URL}templates/daily-tasks.md`);
    if (!res.ok) throw new Error('テンプレートの読み込みに失敗しました');
    return res.text();
  }
}

export function extractYamlFromMarkdown(markdown: string): string {
  const match = markdown.match(/```ya?ml\n([\s\S]*?)```/);
  if (!match) throw new Error('テンプレートに YAML ブロックが見つかりません');
  return match[1];
}

export function parseTemplate(yamlText: string): DailyTaskTemplate[] {
  const parsed = yaml.load(yamlText) as { tasks?: DailyTaskTemplate[] };
  if (!parsed?.tasks) throw new Error('テンプレート形式が不正です');
  return parsed.tasks;
}

export async function loadTemplates(source?: TemplateSource): Promise<DailyTaskTemplate[]> {
  const src = source ?? new LocalTemplateSource();
  const markdown = await src.load();
  const yamlText = extractYamlFromMarkdown(markdown);
  return parseTemplate(yamlText);
}
