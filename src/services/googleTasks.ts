import { getAccessToken } from './googleAuth';
import { formatGoogleApiError, readGoogleApiError } from './googleApiError';
import type { GoogleTaskList, ScheduleItem } from '../types';
import { formatLocalDateString } from '../utils/date';
import { isoToLocalTime, localTimeToIso } from '../utils/time';

const TIME_PREFIX_RE = /^\[SA:(\d{2}:\d{2})(?:-(\d{2}:\d{2}))?\]\n?/;
const DATE_ONLY_DUE_RE = /^(\d{4}-\d{2}-\d{2})T00:00:00(\.000)?Z?$/;

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
  if (!res.ok) {
    const detail = await readGoogleApiError(res);
    throw new Error(formatGoogleApiError('Google Tasks API', res.status, detail));
  }
  const data = await res.json();
  return (data.items ?? []).map((l: { id: string; title: string }) => ({
    id: l.id,
    title: l.title,
  }));
}

async function getTaskListId(category?: string, listId?: string): Promise<string> {
  if (listId) return listId;
  const lists = await fetchTaskLists();
  if (category) {
    const match = lists.find((l) => l.title === category);
    if (match) return match.id;
  }
  return lists[0]?.id ?? '@default';
}

function dueOnLocalDate(due: string, date: string): boolean {
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return false;
  return formatLocalDateString(d) === date;
}

export function parseTaskTimeFromNotes(
  notes: string | undefined,
  date: string,
): { detail?: string; startTime?: string; endTime?: string } {
  if (!notes) return {};
  const match = notes.match(TIME_PREFIX_RE);
  if (!match) return { detail: notes || undefined };

  const [, start, end] = match;
  const detail = notes.replace(TIME_PREFIX_RE, '') || undefined;
  return {
    detail,
    startTime: localTimeToIso(date, start),
    endTime: end ? localTimeToIso(date, end) : undefined,
  };
}

function parseDueAsStartTime(due: string, date: string): string | undefined {
  if (DATE_ONLY_DUE_RE.test(due)) return undefined;
  if (!dueOnLocalDate(due, date)) return undefined;
  return new Date(due).toISOString();
}

export function extractTaskSchedule(
  due: string | undefined,
  notes: string | undefined,
  date: string,
): { detail?: string; startTime?: string; endTime?: string } {
  const fromNotes = parseTaskTimeFromNotes(notes, date);
  const fromDue = due ? { startTime: parseDueAsStartTime(due, date) } : {};
  return {
    detail: fromNotes.detail,
    startTime: fromDue.startTime ?? fromNotes.startTime,
    endTime: fromNotes.endTime,
  };
}

function buildTaskDue(date: string): string {
  return `${date}T00:00:00.000Z`;
}

function buildTaskNotes(item: ScheduleItem): string | undefined {
  const detail = item.detail?.replace(TIME_PREFIX_RE, '').trim();
  if (item.startTime) {
    const start = isoToLocalTime(item.startTime);
    const end = item.endTime ? isoToLocalTime(item.endTime) : undefined;
    const prefix = end ? `[SA:${start}-${end}]` : `[SA:${start}]`;
    return detail ? `${prefix}\n${detail}` : prefix;
  }
  return detail || undefined;
}

function buildTaskBody(item: ScheduleItem, date: string): Record<string, string> {
  const body: Record<string, string> = {
    title: item.title,
    due: buildTaskDue(date),
  };
  const notes = buildTaskNotes(item);
  body.notes = notes ?? '';
  if (item.defaultComplete || item.status === 'completed') {
    body.status = 'completed';
  }
  return body;
}

function buildInsertPath(listId: string, parentId?: string, previousId?: string): string {
  const params = new URLSearchParams();
  if (parentId) params.set('parent', parentId);
  if (previousId) params.set('previous', previousId);
  const query = params.toString();
  return `/lists/${listId}/tasks${query ? `?${query}` : ''}`;
}

export async function fetchTasks(date: string): Promise<ScheduleItem[]> {
  const lists = await fetchTaskLists();
  const itemsByList = await Promise.all(lists.map(async (list) => {
    const res = await apiFetch(
      `/lists/${list.id}/tasks?showCompleted=true&showHidden=true`,
    );
    if (!res.ok) {
      const detail = await readGoogleApiError(res);
      throw new Error(formatGoogleApiError(`Google Tasks API (${list.title})`, res.status, detail));
    }
    const data = await res.json();
    return (data.items ?? []).flatMap((task: {
      id: string;
      title?: string;
      due?: string;
      notes?: string;
      status?: string;
    }) => {
      if (!task.due || !dueOnLocalDate(task.due, date)) return [];
      const parsed = extractTaskSchedule(task.due, task.notes, date);
      return [{
        id: task.id,
        listId: list.id,
        title: task.title ?? '(無題)',
        detail: parsed.detail,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        source: 'task',
        category: list.title,
        status: task.status === 'completed' ? 'completed' : 'needsAction',
      }];
    });
  }));

  return itemsByList.flat();
}

export async function createTask(
  item: ScheduleItem,
  date: string,
  parentId?: string,
  previousId?: string,
): Promise<string> {
  const listId = await getTaskListId(item.category, item.listId);
  const body = buildTaskBody(item, date);
  const path = buildInsertPath(listId, parentId, previousId);
  const res = await apiFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tasks 登録失敗 (${item.title}): ${err}`);
  }

  const created = await res.json();
  return created.id as string;
}

export async function updateTask(item: ScheduleItem, date: string): Promise<void> {
  if (!item.id) throw new Error(`Tasks 更新失敗: ID がありません (${item.title})`);
  const listId = await getTaskListId(item.category, item.listId);
  const body = buildTaskBody(item, date);
  const res = await apiFetch(`/lists/${listId}/tasks/${item.id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tasks 更新失敗 (${item.title}): ${err}`);
  }
}
