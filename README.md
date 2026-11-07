# Dad Lab

Deren's own daily training app, built next to Athletic Lab (Eli's) with the same bones: an offline-first web app installed on the home screen, a check-in that picks the day, a player that logs it, and automatic sync between his own devices. One person, every day, something.

Live: https://doc-jpg.github.io/dad-lab/ (iPhone and iPad: Safari, Share, Add to Home Screen. Android: Chrome, Install app.)

## What it does
1. **Daily check-in** (sleep, energy, stress, soreness and where, time available, anything already done, pain or sick). Twenty seconds.
2. **The day picker** turns that plus the last two weeks into Green (the planned day), Yellow (lighter: stretch or Happy Body, bands at one set each if you insist), Orange (the five-minute floor) or Red (sick or hurt: still the floor). It always says why. There is always something.
3. **Six kinds of day:** Push day (band chest press, overhead press, triceps, front squat), Pull day (band deadlift, seated row, curls, rear delt pull-aparts, calf raises), Happy Body (one slow pass through the book's sequence on a 25-minute clock, then five minutes flat), Stretch (12-minute floor flow with breathing), The floor (cat-cow, twenty squats, four minutes of breathing), Walk.
4. **Band progression:** the app remembers the band per move. Forty clean reps twice in a row suggests the next band; under fifteen puts the band below on the card. It never changes the band itself.
5. **Push and pull alternate** up to the weekly target you set (default four). The other days get Happy Body, the stretch, a walk or the floor.
6. **The chain:** days in a row with something done. A missed day restarts it; nothing else is lost.
7. **Habits** (water, meals on the clock, a walk, seven hours, five minutes flat, nothing heavy late), **weekly weigh-in** with a trend line, **journal**, **progress** (band per move, days per week, calendar), **milestones** that are never taken away.
8. **Linked devices:** phone, iPad and laptop stay in step through a device code (same free cloud project as Athletic Lab, different code, so the rows never meet). **Backups** as ZIP files with checksums; merge never overwrites a newer record.

## Run the checks
```
npm ci
npm test                      # vitest: engine, persistence, sync
npm run build && node server.cjs      # http://localhost:4176
node scripts/acceptance.cjs   # Playwright walk from an empty device (DEVICE="Pixel 5" for Android; LIVE=1 links a second device through the real server)
```

## Docs
`docs/ARCHITECTURE.md` (how it is put together), `docs/DECISIONS.md` (why, newest first; the next session starts there), `docs/SETUP.md` (installing and linking devices), `docs/DESIGN_PRINCIPLES.md`, `docs/RESEARCH_HAPPY_BODY.md` (what is publicly known about the book's method, paraphrased).

Not medical advice. A guide for a healthy adult who already knows how to lift.
