import { DAYS, type Course, type Day } from './types';

const aliases: Record<keyof Omit<Course, 'id' | 'availability'>, string[]> = {
  code: ['code', 'course code', 'subject code', 'course id'],
  subject: ['subject', 'course', 'course name', 'subject name', 'title'],
  faculty: ['faculty', 'professor', 'instructor', 'teacher', 'lecturer'],
  room: ['room', 'classroom', 'venue', 'location'],
  batch: ['batch', 'class', 'section', 'semester', 'program'],
  weeklyHours: ['weekly hours', 'hours', 'hours per week', 'required hours', 'credits'],
  isLab: ['is lab', 'lab', 'laboratory', 'type'],
  roomCapacity: ['room capacity', 'capacity', 'seats'],
};

const clean = (value: unknown) => String(value ?? '').trim();
const headerKey = (value: unknown) => clean(value).replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ');

function dayList(value: unknown): Day[] {
  const source = clean(value).toLowerCase();
  if (!source) return [...DAYS];
  const matches = DAYS.filter((day) => source.includes(day.toLowerCase()) || source.includes(day.slice(0, 3).toLowerCase()));
  return matches.length ? matches : [...DAYS];
}

export function normalizeCourses(rows: Record<string, unknown>[]): Course[] {
  const normalized: Course[] = [];
  for (const [index, row] of rows.entries()) {
    const getValue = (field: keyof typeof aliases) => {
      const key = Object.keys(row).find((candidate) => aliases[field].includes(headerKey(candidate)));
      return key ? row[key] : undefined;
    };

    const subject = clean(getValue('subject'));
    const code = clean(getValue('code')) || `COURSE-${index + 1}`;
    if (!subject && !clean(getValue('faculty'))) continue;
    const labValue = clean(getValue('isLab')).toLowerCase();
    const room = clean(getValue('room')) || (labValue.includes('lab') ? 'Unassigned Lab' : 'Room TBD');
    const isLab = ['true', 'yes', 'y', '1', 'lab', 'laboratory'].includes(labValue) || room.toLowerCase().includes('lab');

    normalized.push({
      id: `import-${index}-${crypto.randomUUID()}`,
      code,
      subject: subject || code,
      faculty: clean(getValue('faculty')) || 'Faculty TBD',
      room,
      batch: clean(getValue('batch')) || 'Batch TBD',
      weeklyHours: Math.max(1, Number.parseInt(clean(getValue('weeklyHours')), 10) || 2),
      isLab,
      roomCapacity: Math.max(1, Number.parseInt(clean(getValue('roomCapacity')), 10) || 60),
      availability: dayList(row.availability ?? row['Available days'] ?? row['Faculty availability']),
    });
  }
  return normalized;
}

export async function readSpreadsheet(file: File): Promise<Course[]> {
  const rows: Record<string, unknown>[] = [];
  if (file.name.toLowerCase().endsWith('.xls')) {
    const XLSX = await import('@e965/xlsx');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    for (const name of workbook.SheetNames) {
      rows.push(...XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[name], { defval: '' }));
    }
  } else {
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    workbook.eachSheet((sheet) => {
      const headerRow = sheet.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        headers[columnNumber - 1] = cell.text.trim() || `Column ${columnNumber}`;
      });
      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;
        const record: Record<string, unknown> = {};
        row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
          record[headers[columnNumber - 1] ?? `Column ${columnNumber}`] = cell.text.trim();
        });
        rows.push(record);
      });
    });
  }
  const courses = normalizeCourses(rows);
  if (!courses.length) throw new Error('No course rows were found. Include columns such as Subject, Faculty, Room, Batch, and Weekly Hours.');
  return courses;
}

export async function readPdf(file: File): Promise<string> {
  const [{ getDocument, GlobalWorkerOptions }, { default: pdfWorkerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const document = await getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = new Map<number, Array<{ x: number; width: number; text: string }>>();
    for (const item of content.items) {
      if (!('str' in item) || !('transform' in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const row = lines.get(y) ?? [];
      row.push({ x: item.transform[4], width: item.width, text: item.str });
      lines.set(y, row);
    }
    const text = [...lines.entries()]
      .sort(([first], [second]) => second - first)
      .map(([, row]) => {
        row.sort((first, second) => first.x - second.x);
        return row.reduce((line, item, index) => {
          if (index === 0) return item.text;
          const previous = row[index - 1];
          const gap = item.x - previous.x - previous.width;
          return `${line}${gap > 7 ? ' | ' : ' '}${item.text}`;
        }, '');
      })
      .join('\n');
    pages.push(text);
  }
  const extracted = pages.join('\n').trim();
  if (!extracted) throw new Error('No selectable text was found in the PDF. Scanned-image PDFs need OCR before import.');
  return extracted;
}

export function parsePlainText(text: string): Course[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const records = lines.map((line) => {
    const columns = line.includes('\t') ? line.split('\t') : line.split(/\s{2,}|[,;|]/).map((cell) => cell.trim());
    if (columns.length < 3) return null;
    const hasCapacity = columns[4] !== undefined && columns[4].trim() !== '' && Number.isFinite(Number(columns[4]));
    return {
      code: columns[0],
      subject: columns[1],
      faculty: columns[2],
      room: columns[3] ?? '',
      roomCapacity: hasCapacity ? columns[4] : '60',
      batch: columns[hasCapacity ? 5 : 4] ?? '',
      weeklyHours: columns[hasCapacity ? 6 : 5] ?? '2',
      type: columns[hasCapacity ? 7 : 6] ?? '',
      availability: columns[hasCapacity ? 8 : 7] ?? '',
    };
  }).filter((row): row is NonNullable<typeof row> => row !== null);
  const courses = normalizeCourses(records);
  if (!courses.length) throw new Error('The PDF text could not be recognized as course rows. Use a spreadsheet with labeled columns or check the PDF format.');
  return courses;
}
