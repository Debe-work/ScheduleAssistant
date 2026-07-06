export type DailyTaskTemplate = {
  name: string;
  condition?: string;
  category?: string;
  detail?: string;
  startTime?: string;
  endTime?: string;
  defaultComplete?: boolean;
  children?: Omit<DailyTaskTemplate, 'category' | 'children'>[];
};

export type ScheduleItem = {
  id?: string;
  listId?: string;
  title: string;
  detail?: string;
  startTime?: string;
  endTime?: string;
  source: 'calendar' | 'task' | 'daily';
  category?: string;
  parentName?: string;
  status?: 'needsAction' | 'completed';
  defaultComplete?: boolean;
  isAllDay?: boolean;
};

export type GeneratedSchedule = {
  date: string;
  items: ScheduleItem[];
  summary: string;
  taskSchedules?: TaskSchedule[];
};

export type TaskSchedule = {
  title: string;
  startTime?: string;
  endTime?: string;
};

export type GoogleTaskList = {
  id: string;
  title: string;
};
