/**
 * The days. Editable templates, not prescriptions: shorten, skip, swap or postpone anything.
 * The engine picks one for today and always says why; every other one stays a tap away.
 */
import type { WorkoutTemplate } from '../engine/types';

export const TEMPLATES_VERSION = 1;
const TS = '2026-11-07T00:00:00.000Z';

const t = (x: Omit<WorkoutTemplate, 'source' | 'version' | 'createdAt' | 'updatedAt'>): WorkoutTemplate => ({ ...x, source: 'library', version: TEMPLATES_VERSION, createdAt: TS, updatedAt: TS });

export const LIBRARY_TEMPLATES: WorkoutTemplate[] = [
  t({
    id: 'push',
    name: 'Push day',
    kind: 'push',
    minutes: 25,
    summary: 'Chest press, overhead press, triceps, front squat. Bands. About 25 minutes with the warm-up.',
    items: [
      { exerciseId: 'wu-march', dose: { sets: 1, seconds: 60 } },
      { exerciseId: 'wu-pullapart', dose: { sets: 1, reps: 15 } },
      { exerciseId: 'wu-squat', dose: { sets: 1, reps: 12 } },
      { exerciseId: 'push-chest', dose: { sets: 1, reps: 15, repsMax: 40 } },
      { exerciseId: 'push-overhead', dose: { sets: 1, reps: 15, repsMax: 40 } },
      { exerciseId: 'push-triceps', dose: { sets: 1, reps: 15, repsMax: 40 } },
      { exerciseId: 'push-squat', dose: { sets: 1, reps: 15, repsMax: 40 } },
      { exerciseId: 'st-childpose', dose: { sets: 1, seconds: 60 }, optional: true }
    ]
  }),
  t({
    id: 'pull',
    name: 'Pull day',
    kind: 'pull',
    minutes: 25,
    summary: 'Deadlift, seated row, curls, rear delt pull-aparts, calf raises. Bands. About 25 minutes with the warm-up.',
    items: [
      { exerciseId: 'wu-march', dose: { sets: 1, seconds: 60 } },
      { exerciseId: 'wu-hinge', dose: { sets: 1, reps: 10 } },
      { exerciseId: 'wu-catcow', dose: { sets: 1, reps: 8 } },
      { exerciseId: 'pull-deadlift', dose: { sets: 1, reps: 15, repsMax: 40 } },
      { exerciseId: 'pull-row', dose: { sets: 1, reps: 15, repsMax: 40 } },
      { exerciseId: 'pull-curl', dose: { sets: 1, reps: 15, repsMax: 40 } },
      { exerciseId: 'pull-pullapart', dose: { sets: 2, reps: 15, repsMax: 30 } },
      { exerciseId: 'pull-calf', dose: { sets: 2, reps: 15, repsMax: 30 } },
      { exerciseId: 'st-childpose', dose: { sets: 1, seconds: 60 }, optional: true }
    ]
  }),
  t({
    id: 'happybody',
    name: 'Happy Body',
    kind: 'happybody',
    minutes: 32,
    summary: 'One slow pass through your sequence from the book (about 25 minutes, the app keeps the clock, the level and the weight), then five minutes flat on your back. Fine on any day, including the day after bands.',
    items: [
      { exerciseId: 'wu-march', dose: { sets: 1, seconds: 60 } },
      { exerciseId: 'hb-sequence', dose: { sets: 1, seconds: 1500 } },
      { exerciseId: 'hb-relax', dose: { sets: 1, seconds: 300 } }
    ]
  }),
  t({
    id: 'stretch',
    name: 'Stretch',
    kind: 'stretch',
    minutes: 12,
    summary: 'A short floor flow: downward dog, low lunge, hamstrings, open-book twist, 90/90, cobra, child\'s pose, then two minutes of slow breathing. About 12 minutes.',
    items: [
      { exerciseId: 'wu-catcow', dose: { sets: 1, reps: 8 } },
      { exerciseId: 'st-downdog', dose: { sets: 1, seconds: 40 } },
      { exerciseId: 'st-lunge', dose: { sets: 1, seconds: 40, perSide: true } },
      { exerciseId: 'st-hamstring', dose: { sets: 1, seconds: 40, perSide: true } },
      { exerciseId: 'st-thoracic', dose: { sets: 1, reps: 6, perSide: true } },
      { exerciseId: 'st-ninety', dose: { sets: 1, reps: 6, perSide: true } },
      { exerciseId: 'st-cobra', dose: { sets: 1, seconds: 30 } },
      { exerciseId: 'st-shoulder', dose: { sets: 1, reps: 10 }, optional: true },
      { exerciseId: 'st-childpose', dose: { sets: 1, seconds: 60 } },
      { exerciseId: 'br-box', dose: { sets: 1, seconds: 120 } }
    ]
  }),
  t({
    id: 'floor',
    name: 'The floor',
    kind: 'floor',
    minutes: 5,
    summary: 'The minimum that still counts: cat-cow, twenty squats, four minutes of slow breathing. Five minutes. For the days that have nothing in them.',
    items: [
      { exerciseId: 'wu-catcow', dose: { sets: 1, reps: 8 } },
      { exerciseId: 'floor-squat', dose: { sets: 1, reps: 20 } },
      { exerciseId: 'br-box', dose: { sets: 1, seconds: 240 } }
    ]
  }),
  t({
    id: 'walk',
    name: 'Walk',
    kind: 'walk',
    minutes: 20,
    summary: 'Twenty minutes out the door. Counts as the day.',
    items: [
      { exerciseId: 'walk-easy', dose: { sets: 1, seconds: 1200 } },
      { exerciseId: 'st-hamstring', dose: { sets: 1, seconds: 30, perSide: true }, optional: true }
    ]
  })
];
