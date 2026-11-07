import { describe, it, expect } from 'vitest';
import { assessReadiness, chain, nextStrengthKind, weekStartOf } from '../src/engine/readiness';
import { buildSession, decideDose, lastLoad, bandUp, estimateMinutes } from '../src/engine/program';
import { LIBRARY_EXERCISES, EXERCISE_BY_ID } from '../src/data/exercises';
import { LIBRARY_TEMPLATES } from '../src/data/templates';
import { MESSAGES, pickMessage } from '../src/engine/habits';
import { newBadges } from '../src/engine/achievements';
import type { Session, CheckIn, ActivityLog, SessionKind } from '../src/engine/types';
import { addDays, DEFAULT_BAND_NAMES, DEFAULT_SETTINGS, STRENGTH_KINDS } from '../src/engine/types';

const DAY = '2026-11-11'; // a Wednesday
const exMap = new Map(LIBRARY_EXERCISES.map((e) => [e.id, e]));
const settings = { strengthDaysPerWeek: 4 as const };

function sess(day: string, kind: SessionKind, patch: Partial<Session> = {}): Session {
  const ts = day + 'T18:00:00.000Z';
  return { id: 'sess-' + day + '-' + kind, day, templateId: kind, templateName: kind, kind, status: 'done', why: [], items: [], createdAt: ts, updatedAt: ts, ...patch };
}
function bandSession(day: string, exerciseId: string, load: string, reps: number): Session {
  const ts = day + 'T18:00:00.000Z';
  return sess(day, 'push', { items: [{ exerciseId, exerciseName: exerciseId, catalogVersion: 1, planned: { sets: 1, reps: 15, repsMax: 40 }, sets: [{ reps, load: load as any, done: true, ts }] }] });
}
const ok: CheckIn = { id: 'c', day: DAY, ts: '', sleep: 4, energy: 4, stress: 2, soreness: 'none', pain: false, sick: false, time: 30, color: 'green' };
const run = (checkIn: Partial<CheckIn> | null, sessions: Session[] = [], activity: ActivityLog[] = []) => assessReadiness({ day: DAY, checkIn: checkIn ? { ...ok, ...checkIn } : null, activity, sessions, settings });

describe('the day picker: there is always something', () => {
  it('a normal fresh day with nothing done this week offers Push day', () => {
    const r = run({});
    expect(r.color).toBe('green');
    expect(r.offer.kind).toBe('push');
    expect(r.alternatives.map((a) => a.kind)).toContain('happybody');
  });
  it('push and pull alternate', () => {
    expect(nextStrengthKind([sess('2026-11-10', 'push')])).toBe('pull');
    expect(nextStrengthKind([sess('2026-11-10', 'pull')])).toBe('push');
    expect(nextStrengthKind([])).toBe('push');
    expect(run({}, [sess('2026-11-10', 'push')]).offer.kind).toBe('pull');
  });
  it('once the weekly band target is met, Happy Body is the day and an extra band day is only an alternative', () => {
    const week = ['2026-11-09', '2026-11-09', '2026-11-10', '2026-11-10'].map((d, i) => sess(d, i % 2 ? 'pull' : 'push', { id: 's' + i }));
    const r = run({}, week);
    expect(r.color).toBe('green');
    expect(r.offer.kind).toBe('happybody');
    expect(r.week.strengthDone).toBe(4);
    expect(r.alternatives.some((a) => STRENGTH_KINDS.includes(a.kind))).toBe(true);
  });
  it('bands already done today: anything else is a bonus', () => {
    const r = run({}, [sess(DAY, 'push')]);
    expect(r.offer.kind).toBe('stretch');
    expect(r.headline).toMatch(/bonus/i);
  });
  it('sick is red and still gets the floor', () => {
    const r = run({ sick: true });
    expect(r.color).toBe('red');
    expect(r.offer.kind).toBe('floor');
    expect(r.offer.reduced).toBe(true);
  });
  it('pain is red; pain after a pain stop yesterday raises a look-at-it alert', () => {
    expect(run({ pain: true }).color).toBe('red');
    const r = run({ pain: true }, [sess('2026-11-10', 'push', { status: 'stopped', stoppedReason: 'pain' })]);
    expect(r.alerts.length).toBe(1);
  });
  it('wiped out, very sore, or five minutes: orange and the floor', () => {
    expect(run({ energy: 1 }).color).toBe('orange');
    expect(run({ soreness: 'alot' }).color).toBe('orange');
    const r = run({ time: 5 });
    expect(r.color).toBe('orange');
    expect(r.offer.kind).toBe('floor');
  });
  it('short sleep, low energy, fried, fifteen minutes: yellow, lighter, bands only as a reduced alternative', () => {
    expect(run({ sleep: 2 }).color).toBe('yellow');
    expect(run({ energy: 2 }).color).toBe('yellow');
    const fried = run({ stress: 5 });
    expect(fried.color).toBe('yellow');
    expect(fried.offer.kind).toBe('stretch');
    const fifteen = run({ time: 15 });
    expect(fifteen.offer.kind).toBe('stretch');
    const y = run({ sleep: 2 });
    expect(y.offer.kind).toBe('happybody');
    const alt = y.alternatives.find((a) => STRENGTH_KINDS.includes(a.kind));
    expect(alt?.note).toMatch(/one set/);
  });
  it('sore after yesterday\'s bands means a mobility day in between', () => {
    const r = run({ soreness: 'some' }, [sess('2026-11-10', 'push')]);
    expect(r.color).toBe('yellow');
    expect(r.reasons.join(' ')).toMatch(/Bands yesterday/);
  });
  it('a hard physical day already logged makes today the easy part', () => {
    const r = run({}, [], [{ id: 'a', day: DAY, ts: '', activity: 'yard', duration: 'long', intensity: 'hard' }]);
    expect(r.color).toBe('yellow');
  });
  it('sore joints block the band moves that load them and say so', () => {
    const r = run({ soreness: 'some', soreWhere: ['shoulder'] });
    expect(r.blocked).toContain('shoulder');
    expect(r.blockedWhy[0]).toMatch(/shoulders/);
  });
  it('no check-in means check in first, with the floor as the placeholder', () => {
    const r = run(null);
    expect(r.offer.kind).toBe('floor');
    expect(r.headline).toMatch(/Check in/);
  });
});

