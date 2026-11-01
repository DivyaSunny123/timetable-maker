import type { Course } from './types';
import { DAYS } from './types';

export const DEMO_COURSES: Course[] = [
  { id: 'c1', code: 'CS301', subject: 'Database Systems', faculty: 'Dr. Ananya Rao', room: 'Room 204', batch: 'B.Tech CSE · Sem 5', weeklyHours: 3, isLab: false, roomCapacity: 60, availability: [...DAYS] },
  { id: 'c2', code: 'CS302', subject: 'Computer Networks', faculty: 'Prof. Karan Mehta', room: 'Room 206', batch: 'B.Tech CSE · Sem 5', weeklyHours: 3, isLab: false, roomCapacity: 60, availability: [...DAYS] },
  { id: 'c3', code: 'CS303L', subject: 'Database Lab', faculty: 'Dr. Ananya Rao', room: 'CS Lab 1', batch: 'B.Tech CSE · Sem 5', weeklyHours: 2, isLab: true, roomCapacity: 30, availability: [...DAYS] },
  { id: 'c4', code: 'CS304', subject: 'Operating Systems', faculty: 'Dr. Vikram Shah', room: 'Room 204', batch: 'B.Tech CSE · Sem 5', weeklyHours: 4, isLab: false, roomCapacity: 60, availability: [...DAYS] },
  { id: 'c5', code: 'CS305', subject: 'Artificial Intelligence', faculty: 'Dr. Neha Kapoor', room: 'Room 208', batch: 'B.Tech CSE · Sem 5', weeklyHours: 3, isLab: false, roomCapacity: 60, availability: [...DAYS] },
  { id: 'c6', code: 'CS306L', subject: 'Networks Lab', faculty: 'Prof. Karan Mehta', room: 'CS Lab 2', batch: 'B.Tech CSE · Sem 5', weeklyHours: 2, isLab: true, roomCapacity: 30, availability: [...DAYS] },
  { id: 'c7', code: 'CS401', subject: 'Software Engineering', faculty: 'Dr. Vikram Shah', room: 'Room 206', batch: 'B.Tech CSE · Sem 7', weeklyHours: 3, isLab: false, roomCapacity: 60, availability: [...DAYS] },
  { id: 'c8', code: 'CS402', subject: 'Machine Learning', faculty: 'Dr. Neha Kapoor', room: 'Room 208', batch: 'B.Tech CSE · Sem 7', weeklyHours: 4, isLab: false, roomCapacity: 60, availability: [...DAYS] },
  { id: 'c9', code: 'CS403L', subject: 'ML Lab', faculty: 'Dr. Neha Kapoor', room: 'AI Lab', batch: 'B.Tech CSE · Sem 7', weeklyHours: 2, isLab: true, roomCapacity: 30, availability: [...DAYS] },
];
