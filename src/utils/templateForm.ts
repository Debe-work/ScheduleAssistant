import type { DailyTaskTemplate } from '../types';

export type ParentOptionalKey =
  | 'condition'
  | 'category'
  | 'detail'
  | 'startTime'
  | 'endTime'
  | 'defaultComplete'
  | 'children';

export type ChildOptionalKey =
  | 'condition'
  | 'detail'
  | 'startTime'
  | 'endTime'
  | 'defaultComplete';

type FieldMeta<K extends string> = {
  key: K;
  label: string;
  description: string;
  inputType: 'text' | 'boolean';
};

export const PARENT_OPTIONAL_FIELDS: FieldMeta<ParentOptionalKey>[] = [
  {
    key: 'condition',
    label: '登録条件',
    description: 'この条件に合致しない場合はタスクを登録しません。省略時は常に登録します。',
    inputType: 'text',
  },
  {
    key: 'category',
    label: 'カテゴリ',
    description: 'Google Todo に登録するリスト名です。',
    inputType: 'text',
  },
  {
    key: 'detail',
    label: '詳細',
    description: 'タスクの詳細内容です。そのまま登録されます。',
    inputType: 'text',
  },
  {
    key: 'startTime',
    label: '開始時間',
    description: '開始時間の目安です（例: 6:30、アプリを呼び出した時刻）。',
    inputType: 'text',
  },
  {
    key: 'endTime',
    label: '終了時間',
    description: '終了時間の目安です（例: 開始時間から40分後）。',
    inputType: 'text',
  },
  {
    key: 'defaultComplete',
    label: '登録時に完了',
    description: 'true の場合、登録時点でステータスを完了にします。',
    inputType: 'boolean',
  },
  {
    key: 'children',
    label: '子タスク',
    description: '親タスク配下の子タスク一覧です。',
    inputType: 'text',
  },
];

export const CHILD_OPTIONAL_FIELDS: FieldMeta<ChildOptionalKey>[] = [
  {
    key: 'condition',
    label: '登録条件',
    description: 'この条件に合致しない場合は子タスクを登録しません。',
    inputType: 'text',
  },
  {
    key: 'detail',
    label: '詳細',
    description: '子タスクの詳細内容です。',
    inputType: 'text',
  },
  {
    key: 'startTime',
    label: '開始時間',
    description: '子タスクの開始時間の目安です。',
    inputType: 'text',
  },
  {
    key: 'endTime',
    label: '終了時間',
    description: '子タスクの終了時間の目安です。',
    inputType: 'text',
  },
  {
    key: 'defaultComplete',
    label: '登録時に完了',
    description: 'true の場合、登録時点でステータスを完了にします。',
    inputType: 'boolean',
  },
];

export type ChildTaskForm = {
  name: string;
  activeFields: ChildOptionalKey[];
  condition: string;
  detail: string;
  startTime: string;
  endTime: string;
  defaultComplete: boolean;
};

export type ParentTaskForm = {
  name: string;
  activeFields: ParentOptionalKey[];
  condition: string;
  category: string;
  detail: string;
  startTime: string;
  endTime: string;
  defaultComplete: boolean;
  children: ChildTaskForm[];
};

export function createEmptyChildTask(): ChildTaskForm {
  return {
    name: '',
    activeFields: [],
    condition: '',
    detail: '',
    startTime: '',
    endTime: '',
    defaultComplete: false,
  };
}

export function createEmptyParentTask(): ParentTaskForm {
  return {
    name: '',
    activeFields: [],
    condition: '',
    category: '',
    detail: '',
    startTime: '',
    endTime: '',
    defaultComplete: false,
    children: [],
  };
}

function parentActiveFieldsFromTemplate(task: DailyTaskTemplate): ParentOptionalKey[] {
  const active: ParentOptionalKey[] = [];
  if (task.condition !== undefined) active.push('condition');
  if (task.category !== undefined) active.push('category');
  if (task.detail !== undefined) active.push('detail');
  if (task.startTime !== undefined) active.push('startTime');
  if (task.endTime !== undefined) active.push('endTime');
  if (task.defaultComplete !== undefined) active.push('defaultComplete');
  if (task.children && task.children.length > 0) active.push('children');
  return active;
}

