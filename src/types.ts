export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
export type Day = (typeof DAYS)[number];

export interface Course {
  id: string;
  code: string;
  subject: string;
  faculty: string;
  room: string;
  batch: string;
  weeklyHours: number;
  isLab: boolean;
  roomCapacity: number;
  availability: Day[];
}

export interface TimetableEntry {
  id: string;
  courseId: string;
  day: Day;
  startTime: string;
  durationHours: number;
}

export interface ScheduleResult {
  entries: TimetableEntry[];
  unscheduled: string[];
}

export const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00',
] as const;
