import { DAYS, TIME_SLOTS, type Course, type TimetableEntry } from './types';

const clock = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
const fileName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'timetable';

export async function exportPowerPoint(
  department: string,
  term: string,
  courses: Course[],
  entries: TimetableEntry[],
) {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = department;
  pptx.subject = `${department} weekly timetable`;
  pptx.title = `${department} timetable — ${term}`;
  pptx.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos' };

  const slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };
  slide.addText(department, { x: 0.55, y: 0.32, w: 9, h: 0.42, fontSize: 22, bold: true, color: '20283A' });
  slide.addText(`${term}  ·  Weekly timetable  ·  Generated ${new Date().toLocaleDateString()}`, {
    x: 0.55, y: 0.82, w: 12.2, h: 0.28, fontSize: 10, color: '727B8C',
  });

  const coursesById = new Map(courses.map((course) => [course.id, course]));
  const header = ['TIME', ...DAYS.map((day) => day.toUpperCase())].map((text) => ({ text, options: { bold: true, color: '475166', fill: { color: 'F1F3F6' } } }));
  const rows = TIME_SLOTS.map((time) => [
    { text: `${time}–${clock(Number(time.slice(0, 2)) + 1)}`, options: { bold: true, color: '657084', fill: { color: 'F8F9FB' } } },
    ...DAYS.map((day) => {
      const classes = entries
        .filter((entry) => entry.day === day && entry.startTime === time)
        .map((entry) => {
          const course = coursesById.get(entry.courseId);
          if (!course) return '';
          return `${entry.startTime}–${clock(Number(entry.startTime.slice(0, 2)) + entry.durationHours)}  ${course.code} · ${course.subject}\n${course.faculty}  ·  ${course.room}  ·  ${course.batch}`;
        })
        .filter(Boolean);
      return { text: classes.join('\n\n') || '—', options: { color: '343D4F', breakLine: false } };
    }),
  ]);
  slide.addTable([header, ...rows], {
    x: 0.55, y: 1.3, w: 12.2, h: 5.85,
    border: { type: 'solid', color: 'DFE3E9', pt: 0.7 },
    fill: { color: 'FFFFFF' },
    color: '343D4F',
    fontFace: 'Aptos',
    fontSize: 8,
    rowH: 0.68,
    margin: 0.09,
    colW: [1.12, 2.216, 2.216, 2.216, 2.216, 2.216],
    valign: 'middle',
  });

  await pptx.writeFile({ fileName: `${fileName(department)}-timetable.pptx` });
}
