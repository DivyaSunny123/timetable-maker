# Department Timetable

A straightforward timetable builder. Import course data, edit class times in the weekly grid, and download one editable PowerPoint timetable.

## Features

- Import `.xlsx`, `.xls`, or text-based `.pdf` files. Document parsing runs in the browser; scanned image-only PDFs require OCR.
- Review and edit course, faculty, room, room-capacity, batch, weekly-hour, lab, and availability details.
- Generate a weekly schedule using a local rule-based scheduler. Faculty, room, and batch conflicts, faculty availability, laboratory room names, and a five-hour daily faculty limit are checked.
- Click any class in the timetable to move it to a different day or time. Moves that break availability, conflict, or daily-hour constraints are rejected.
- Filter the timetable by faculty, room, or class.
- Download one PowerPoint file containing the timetable grid. Its title and timetable cells are editable in PowerPoint.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (typically `http://localhost:5173`). To create and preview a production build:

```bash
npm run build
npm run preview
```

## Input data

For best results, use a spreadsheet with a header row. Recognized headers include `Course Code`, `Subject` / `Course Name`, `Faculty` / `Instructor`, `Room`, `Room Capacity`, `Batch` / `Class` / `Section`, `Weekly Hours`, `Lab`, and `Available days`. Multiple sheets are read.

PDF imports need selectable text and should have course details on clearly separated rows in this order: course code, subject, faculty, room, optional numeric room capacity, batch, weekly hours, type, available days. Verify imported details before generating the schedule.
