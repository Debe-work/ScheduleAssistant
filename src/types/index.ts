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
  title: string;
  detail?: string;
  startTime?: string;
  endTime?: string;
  source: 'calendar' | 'task' | 'daily';
  category?: string;
  parentName?: string;
  status?: 'needsAction' | 'completed';
  defaultComplete?: boolean;
};

export type GeneratedSchedule = {
  date: string;
  items: ScheduleItem[];
  summary: string;
};

export type TokenData = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
};

export type GoogleTaskList = {
  id: string;
  title: string;
};
