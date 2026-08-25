# Workout data and safety

The Workout tab is a private activity log for lifts, climbs, and runs. It records what you enter as append-only Markdown and derives summaries in the browser.

## What it records

- Lifts: exercise, sets, reps, optional weight, weight unit, and optional RPE
- Climbs: style, grade system, grade, outcome, attempts, and optional venue, route, or wall notes
- Runs: distance, duration, run type, optional elevation, and optional perceived effort
- All activities: date, optional time, title, and notes

Pace, lift volume, recent bests, and chart points are derived views rather than a separate database. The source record keeps the original values and units.

## Interaction model

The design combines a few proven patterns without copying another product: previous lift values stay beside the next entry, progression lives on the exercise detail, run pace is calculated from distance and duration, and climbs distinguish flashes, sends, attempts, and projects. The reference points were [Hevy's exercise history and progress tracking](https://www.hevyapp.com/features/), [Strong's exercise detail](https://help.strongapp.io/article/237-about-exercise-detail), [Strava's run activity fields](https://support.strava.com/en-us/articles/15401883-run-activity-pages), and [Sequence's climbing progression model](https://www.sequence-app.com/).

## Safety boundary

The tracker does not create training plans, prescribe loads, diagnose injuries, evaluate technique, or decide whether an activity is safe. Numbers can also be misleading across different equipment, routes, surfaces, weather, grade setters, or fatigue levels. Use the history as a memory aid, not professional health or coaching advice.

Because workout notes may reveal health, routine, or location information, protect the containing device and any sync provider you configure. The project has no analytics or third-party exercise API, and workout search terms stay in the browser.
