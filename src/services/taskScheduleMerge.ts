import type { GeneratedSchedule, ScheduleItem, TaskSchedule } from '../types';

export function applyTaskSchedules(
  tasks: ScheduleItem[],
  taskSchedules: TaskSchedule[] | undefined,
): ScheduleItem[] {
  if (!taskSchedules?.length) return tasks;

  const scheduleByTitle = new Map(taskSchedules.map((schedule) => [schedule.title, schedule]));

  return tasks.map((task) => {
    const scheduled = scheduleByTitle.get(task.title);
    if (!scheduled) return task;
    return {
      ...task,
      startTime: task.startTime ?? scheduled.startTime,
      endTime: task.endTime ?? scheduled.endTime,
    };
  });
}

export function mergeTaskSchedulesIntoDraft(
  tasks: ScheduleItem[],
  schedule: GeneratedSchedule,
): ScheduleItem[] {
  return applyTaskSchedules(tasks, schedule.taskSchedules);
}
