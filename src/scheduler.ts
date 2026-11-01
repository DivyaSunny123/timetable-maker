import { DAYS, TIME_SLOTS, type Course, type Day, type ScheduleResult, type TimetableEntry } from './types';

const slotIndex = (time: string) => TIME_SLOTS.indexOf(time as (typeof TIME_SLOTS)[number]);

export function findConflicts(entries: TimetableEntry[], courses: Course[]): Set<string> {
  const byId = new Map(courses.map((course) => [course.id, course]));
  const conflicts = new Set<string>();

  for (let i = 0; i < entries.length; i += 1) {
    const first = entries[i];
    const firstCourse = byId.get(first.courseId);
    if (!firstCourse) {
      conflicts.add(first.id);
      continue;
    }

    for (let j = i + 1; j < entries.length; j += 1) {
      const second = entries[j];
      if (first.day !== second.day) continue;
      const secondCourse = byId.get(second.courseId);
      if (!secondCourse) {
        conflicts.add(second.id);
        continue;
      }

      const firstStart = slotIndex(first.startTime);
      const secondStart = slotIndex(second.startTime);
      const overlaps = firstStart < secondStart + second.durationHours && secondStart < firstStart + first.durationHours;
      if (!overlaps) continue;

      if (
        firstCourse.faculty === secondCourse.faculty ||
        firstCourse.room === secondCourse.room ||
        firstCourse.batch === secondCourse.batch
      ) {
        conflicts.add(first.id);
        conflicts.add(second.id);
      }
    }
  }

  return conflicts;
}

export function isValidSchedule(entries: TimetableEntry[], courses: Course[]): boolean {
  if (findConflicts(entries, courses).size > 0) return false;
  const coursesById = new Map(courses.map((course) => [course.id, course]));
  const hoursByCourse = new Map<string, number>();
  const facultyDailyHours = new Map<string, number>();

  for (const entry of entries) {
    const course = coursesById.get(entry.courseId);
    const start = slotIndex(entry.startTime);
    if (!course || start < 0 || !DAYS.includes(entry.day) || entry.durationHours < 1 || start + entry.durationHours > TIME_SLOTS.length) return false;
    if (!course.availability.includes(entry.day)) return false;
    if (course.isLab && !course.room.toLowerCase().includes('lab')) return false;
    hoursByCourse.set(course.id, (hoursByCourse.get(course.id) ?? 0) + entry.durationHours);
    const facultyKey = `${course.faculty}:${entry.day}`;
    facultyDailyHours.set(facultyKey, (facultyDailyHours.get(facultyKey) ?? 0) + entry.durationHours);
    if ((facultyDailyHours.get(facultyKey) ?? 0) > 5) return false;
  }

  return courses.every((course) => hoursByCourse.get(course.id) === course.weeklyHours);
}

export function generateSchedule(courses: Course[]): ScheduleResult {
  const entries: TimetableEntry[] = [];
  const unscheduled: string[] = [];
  const facultyDailyHours = new Map<string, number>();
  const orderedCourses = [...courses].sort((a, b) => Number(b.isLab) - Number(a.isLab) || b.weeklyHours - a.weeklyHours);
  let sequence = 0;

  for (const course of orderedCourses) {
    if (course.weeklyHours < 1 || !Number.isInteger(course.weeklyHours)) {
      unscheduled.push(`${course.code}: weekly hours must be a positive whole number.`);
      continue;
    }
    if (course.isLab && !course.room.toLowerCase().includes('lab')) {
      unscheduled.push(`${course.code}: assign a laboratory room before scheduling.`);
      continue;
    }

    let remaining = course.weeklyHours;
    while (remaining > 0) {
      const durationHours = course.isLab && remaining >= 2 ? 2 : 1;
      const candidates: Array<{ day: Day; startTime: string; score: number }> = [];
      const occupied = (day: Day, startIndex: number) => entries.some((entry) => {
        if (entry.day !== day) return false;
        const otherCourse = courses.find((item) => item.id === entry.courseId);
        const otherStart = slotIndex(entry.startTime);
        const overlap = startIndex < otherStart + entry.durationHours && otherStart < startIndex + durationHours;
        return overlap && otherCourse !== undefined && (
          otherCourse.faculty === course.faculty ||
          otherCourse.room === course.room ||
          otherCourse.batch === course.batch
        );
      });

      for (const day of course.availability) {
        for (let start = 0; start <= TIME_SLOTS.length - durationHours; start += 1) {
          if (occupied(day, start)) continue;
          const dailyKey = `${course.faculty}:${day}`;
          const dailyHours = facultyDailyHours.get(dailyKey) ?? 0;
          if (dailyHours + durationHours > 5) continue;

          const sameCourseDay = entries.filter((entry) => entry.courseId === course.id && entry.day === day).length;
          const score = dailyHours * 3 + sameCourseDay * 2 + start * 0.1 + (start === 4 ? 1 : 0);
          candidates.push({ day, startTime: TIME_SLOTS[start], score });
        }
      }

      candidates.sort((a, b) => a.score - b.score || DAYS.indexOf(a.day) - DAYS.indexOf(b.day));
      const best = candidates[0];
      if (!best) {
        unscheduled.push(`${course.code}: ${remaining} hour${remaining === 1 ? '' : 's'} could not be placed without a conflict.`);
        break;
      }

      entries.push({
        id: `entry-${sequence++}`,
        courseId: course.id,
        day: best.day,
        startTime: best.startTime,
        durationHours,
      });
      const dailyKey = `${course.faculty}:${best.day}`;
      facultyDailyHours.set(dailyKey, (facultyDailyHours.get(dailyKey) ?? 0) + durationHours);
      remaining -= durationHours;
    }
  }

  return { entries, unscheduled };
}