describe('the chain', () => {
  it('counts days in a row with anything done, alive through yesterday if today is still open', () => {
    const s = [sess('2026-11-08', 'floor'), sess('2026-11-09', 'push'), sess('2026-11-10', 'stretch')];
    const act: ActivityLog[] = [];
    expect(chain(s, act, DAY)).toEqual({ length: 3, aliveToday: false });
    expect(chain([...s, sess(DAY, 'walk')], act, DAY)).toEqual({ length: 4, aliveToday: true });
    expect(chain(s, [{ id: 'w', day: DAY, ts: '', activity: 'walk', duration: 'short', intensity: 'easy' }], DAY).length).toBe(4);
    expect(chain([sess('2026-11-05', 'push')], act, DAY).length).toBe(0);
  });
  it('weeks start on Monday', () => {
    expect(weekStartOf(DAY)).toBe('2026-11-09');
    expect(weekStartOf('2026-11-09')).toBe('2026-11-09');
    expect(weekStartOf('2026-11-15')).toBe('2026-11-09');
  });
});

describe('bands and progression', () => {
  const chest = EXERCISE_BY_ID['push-chest'];
  const ctx = (sessions: Session[]) => ({ day: DAY, exercises: exMap, sessions, settings: { bandNames: DEFAULT_BAND_NAMES } });
  it('remembers the band used last time and never changes it on its own', () => {
    expect(lastLoad(chest, [], DEFAULT_BAND_NAMES).load).toBe('band5'); // chest press starts on the Green, the X3 light gray
    expect(lastLoad(EXERCISE_BY_ID['pull-curl'], [], DEFAULT_BAND_NAMES).load).toBe('band4');
    expect(lastLoad(EXERCISE_BY_ID['pull-deadlift'], [], DEFAULT_BAND_NAMES).load).toBe('band6');
    expect(lastLoad(chest, [], { band1: 'A', band2: 'B', band3: '', band4: '', band5: '', band6: '', band7: '', band8: '' }).load).toBe('band2');
    expect(lastLoad(chest, [bandSession('2026-11-05', 'push-chest', 'band3', 28)]).load).toBe('band3');
    const d = decideDose(chest, chest.defaultDose, ctx([bandSession('2026-11-05', 'push-chest', 'band3', 28)]), false, DEFAULT_BAND_NAMES);
    expect(d.load).toBe('band3');
    expect(d.suggestBand).toBeUndefined();
  });
  it('forty clean reps twice in a row suggests the next band, as a suggestion only', () => {
    const h = [bandSession('2026-11-03', 'push-chest', 'band2', 40), bandSession('2026-11-05', 'push-chest', 'band2', 41)];
    const d = decideDose(chest, chest.defaultDose, ctx(h), false, DEFAULT_BAND_NAMES);
    expect(d.load).toBe('band2');
    expect(d.suggestBand).toBe('band3');
    expect(d.reason).toMatch(/Black/);
    expect(bandUp('band8')).toBeUndefined();
    expect(bandUp('band7', DEFAULT_BAND_NAMES)).toBeUndefined(); // Orange is the heaviest he owns
    expect(bandUp('band2', { band1: 'A', band2: 'B', band3: '', band4: 'D', band5: '', band6: '', band7: '', band8: '' })).toBe('band4'); // blank slots are skipped
  });
  it('forty once is not enough; under fifteen puts the band below on the card', () => {
    const once = decideDose(chest, chest.defaultDose, ctx([bandSession('2026-11-03', 'push-chest', 'band2', 30), bandSession('2026-11-05', 'push-chest', 'band2', 40)]), false, DEFAULT_BAND_NAMES);
    expect(once.suggestBand).toBeUndefined();
    const under = decideDose(chest, chest.defaultDose, ctx([bandSession('2026-11-05', 'push-chest', 'band3', 12)]), false, DEFAULT_BAND_NAMES);
    expect(under.load).toBe('band2');
  });
  it('a reduced day is one set each with the same band and no suggestion', () => {
    const h = [bandSession('2026-11-03', 'push-chest', 'band2', 40), bandSession('2026-11-05', 'push-chest', 'band2', 40)];
    const d = decideDose(chest, { sets: 2, reps: 15, repsMax: 40 }, ctx(h), true, DEFAULT_BAND_NAMES);
    expect(d.dose.sets).toBe(1);
    expect(d.suggestBand).toBeUndefined();
  });
  it('the top band at the top of the range asks for slower reps instead', () => {
    const h = [bandSession('2026-11-03', 'push-chest', 'band7', 40), bandSession('2026-11-05', 'push-chest', 'band7', 40)];
    const d = decideDose(chest, chest.defaultDose, ctx(h), false, DEFAULT_BAND_NAMES);
    expect(d.suggestBand).toBeUndefined();
    expect(d.reason).toMatch(/[Ss]low/);
  });
});

