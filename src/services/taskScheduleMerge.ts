import type { GeneratedSchedule, ScheduleItem, TaskSchedule } from '../types';

export function applyTaskSchedules(
  tasks: ScheduleItem[],
  taskSchedules: TaskSchedule[] | undefined,
): ScheduleItem[] {
  if (!taskSchedules?.length) return tasks;

  return tasks.map((task) => {
    const scheduled = taskSchedules.find((s) => s.title === task.title);
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
