# Timetable

The 2026 Cybersecurity Bootcamp schedule lives in the database, loaded from `data/seed/bootcamp-timetable-and-outline.xlsx`. The workbook is the source for dates, the 12 week outline, the daily sessions, the proposed trainers, and the weekly deliverables.

## What was imported

The programme is the Cybersecurity Bootcamp, Monday 5 October 2026 through Friday 25 December 2026.

| Piece | Count |
| --- | --- |
| Blocks | 3 |
| Weeks | 12 |
| Sessions | 540 (12 weeks × 5 weekdays × 9 slots) |
| Deliverables | 31 |
| Trainer records | 22, including the group Maxim Nyansa Team |

Blocks:

1. Foundations & Secure Systems — weeks 1–4, 5 Oct–30 Oct. Professional Foundation / Cybersecurity Foundations.
2. Applications, Data & Cryptography — weeks 5–8, 2 Nov–27 Nov. Professional Practice / Protecting Applications and Information.
3. Identity, Cloud, Threats & Capstone — weeks 9–12, 30 Nov–25 Dec. Career Readiness / Security Operations and Defence.

A weekday runs devotion 8:00–8:30, standup 8:30–8:45, theory, a short break, a longer morning session, group activity or guided study 12:30–1:00, lunch 1:00–2:00, practical 2:00–4:00, and a closing session to 5:00. Projects and assignments sit outside class.

## Tables

Migration `1793923200000-Timetable` adds:

- `programmes` — one row, `bootcamp-2026`, with the date range, the day rules, and the import warnings.
- `curriculum_blocks` — the three blocks.
- `curriculum_weeks` — week number, title, Monday date, professionalism text, cybersecurity text.
- `week_deliverables` — one row per deliverable line.
- `trainers` — display name, a normalised name, `person` or `group`, `proposed`, and an optional `user_id`.
- `week_trainers` — a trainer on a week as professionalism or cybersecurity.
- `class_sessions` — one row per slot, with date, times, type, topic, and `origin` (`import` or `admin`).
- `session_trainers` — trainers proposed for that slot.

`trainers.user_id` points at `users` and is set only when exactly one existing user has the same display name. The import does not create logins, emails, or passwords.

Lesson notes stay in `lessons`. Those rows are samples. Their module id is an archive tag, not a block from this workbook.

## Import again

From `backend/`:

```bash
npm run timetable:import
```

The command reads `TIMETABLE_XLSX` when that variable is set, otherwise `data/seed/bootcamp-timetable-and-outline.xlsx`. Run it after `npm run migration:run`. It is safe to run more than once.

What a second run does:

- Upserts the programme, blocks, weeks, deliverables, and trainers on stable ids (`week-01`, `tr-diana-van-der-stelt`, and so on).
- Replaces imported sessions. The key is `import_key`, shaped `2026-10-05#01`.
- Deletes imported sessions that are no longer in the file.
- Leaves sessions created in admin (`origin = admin`, ids `sess-` plus random hex) in place.
- Does not turn `proposed` back on if an editor has cleared it, and does not clear a `user_id` that is already set.

`npm run seed` calls the same import after the sample lessons, so a local database shows the timetable without a second command. Do not run `npm run seed` on the hosted database. Use `npm run timetable:import` there.

An editor can also upload a workbook at `POST /api/v1/admin/timetable/import` (permission `content.write`, multipart field `file`, 8 MB, `.xlsx`). The development adapter used by the website does not parse Excel. That upload works against the live API. The adapter returns an error that says so.

## API

Public reads, under `/api/v1`, use the short public cache:

- `GET /public/timetable`
- `GET /public/blocks`
- `GET /public/weeks` and `GET /public/weeks/:number`
- `GET /public/sessions?week=`
- `GET /public/deliverables`

Admin routes sit under `/api/v1/admin` and send `Cache-Control: no-store`. The parent admin router already requires a signed-in user with `content.read`. Writes require `content.write`.

`GET /admin/timetable` is the full document, including warnings. Sessions, weeks, deliverables, and trainers have create, update, and delete routes. `POST /admin/sessions/reorder` swaps a session with the neighbour on the same day.

The public payload includes `today` (Africa/Accra) and `currentWeek`, the latest week whose Monday is on or before that day.

## Where it shows

- Public schedule: `/schedule`, with a week switch, the current week selected, and today marked when that day is in the week.
- Home, bootcamp overview, and journey read the same payload for blocks, week titles, and dates.
- Admin: **Timetable** in the sidebar, and a Timetable button on the class list. The page is `/admin/classes/timetable`. It filters by block, week, day, trainer, type, and text, and it edits sessions, deliverables, and proposed trainers.

## Workbook notes the import keeps

The parser records warnings instead of guessing. They are stored on the programme and shown in admin.

- Date and day are filled down from merged cells. The warning code is `merged-cells`.
- Columns I–K on the outline are a time-of-day template, not extra sessions (`outline-template`).
- `Madam Diana` is stored as Diana van der Stelt. `Stanley` is stored as Stanley K. Dankyira. `George Plange` is stored as George Edward Plange. Extra spaces in `Ken,  David  Davor` are collapsed.
- A slash splits Arnold and Ken. A comma splits Jair Santanna and Alfred Kumah.
- `TBC` and `To be confirmed` are a status, not a person. `All` is a status. Maxim Nyansa Team is a group, not a login.
- Week 8 does not name a professionalism trainer. Week 10 does not either. Those lists stay empty.
- The outline and the daily sheet name different trainers on purpose. Both are stored.
- The sheet spells “Rebotics” on 7 October. That spelling is kept.
- Four slots that Wednesday have no activity label. They are stored as events, with the topic “Inter-School Rebotics Competitions: Google Office”.
- A “10-minute break: 3:20–3:30 p.m.” written inside a practical cell is stored as a note, not as another row.

Trainer names on the public schedule are labelled proposed. The sheet says the daily allocation is still pending.