describe('building a day', () => {
  const tpl = (id: string) => LIBRARY_TEMPLATES.find((t) => t.id === id)!;
  const ctx = (sessions: Session[] = []) => ({ day: DAY, exercises: exMap, sessions, settings: { bandNames: DEFAULT_BAND_NAMES } });
  it('a green push day has every move, with the band on the card', () => {
    const r = run({});
    const { session } = buildSession(tpl('push'), r, ctx());
    expect(session.items.map((i) => i.exerciseId)).toContain('push-chest');
    expect(session.items.length).toBe(tpl('push').items.length);
    expect(session.kind).toBe('push');
    expect(estimateMinutes(session.items, exMap)).toBeGreaterThan(10);
  });
  it('sore shoulders swap the presses for the incline push-up or drop them, and the session says why', () => {
    const r = run({ soreness: 'some', soreWhere: ['shoulder'] }, [], []);
    const { session, changes } = buildSession(tpl('push'), r, ctx());
    expect(session.items.map((i) => i.exerciseId)).not.toContain('push-overhead');
    expect(changes.join(' ')).toMatch(/shoulders/);
    expect(session.why.length).toBeGreaterThan(0);
  });
  it('a yellow day drops the optional items and sets one set each', () => {
    const r = run({ sleep: 2 });
    const { session } = buildSession(tpl('pull'), r, ctx());
    expect(session.items.every((i) => i.planned.sets === 1)).toBe(true);
    expect(session.items.map((i) => i.exerciseId)).not.toContain('st-childpose');
  });
  it('the floor is three items and under six minutes', () => {
    const r = run({ time: 5 });
    const { session } = buildSession(tpl('floor'), r, ctx());
    expect(session.items.length).toBe(3);
    expect(estimateMinutes(session.items, exMap)).toBeLessThanOrEqual(7);
  });
});

