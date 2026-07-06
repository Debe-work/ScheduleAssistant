import { describe, expect, it } from 'vitest';
import {
  createEmptyParentTask,
  formToTemplate,
  templateToForm,
  validateTemplateForm,
  type ParentTaskForm,
} from './templateForm';
import type { DailyTaskTemplate } from '../types';

const sampleTemplates: DailyTaskTemplate[] = [
  {
    name: '起床',
    condition: '呼び出し当日のタスク登録時',
    category: 'DailyTask',
    defaultComplete: true,
    children: [
      { name: '洗顔', detail: '朝の洗顔' },
      { name: '完了タスク', defaultComplete: true },
    ],
  },
];

describe('templateForm', () => {
  it('round-trips templates through form state', () => {
    const forms = templateToForm(sampleTemplates);
    const restored = formToTemplate(forms);

    expect(restored).toEqual(sampleTemplates);
  });

  it('omits inactive optional fields', () => {
    const forms: ParentTaskForm[] = [
      {
        ...createEmptyParentTask(),
        name: 'テスト',
        activeFields: ['detail'],
        detail: '詳細のみ',
      },
    ];

    expect(formToTemplate(forms)).toEqual([{ name: 'テスト', detail: '詳細のみ' }]);
  });

  it('validates required names', () => {
    const forms = templateToForm(sampleTemplates);
    forms[0].name = '   ';

    expect(validateTemplateForm(forms)).toBe('タスク 1 の名前を入力してください');
  });
});
