import { getAccessToken } from './googleAuth';
import type { GoogleTaskList, ScheduleItem } from '../types';

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  if (!token) throw new Error('認証が必要です');
  return fetch(`https://www.googleapis.com/tasks/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

export async function fetchTaskLists(): Promise<GoogleTaskList[]> {
  const res = await apiFetch('/users/@me/lists');
  if (!res.ok) throw new Error(`Tasks API エラー: ${res.status}`);
  const data = await res.json();
  return (data.items ?? []).map((l: { id: string; title: string }) => ({
    id: l.id,
    title: l.title,
  }));
}

async function getTaskListId(category?: string): Promise<string> {
  const lists = await fetchTaskLists();
  if (category) {
    const match = lists.find((l) => l.title === category);
    if (match) return match.id;
  }
  return lists[0]?.id ?? '@default';
}

function isDueOnDate(due: string | undefined, date: string): boolean {
  if (!due) return false;
  return due.startsWith(date);
}

export async function fetchTasks(date: string): Promise<ScheduleItem[]> {
  const lists = await fetchTaskLists();
  const items: ScheduleItem[] = [];

  for (const list of lists) {
    const res = await apiFetch(
      `/lists/${list.id}/tasks?showCompleted=true&showHidden=true`,
    );
    if (!res.ok) continue;
    const data = await res.json();
    for (const task of data.items ?? []) {
      if (!task.due || !isDueOnDate(task.due, date)) continue;
      items.push({
        id: task.id,
        title: task.title ?? '(無題)',
        detail: task.notes,
        source: 'task',
        category: list.title,
        status: task.status === 'completed' ? 'completed' : 'needsAction',
      });
    }
  }

  return items;
}

export async function createTask(item: ScheduleItem, date: string): Promise<void> {
  const listId = await getTaskListId(item.category);
  const body: Record<string, string> = {
    title: item.title,
    due: `${date}T00:00:00.000Z`,
  };
  if (item.detail) body.notes = item.detail;
  if (item.defaultComplete || item.status === 'completed') {
    body.status = 'completed';
  }

  const res = await apiFetch(`/lists/${listId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tasks 登録失敗 (${item.title}): ${err}`);
  }
}

export async function taskExists(title: string, date: string): Promise<boolean> {
  const tasks = await fetchTasks(date);
  return tasks.some((t) => t.title === title);
}