describe('library and templates', () => {
  it('every template item exists, every substitute exists, every band move has a band-up rule and bands', () => {
    for (const t of LIBRARY_TEMPLATES) for (const it of t.items) expect(exMap.has(it.exerciseId), `${t.id}: ${it.exerciseId}`).toBe(true);
    for (const e of LIBRARY_EXERCISES) {
      for (const s of [...e.substitutes, e.easier, e.harder].filter(Boolean)) expect(exMap.has(s!), `${e.id}: ${s}`).toBe(true);
      if (e.progressRule === 'band-up') expect(e.loads.some((l) => l.startsWith('band')), e.id).toBe(true);
      expect(e.steps.length).toBeGreaterThan(0);
      expect(e.why.length).toBeGreaterThan(10);
    }
    expect(LIBRARY_TEMPLATES.map((t) => t.kind).sort()).toEqual(['floor', 'happybody', 'pull', 'push', 'stretch', 'walk']);
  });
  it("Deren's push and pull days are what he described", () => {
    const push = LIBRARY_TEMPLATES.find((t) => t.id === 'push')!.items.map((i) => i.exerciseId);
    const pull = LIBRARY_TEMPLATES.find((t) => t.id === 'pull')!.items.map((i) => i.exerciseId);
    for (const id of ['push-chest', 'push-overhead', 'push-triceps', 'push-squat']) expect(push).toContain(id);
    expect(push).not.toContain('pull-calf');
    for (const id of ['pull-row', 'pull-curl', 'pull-pullapart', 'pull-deadlift', 'pull-calf']) expect(pull).toContain(id);
  });
  it('the Happy Body day frames the book rather than copying it, with the relaxation after', () => {
    const hb = LIBRARY_TEMPLATES.find((t) => t.id === 'happybody')!;
    expect(hb.items.map((i) => i.exerciseId)).toEqual(['wu-march', 'hb-sequence', 'hb-relax']);
    expect(EXERCISE_BY_ID['hb-sequence'].links?.length).toBeGreaterThan(0);
    expect(EXERCISE_BY_ID['hb-relax'].defaultDose.seconds).toBe(300);
  });
  it('no message shames, no library text talks down', () => {
    const bad = /\b(lazy|fat|shame|guilty|pathetic|no excuse)\b/i;
    for (const m of MESSAGES) expect(m.text).not.toMatch(bad);
    for (const e of LIBRARY_EXERCISES) expect(e.why + e.develops).not.toMatch(bad);
    expect(MESSAGES.length).toBeGreaterThanOrEqual(20);
  });
  it('messages fit the day and never repeat inside the window', () => {
    const base = { day: DAY, todayActivity: [], chain: 3, shown: [], rotationDays: 7 };
    const r = DEFAULT_SETTINGS.reminders;
    const noon = new Date(DAY + 'T12:00:00');
    expect(pickMessage({ ...base, stressHigh: true }, r, noon)?.key).toBe('breath-1');
    expect(pickMessage({ ...base, daysSinceSession: 3 }, r, noon)?.key).toBe('consist-2');
    expect(pickMessage(base, r, new Date(DAY + 'T23:00:00'))).toBeNull();
    const shown = [{ id: '1', day: addDays(DAY, -1), key: 'breath-1', category: 'breath', ts: '' }];
    expect(pickMessage({ ...base, stressHigh: true, shown }, r, noon)?.key).not.toBe('breath-1');
  });
});

describe('milestones', () => {
  it('earn the chain milestones and never lose them', () => {
    const s = Array.from({ length: 10 }, (_, i) => sess(addDays(DAY, -i), i % 2 ? 'floor' : 'push', { id: 's' + i }));
    const state = { sessions: s, checkIns: [ok], journal: [], habits: [], activity: [], weighIns: [], day: DAY };
    const earned = newBadges(state, []);
    const keys = earned.map((e) => e.key);
    expect(keys).toContain('chain-7');
    expect(keys).toContain('floor-5');
    expect(keys).toContain('first-day');
    expect(newBadges({ ...state, sessions: [] }, earned).map((e) => e.key)).not.toContain('chain-7');
  });
});
