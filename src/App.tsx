import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { AlertCircle, ArrowDownToLine, ArrowLeft, ArrowUpFromLine, BookOpen, CalendarDays, Check, ChevronDown, Clock3, FlaskConical, GraduationCap, LoaderCircle, Pencil, Plus, X } from 'lucide-react';
import { DEMO_COURSES } from './data';
import { parsePlainText, readPdf, readSpreadsheet } from './documents';
import { exportPowerPoint } from './exports';
import { findConflicts, generateSchedule } from './scheduler';
import { DAYS, TIME_SLOTS, type Course, type Day, type TimetableEntry } from './types';

type View = 'schedule' | 'courses';
type Filter = 'Everyone' | 'Faculty' | 'Room' | 'Class';

const colors = ['purple', 'blue', 'green', 'orange', 'pink', 'cyan'];
const colorFor = (text: string) => colors[[...text].reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length];
const endingTime = (start: string, duration: number) => `${String(Number(start.slice(0, 2)) + duration).padStart(2, '0')}:00`;
const displayTime = (entry: TimetableEntry) => `${entry.startTime}–${endingTime(entry.startTime, entry.durationHours)}`;
const shortName = (name: string) => name.split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase();

export default function App() {
  const [courses, setCourses] = useState<Course[]>(DEMO_COURSES);
  const [entries, setEntries] = useState<TimetableEntry[]>(() => generateSchedule(DEMO_COURSES).entries);
  const [view, setView] = useState<View>('schedule');
  const [department, setDepartment] = useState('Computer Science');
  const [term, setTerm] = useState(`Fall ${new Date().getFullYear()}`);
  const [filter, setFilter] = useState<Filter>('Everyone');
  const [filterValue, setFilterValue] = useState('All');
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
  const [editDay, setEditDay] = useState<Day>('Monday');
  const [editTime, setEditTime] = useState<string>(TIME_SLOTS[0]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const conflicts = useMemo(() => findConflicts(entries, courses), [entries, courses]);

  const filterOptions = filter === 'Faculty'
    ? [...new Set(courses.map((course) => course.faculty))]
    : filter === 'Room'
      ? [...new Set(courses.map((course) => course.room))]
      : filter === 'Class'
        ? [...new Set(courses.map((course) => course.batch))]
        : [];
  const visibleEntries = entries.filter((entry) => {
    if (filterValue === 'All' || filter === 'Everyone') return true;
    const course = courses.find((item) => item.id === entry.courseId);
    if (!course) return false;
    if (filter === 'Faculty') return course.faculty === filterValue;
    if (filter === 'Room') return course.room === filterValue;
    return course.batch === filterValue;
  });

  const processFile = async (file?: File) => {
    if (!file) return;
    setError('');
    setNotice('');
    setIsProcessing(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      let imported: Course[];
      if (extension === 'xlsx' || extension === 'xls') {
        imported = await readSpreadsheet(file);
      } else if (extension === 'pdf') {
        imported = parsePlainText(await readPdf(file));
      } else {
        throw new Error('Choose an .xlsx, .xls, or text-based .pdf file.');
      }
      if (!imported.length) throw new Error('No course records were found in this file.');
      setCourses(imported);
      setEntries([]);
      setView('courses');
      setNotice(`Imported ${imported.length} courses. Review them, then generate your timetable.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The document could not be processed.');
    } finally {
      setIsProcessing(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => void processFile(event.target.files?.[0]);
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void processFile(event.dataTransfer.files[0]);
  };

  const updateCourse = (id: string, field: keyof Course, value: string | number | boolean | Day[]) => {
    setCourses((current) => current.map((course) => course.id === id ? { ...course, [field]: value } : course));
  };

  const addCourse = () => {
    setCourses((current) => [...current, {
      id: `course-${crypto.randomUUID()}`, code: 'NEW101', subject: 'New course',
      faculty: 'Faculty TBD', room: 'Room TBD', batch: 'Batch TBD',
      weeklyHours: 2, isLab: false, roomCapacity: 60, availability: [...DAYS],
    }]);
  };

  const generate = () => {
    setError('');
    setNotice('');
    setIsGenerating(true);
    try {
      if (!courses.length) throw new Error('Add a course before generating a timetable.');
      const result = generateSchedule(courses);
      setEntries(result.entries);
      setView('schedule');
      if (result.unscheduled.length) setError(`Some classes could not be scheduled: ${result.unscheduled.join(' ')}`);
      else setNotice('Timetable generated. Click any class to edit its day or time.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not generate the timetable.');
    } finally {
      setIsGenerating(false);
    }
  };

  const download = async () => {
    try {
      setError('');
      await exportPowerPoint(department, term, courses, entries);
      setNotice('Your editable timetable has been downloaded.');
    } catch (reason) {
      setError(reason instanceof Error ? `Download failed: ${reason.message}` : 'Download failed.');
    }
  };

  const openEditor = (entry: TimetableEntry) => {
    setEditingEntry(entry);
    setEditDay(entry.day);
    setEditTime(entry.startTime);
    setError('');
  };

  const saveEntry = () => {
    if (!editingEntry) return;
    const course = courses.find((item) => item.id === editingEntry.courseId);
    if (!course) {
      setError('This class no longer exists in your course list.');
      return;
    }
    if (!course.availability.includes(editDay)) {
      setError(`${course.faculty} is not available on ${editDay}.`);
      return;
    }
    if (TIME_SLOTS.indexOf(editTime as (typeof TIME_SLOTS)[number]) + editingEntry.durationHours > TIME_SLOTS.length) {
      setError('This class would end after the last available timetable slot.');
      return;
    }

    const proposed = entries.map((entry) => entry.id === editingEntry.id
      ? { ...entry, day: editDay, startTime: editTime }
      : entry);
    const conflictIds = findConflicts(proposed, courses);
    if (conflictIds.has(editingEntry.id)) {
      setError('That time conflicts with another class for the faculty member, room, or batch.');
      return;
    }
    const facultyHours = proposed.reduce((total, entry) => {
      if (entry.day !== editDay) return total;
      const scheduledCourse = courses.find((item) => item.id === entry.courseId);
      return scheduledCourse?.faculty === course.faculty ? total + entry.durationHours : total;
    }, 0);
    if (facultyHours > 5) {
      setError('This change would give the faculty member more than 5 hours on this day.');
      return;
    }

    setEntries(proposed);
    setEditingEntry(null);
    setError('');
    setNotice('Class time updated.');
  };

  const startEditing = (entry: TimetableEntry) => {
    setError('');
    setNotice('');
    openEditor(entry);
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setView('schedule')} aria-label="Show timetable">
          <span className="brand-icon"><GraduationCap size={19} /></span>
          <span>Department timetable</span>
        </button>
        <div className="topbar-actions">
          <button className="plain-button" onClick={() => fileInput.current?.click()} disabled={isProcessing}>
            {isProcessing ? <LoaderCircle className="spin" size={16} /> : <ArrowUpFromLine size={16} />}
            {isProcessing ? 'Importing…' : 'Import file'}
          </button>
          <button className={`plain-button ${view === 'courses' ? 'selected' : ''}`} onClick={() => setView(view === 'courses' ? 'schedule' : 'courses')}>
            <BookOpen size={16} /> Courses <span className="count">{courses.length}</span>
          </button>
          <input ref={fileInput} className="visually-hidden" type="file" accept=".xlsx,.xls,.pdf" onChange={onFileChange} />
        </div>
      </header>

      <main className="page">
        <section className="page-heading">
          <div className="heading-copy">
            <span className="overline">{view === 'schedule' ? 'WEEKLY SCHEDULE' : 'COURSE LIST'}</span>
            <label className="department-input"><input aria-label="Department name" value={department} onChange={(event) => setDepartment(event.target.value)} /><Pencil size={14} /></label>
            {view === 'schedule' && <p>Click a class to change its day or time.</p>}
          </div>
          <div className="heading-actions">
            <label className="term-field"><span>Term</span><input aria-label="Term" value={term} onChange={(event) => setTerm(event.target.value)} /></label>
            <button className="button button-outline" onClick={generate} disabled={isGenerating}>
              {isGenerating ? <LoaderCircle className="spin" size={16} /> : <CalendarDays size={16} />}
              {isGenerating ? 'Generating…' : 'Generate schedule'}
            </button>
            <button className="button button-dark" onClick={() => void download()} disabled={!entries.length}>
              <ArrowDownToLine size={16} /> Download timetable
            </button>
          </div>
        </section>

        {(error || notice) && (
          <div className={`message ${error ? 'message-error' : ''}`} role={error ? 'alert' : 'status'}>
            {error ? <AlertCircle size={16} /> : <Check size={16} />}
            <span>{error || notice}</span>
            <button aria-label="Dismiss message" onClick={() => { setError(''); setNotice(''); }}><X size={15} /></button>
          </div>
        )}

        {view === 'schedule' ? (
          <>
            <div
              className={`import-strip ${isDragging ? 'dragging' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => fileInput.current?.click()}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') fileInput.current?.click(); }}
              onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
            >
              <ArrowUpFromLine size={17} />
              <span>Drop an Excel or PDF file here, or <strong>browse files</strong></span>
              <span className="file-types">XLSX · XLS · PDF</span>
            </div>

            <section className="schedule-card">
              <div className="schedule-toolbar">
                <div className="schedule-title"><CalendarDays size={17} /><strong>Weekly timetable</strong><span>{visibleEntries.length} classes</span></div>
                <div className="filter-group">
                  <select aria-label="Filter timetable" value={filter} onChange={(event) => { setFilter(event.target.value as Filter); setFilterValue('All'); }}>
                    <option>Everyone</option><option>Faculty</option><option>Room</option><option>Class</option>
                  </select>
                  {filter !== 'Everyone' && (
                    <select aria-label={`Select ${filter}`} value={filterValue} onChange={(event) => setFilterValue(event.target.value)}>
                      <option value="All">All {filter.toLowerCase()}</option>
                      {filterOptions.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  )}
                  <ChevronDown size={14} />
                </div>
              </div>

              <div className="schedule-scroll">
                <div className="timetable-grid">
                  <div className="grid-corner">TIME</div>
                  {DAYS.map((day) => <div className="day-header" key={day}>{day}</div>)}
                  {TIME_SLOTS.map((time) => (
                    <div className="grid-row" key={time}>
                      <div className="time-label"><strong>{time}</strong><span>{endingTime(time, 1)}</span></div>
                      {DAYS.map((day) => (
                        <div className="slot-cell" key={`${day}-${time}`}>
                          {visibleEntries.filter((entry) => entry.day === day && entry.startTime === time).map((entry) => {
                            const course = courses.find((item) => item.id === entry.courseId);
                            if (!course) return null;
                            const conflict = conflicts.has(entry.id);
                            return (
                              <button key={entry.id} className={`class-card color-${colorFor(course.code)} ${conflict ? 'conflicted' : ''}`} onClick={() => startEditing(entry)}>
                                <span className="card-top"><span>{course.code}</span>{course.isLab && <FlaskConical size={13} />}</span>
                                <strong>{course.subject}</strong>
                                <span className="card-detail"><span className="mini-avatar">{shortName(course.faculty)}</span>{course.faculty}</span>
                                <span className="card-meta"><span><Clock3 size={11} />{displayTime(entry)}</span><span>{course.room}</span></span>
                                {conflict && <span className="conflict-label">Scheduling conflict</span>}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <footer className="schedule-footer">
                <span><i className="legend-dot" /> Select a class to edit its schedule</span>
                <span>{conflicts.size ? `${conflicts.size} conflicting classes` : 'No scheduling conflicts'}</span>
              </footer>
            </section>
          </>
        ) : (
          <CourseReview courses={courses} updateCourse={updateCourse} addCourse={addCourse} onBack={() => setView('schedule')} />
        )}
      </main>

      {editingEntry && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingEntry(null); }}>
          <section className="edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-title">
            <div className="modal-top">
              <div><span className="overline">EDIT CLASS TIME</span><h2 id="edit-title">{courses.find((course) => course.id === editingEntry.courseId)?.subject}</h2></div>
              <button className="close-button" aria-label="Close" onClick={() => setEditingEntry(null)}><X size={18} /></button>
            </div>
            <p className="modal-subtitle">{courses.find((course) => course.id === editingEntry.courseId)?.code} · {courses.find((course) => course.id === editingEntry.courseId)?.faculty}</p>
            <label className="edit-field"><span>DAY</span><select value={editDay} onChange={(event) => setEditDay(event.target.value as Day)}>{DAYS.map((day) => <option key={day}>{day}</option>)}</select></label>
            <label className="edit-field"><span>START TIME</span><select value={editTime} onChange={(event) => setEditTime(event.target.value)}>{TIME_SLOTS.filter((time) => TIME_SLOTS.indexOf(time) + editingEntry.durationHours <= TIME_SLOTS.length).map((time) => <option key={time} value={time}>{time}–{endingTime(time, editingEntry.durationHours)}</option>)}</select></label>
            {error && <div className="inline-error"><AlertCircle size={15} />{error}</div>}
            <div className="modal-actions"><button className="button button-outline" onClick={() => setEditingEntry(null)}>Cancel</button><button className="button button-dark" onClick={saveEntry}>Save changes</button></div>
          </section>
        </div>
      )}
    </div>
  );
}

function CourseReview({ courses, updateCourse, addCourse, onBack }: {
  courses: Course[];
  updateCourse: (id: string, field: keyof Course, value: string | number | boolean | Day[]) => void;
  addCourse: () => void;
  onBack: () => void;
}) {
  return (
    <section className="course-card">
      <header className="course-toolbar">
        <button className="back-button" onClick={onBack}><ArrowLeft size={15} /> Back to timetable</button>
        <button className="button button-dark" onClick={addCourse}><Plus size={16} /> Add course</button>
      </header>
      <div className="table-scroll">
        <table className="course-table">
          <thead><tr><th>CODE / SUBJECT</th><th>FACULTY</th><th>ROOM</th><th>CAPACITY</th><th>CLASS / BATCH</th><th>HOURS</th><th>LAB</th><th>AVAILABLE DAYS</th></tr></thead>
          <tbody>{courses.map((course) => (
            <tr key={course.id}>
              <td><input className="code-input" aria-label={`${course.code} code`} value={course.code} onChange={(event) => updateCourse(course.id, 'code', event.target.value)} /><input aria-label={`${course.code} subject`} value={course.subject} onChange={(event) => updateCourse(course.id, 'subject', event.target.value)} /></td>
              <td><input aria-label={`${course.code} faculty`} value={course.faculty} onChange={(event) => updateCourse(course.id, 'faculty', event.target.value)} /></td>
              <td><input aria-label={`${course.code} room`} value={course.room} onChange={(event) => updateCourse(course.id, 'room', event.target.value)} /></td>
              <td><input type="number" min="1" aria-label={`${course.code} room capacity`} value={course.roomCapacity} onChange={(event) => updateCourse(course.id, 'roomCapacity', Number(event.target.value))} /></td>
              <td><input aria-label={`${course.code} batch`} value={course.batch} onChange={(event) => updateCourse(course.id, 'batch', event.target.value)} /></td>
              <td><input type="number" min="1" aria-label={`${course.code} weekly hours`} value={course.weeklyHours} onChange={(event) => updateCourse(course.id, 'weeklyHours', Number(event.target.value))} /></td>
              <td><input type="checkbox" aria-label={`${course.code} lab`} checked={course.isLab} onChange={(event) => updateCourse(course.id, 'isLab', event.target.checked)} /></td>
              <td><input aria-label={`${course.code} availability`} value={course.availability.join(', ')} onChange={(event) => {
                const requested = event.target.value.toLowerCase().split(/[,;]\s*/).filter(Boolean);
                updateCourse(course.id, 'availability', DAYS.filter((day) => requested.some((value) => day.toLowerCase().startsWith(value))));
              }} /></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {!courses.length && <div className="empty-courses">No courses yet. Import a file or add a course to get started.</div>}
    </section>
  );
}
