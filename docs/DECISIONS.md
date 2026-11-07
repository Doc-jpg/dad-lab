# Decisions and lessons

Newest first. Append here; this is where the next session starts.

## 2026-11-07 (evening), v0.1.2, two of his notes
- Sunday is the first day of the week for him. The calendar and the weekly band count now run Sunday to Saturday (`weekStartOf`).
- The water habit no longer mentions a bottle in the operatory (unsanitary, his words). It now reads: a glass before the coffee, one with every meal, and 16 ounces between meals somewhere in the day.

## 2026-11-07 (later), v0.1.1, his real bands (Deren: "I need more bands than that. I have the Draper's Strength kit but am using them with X3 in mind")

- Eight band slots instead of four; a blank name means he does not own that slot and it is skipped. Defaults are the Draper's Strength 41-inch set in its own order with the tension from the Draper's chart he keeps in Notes: Yellow 2 to 15, Red 5 to 35, Black 10 to 50, Purple 25 to 80, Green 50 to 120, Blue 60 to 150, Orange 70 to 175, and the X3 band each one stands in for from his conversion note (Purple = white, Green = light gray, Blue = dark gray, Orange = elite).
- Where a move starts the first time is inside the bands he owns: light (fourth slot, the Purple) for curls, triceps, pull-aparts and the overhead press; mid (Green) for the chest press and the row; heavy (Blue) for the squat, deadlift and calf raises. He picks once and it remembers. "Next band" steps through the bands he owns, skipping blanks.
- His X3 log (screenshots) counts full reps plus partials; the player now has a partials counter on band sets and the summary shows "+n partials". The row is named "Band row (seated or bent)" since the X3 log says bent and he said seated.

## 2026-11-07, v0.1.0, first build (Deren: "I need to also get my ass in shape ... I just need to do it seven days a week, even if it's basically nothing")

What he asked for: his own version of Athletic Lab, same databases and plumbing, a check-in each day (sleep and the rest), his X3-style push and pull band days (push: chest, shoulder press, triceps, squats; pull: seated rows, curls, band extensions for rear delts and posture, deadlifts, calf raises), some minimal stretching or yoga, the Happy Body book folded in, and something to do every single day because skipping a day or two is what breaks the habit for him.

Decisions:
- **Separate app, shared plumbing.** New repo `dad-lab`, own Pages path, manifest id, service-worker scope, IndexedDB name, icon. Same Supabase project and `records` table as Athletic Lab; a different device code hashes to a different family id, so the rows never meet. Zero new SQL; the row-level policy already isolates by hash.
- **One person.** No athlete/parent split, no PIN, no private notes, no parent packs. Sync is between his own devices (phone, iPad, laptop) through a "device link" that is the family link under another name.
- **There is always something.** The one rule that never relaxes. Red (sick, pain) still offers the floor: cat-cow, twenty squats, four minutes of breathing. Orange (wiped out, very sore, five minutes) is the floor too. The chain counts any done day, including a logged walk.
- **Band days alternate push and pull up to a weekly target** (default four, settable 2 to 6). Past the target the app offers Happy Body, with an extra band day only as an alternative on a great day. Yellow allows bands at one set each with no band up.
- **Band progression is a suggestion, never an action.** Forty clean reps twice in a row with the same band puts "try the next band" on the card; under fifteen puts the band below on the card. He picks the band every set; the app only remembers. The rep chips (15 to 40) and a "went to failure" toggle keep logging to two taps.
- **Happy Body: frame the book, do not copy it.** The research (docs/RESEARCH_HAPPY_BODY.md) found the sequences, levels and weight table are the paid content; what is public is the method: ~30 minutes daily, six exercises in one slow pass, each rep six beats with the breath held through the movement, light dumbbells, progression by level first, then speed, then weight, two weeks without soreness before any step, five minutes of relaxation after with the same music, two meals and three snacks on a clock, a pound or two a week, retests every six weeks. So the Happy Body day is: one-minute warm-up, a 25-minute clock for "your sequence from the book at your level" with the level and weight logged in the note, and five minutes flat on the back. The official free videos are linked from the exercise page (opened in the browser, nothing copied). The meals-on-a-clock and relaxation rules live under Habits, the weigh-in on Today weekly, the flexibility check as a move under Days. Six invented "Happy Body style" moves were written first and thrown away once the research came back: they were not the book and would have pretended to be.
- **Weigh-ins are fine here.** This is an adult who asked for the book's method; weekly, trend over number, optional goal, off switch in Settings. (Athletic Lab has none, on purpose.)
- **Messages are written for a grown man**, no cheerleading: sleep, food, recovery, consistency, posture (he is a dentist; the rounded-forward day is the enemy), breathing, strength, and the odd line about Eli watching. The shame-word test from Athletic Lab still runs.
- **Themes:** slate (default, a grown-up blue and copper), minimal, dark (warm). The playful kid theme is gone.
- **Drawings:** the animated stick figures carry over; fourteen new poses for the band moves, the Happy Body shapes and the stretch flow.

Verification: 43 vitest tests (day picker, chain, band progression, building a day, library and templates, messages, milestones, persistence, backup and merge, sync between two devices through a fake server, plus a live round trip under `LIVE_SYNC=1`). Playwright walk from an empty device as an iPhone 13 and a Pixel 5: setup, device code, green push day start to finish with bands and a failure set, summary, chain, offline, yellow day with bands reduced, red day still offering the floor, progress, habits, backup and merge, identity (own database, no other lab databases), tour, FAQ; `LIVE=1` adds an iPad joining by code and receiving the day.

Not done: a real iPhone pass (share sheet, Add to Home Screen, the link opening into the installed app), and the first real week of use, which is where the day picker's thresholds will get adjusted.

## Lessons for the first real week
- The check-in is the whole data entry. Twenty seconds in the morning or it does not happen; if it feels longer than that, cut fields.
- Expect the first push day's band defaults to be wrong (the app starts everyone on the light gray). Pick the right band once; it remembers.
- The Happy Body clock is 25 minutes because the book says about 30 once learned and the warm-up and relaxation are outside it. Change it in `src/data/templates.ts` if the real pass runs longer.