function childActiveFieldsFromTemplate(
  child: Omit<DailyTaskTemplate, 'category' | 'children'>,
): ChildOptionalKey[] {
  const active: ChildOptionalKey[] = [];
  if (child.condition !== undefined) active.push('condition');
  if (child.detail !== undefined) active.push('detail');
  if (child.startTime !== undefined) active.push('startTime');
  if (child.endTime !== undefined) active.push('endTime');
  if (child.defaultComplete !== undefined) active.push('defaultComplete');
  return active;
}

export function templateToForm(tasks: DailyTaskTemplate[]): ParentTaskForm[] {
  return tasks.map((task) => ({
    name: task.name,
    activeFields: parentActiveFieldsFromTemplate(task),
    condition: task.condition ?? '',
    category: task.category ?? '',
    detail: task.detail ?? '',
    startTime: task.startTime ?? '',
    endTime: task.endTime ?? '',
    defaultComplete: task.defaultComplete ?? false,
    children: (task.children ?? []).map((child) => ({
      name: child.name,
      activeFields: childActiveFieldsFromTemplate(child),
      condition: child.condition ?? '',
      detail: child.detail ?? '',
      startTime: child.startTime ?? '',
      endTime: child.endTime ?? '',
      defaultComplete: child.defaultComplete ?? false,
    })),
  }));
}

function buildChildTask(form: ChildTaskForm): Omit<DailyTaskTemplate, 'category' | 'children'> {
  const child: Omit<DailyTaskTemplate, 'category' | 'children'> = { name: form.name.trim() };
  if (form.activeFields.includes('condition') && form.condition.trim()) {
    child.condition = form.condition.trim();
  }
  if (form.activeFields.includes('detail') && form.detail.trim()) {
    child.detail = form.detail.trim();
  }
  if (form.activeFields.includes('startTime') && form.startTime.trim()) {
    child.startTime = form.startTime.trim();
  }
  if (form.activeFields.includes('endTime') && form.endTime.trim()) {
    child.endTime = form.endTime.trim();
  }
  if (form.activeFields.includes('defaultComplete') && form.defaultComplete) {
    child.defaultComplete = true;
  }
  return child;
}

function buildParentTask(form: ParentTaskForm): DailyTaskTemplate {
  const task: DailyTaskTemplate = { name: form.name.trim() };
  if (form.activeFields.includes('condition') && form.condition.trim()) {
    task.condition = form.condition.trim();
  }
  if (form.activeFields.includes('category') && form.category.trim()) {
    task.category = form.category.trim();
  }
  if (form.activeFields.includes('detail') && form.detail.trim()) {
    task.detail = form.detail.trim();
  }
  if (form.activeFields.includes('startTime') && form.startTime.trim()) {
    task.startTime = form.startTime.trim();
  }
  if (form.activeFields.includes('endTime') && form.endTime.trim()) {
    task.endTime = form.endTime.trim();
  }
  if (form.activeFields.includes('defaultComplete') && form.defaultComplete) {
    task.defaultComplete = true;
  }
  if (form.activeFields.includes('children') && form.children.length > 0) {
    task.children = form.children.map(buildChildTask);
  }
  return task;
}

export function formToTemplate(forms: ParentTaskForm[]): DailyTaskTemplate[] {
  return forms.map(buildParentTask);
}

export function validateTemplateForm(forms: ParentTaskForm[]): string | null {
  for (const [index, task] of forms.entries()) {
    if (!task.name.trim()) {
      return `タスク ${index + 1} の名前を入力してください`;
    }

    if (task.activeFields.includes('children')) {
      for (const [childIndex, child] of task.children.entries()) {
        if (!child.name.trim()) {
          return `タスク「${task.name || index + 1}」の子タスク ${childIndex + 1} の名前を入力してください`;
        }
      }
    }
  }

  return null;
}
