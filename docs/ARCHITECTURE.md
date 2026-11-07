# Architecture

Vite 6, React 18, TypeScript, Dexie 4 (IndexedDB "dad-lab"), dexie-react-hooks, fflate for backups, HashRouter, vite-plugin-pwa. GitHub Pages via Actions. A zero-dependency `server.cjs` serves `dist/` on port 4176 for the local copy and the acceptance walk.

## Reused from Athletic Lab
Figure (joint-position stick figures that ease between two frames), Sheet/Confirm/toast, Charts, Tour, ErrorBoundary, BackupPanel, SyncCard, the backup format (ZIP with a manifest and SHA-256 per file), the sync engine (push records newer than the last push plus tombstones; pull rows newer than the last pull; merge by record; re-push after a pull that applied anything), the PWA setup, the server, and the shape of the acceptance walk. The athlete/parent split, PINs, parent packs, private notes, clips and videos are gone: one person.

## Data (src/engine/types.ts, src/db/db.ts)
Tables: profile (id "me": name, theme, goals, programStart, goalWeightLbs), settings (reminders, strengthDaysPerWeek 2 to 6, bandNames, weighIns, tourSeenAt, sync), exercises, templates, sessions, activity, checkIns, flags, journal, habits, messages, achievements, weighIns, meta, tombstones. Every record carries updatedAt or ts. `DATA_TABLES` is what backups and sync carry; settings and meta never leave the device.

Loads: `body`, `band1..band4` (names from settings; defaults are the X3 set), `dumbbell` with `lbs` on the set. A set can be marked `toFailure`.

## The day picker (src/engine/readiness.ts)
Pure function. RED on sick or pain (the floor, reduced; pain the day after a pain stop raises an alert). ORANGE on energy 1, very sore, or five minutes (the floor). YELLOW on sleep ≤2, energy 2, stress ≥4, fifteen minutes, sore after bands yesterday, a hard physical day already today, or a hard day yesterday with soreness (stretch when fried or fifteen minutes, otherwise Happy Body; bands as a reduced alternative when the week allows). GREEN: the next band day (push/pull alternating) while the weekly count is under the target, Happy Body once the target is met, a bonus stretch once bands are done today. Sore joints from the check-in become blocked tags. `chain()` counts days in a row with a done session or logged activity.

## Program (src/engine/program.ts)
`lastLoad` remembers the band or dumbbell per move. `decideDose`: band moves suggest the next band after two sessions in a row at the top of the range with the same band (suggestion only, never applied), and put the band below on the card after a session under the bottom of the range; bodyweight rep moves widen the range by 2 after two sessions at the top; holds add 5 seconds. Reduced days are one set and no suggestion. `buildSession` applies blocked tags (swap to a substitute or drop, with a reason), drops optional items on reduced days, and writes `why`.

## Today (src/engine/today.ts, src/ui/pages/TodayPage.tsx)
Check-in → readiness → the offer and the alternatives that fit → Start builds a session from the template → the player (WorkoutPage) logs sets with band, reps, failure, lbs → Finish writes minutes, difficulty, a journal line, and refreshes milestones. Weekly weigh-in card appears once a week when enabled.

## Sync (src/io/sync.ts)
Same Supabase project and `records` table as Athletic Lab, same `x-family-key` header and row-level policy; a different 20-character code gives a different hash, so the two apps never see each other's rows. The link is `#/join?k=CODE`. Runs on open, foreground, online, two seconds after a write (`dad-lab:changed`), every two minutes.

## Not built
Push notifications (no server). Editing templates in the app (the files are the editor for now).
