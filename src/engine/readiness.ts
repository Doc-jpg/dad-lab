/**
 * The day picker. Pure function: today's check-in, other activity, and the last couple of weeks of
 * sessions in; a color, the reasons, the sore joints to leave alone, and the day it offers out.
 *
 * The one rule that never relaxes: there is always something. Red still gets the floor.
 *   RED     sick, or sharp pain: the floor (breathing, maybe a walk). Pain two days running gets a nudge to get it looked at.
 *   ORANGE  very sore, or wiped out, or five minutes: the floor, or a walk.
 *   YELLOW  short sleep, low energy, fried, fifteen minutes, or bands yesterday with a sore body: stretch or Happy Body;
 *           bands allowed but one set each and no band up.
 *   GREEN   the planned day: the next band day if one is owed this week, otherwise Happy Body.
 * Sore joints (from the check-in) block the band moves that load them; the move swaps or sits out.
 */
import type { CheckIn, ActivityLog, Session, LoadTag, ReadinessColor, Day, SessionKind, Settings } from './types';
import { addDays, daysBetween, STRENGTH_KINDS } from './types';

export interface ReadinessInput {
  day: Day;
  checkIn?: Pick<CheckIn, 'energy' | 'sleep' | 'stress' | 'soreness' | 'soreWhere' | 'pain' | 'sick' | 'time'> | null;
  activity: ActivityLog[];
  sessions: Session[];
  settings: Pick<Settings, 'strengthDaysPerWeek'>;
}

export interface Readiness {
  color: ReadinessColor;
  headline: string;
  reasons: string[];
  blocked: LoadTag[];
  blockedWhy: string[];
  /** The day the app offers. Reduced means one set each and no band up. */
  offer: { templateId: string; name: string; kind: SessionKind; reduced: boolean };
  /** Other days that fit today, best first, with a word on each. */
  alternatives: Array<{ templateId: string; kind: SessionKind; note: string }>;
  /** What the week looks like so far. */
  week: { strengthDone: number; strengthTarget: number; activeDays: number; weekStart: Day };
  alerts: string[];
}

const DUR = { short: 1, medium: 2, long: 3 } as const;
const INT = { easy: 1, medium: 2, hard: 3 } as const;

export function activityLoad(a: ActivityLog): number {
  return DUR[a.duration] * INT[a.intensity];
}

/** Sunday is the first day of the week here. */
export function weekStartOf(day: Day): Day {
  const d = new Date(day + 'T12:00:00');
  return addDays(day, -d.getDay());
}

const NAMES: Record<SessionKind, string> = { push: 'Push day', pull: 'Pull day', happybody: 'Happy Body', stretch: 'Stretch', floor: 'The floor', walk: 'Walk' };

/** Which band day is next: the opposite of the last one done. Push first. */
export function nextStrengthKind(sessions: Session[]): 'push' | 'pull' {
  const done = sessions.filter((s) => s.status === 'done' && STRENGTH_KINDS.includes(s.kind)).sort((a, b) => (b.day + b.createdAt).localeCompare(a.day + a.createdAt));
  if (!done.length) return 'push';
  return done[0].kind === 'push' ? 'pull' : 'push';
}

export function assessReadiness(input: ReadinessInput): Readiness {
  const { day, checkIn, activity, sessions, settings } = input;
  const yesterday = addDays(day, -1);
  const reasons: string[] = [];
  const alerts: string[] = [];
  const blocked = new Set<LoadTag>();
  const blockedWhy: string[] = [];
  const ws = weekStartOf(day);
  const weekSessions = sessions.filter((s) => s.status === 'done' && s.day >= ws && s.day <= day);
  const strengthDone = weekSessions.filter((s) => STRENGTH_KINDS.includes(s.kind)).length;
  const activeDays = new Set([...weekSessions.map((s) => s.day), ...activity.filter((a) => a.day >= ws && a.day <= day).map((a) => a.day)]).size;
  const strengthTarget = settings.strengthDaysPerWeek;
  const doneToday = sessions.some((s) => s.status === 'done' && s.day === day);
  const bandsYesterday = sessions.some((s) => s.status === 'done' && s.day === yesterday && STRENGTH_KINDS.includes(s.kind));
  const bandsToday = sessions.some((s) => s.status === 'done' && s.day === day && STRENGTH_KINDS.includes(s.kind));
  const hardYesterday = activity.filter((a) => a.day === yesterday).reduce((s, a) => s + activityLoad(a), 0) >= 6;
  const hardToday = activity.filter((a) => a.day === day).reduce((s, a) => s + activityLoad(a), 0) >= 6;
  const nextKind = nextStrengthKind(sessions);
  const week = { strengthDone, strengthTarget, activeDays, weekStart: ws };

  // Sore joints block the moves that load them.
  for (const t of checkIn?.soreWhere ?? []) {
    blocked.add(t);
  }
  if (blocked.size) blockedWhy.push(`Sore ${[...blocked].map((t) => ({ shoulder: 'shoulders', elbow: 'elbows', back: 'back', knee: 'knees', hip: 'hips', wrist: 'wrists' })[t]).join(' and ')}: the band moves that load them swap out or sit out today.`);

  const out = (color: ReadinessColor, headline: string, offerKind: SessionKind, reduced: boolean, alts: Array<[SessionKind, string]>): Readiness => ({
    color, headline, reasons, blocked: [...blocked], blockedWhy, week, alerts,
    offer: { templateId: offerKind, name: NAMES[offerKind], kind: offerKind, reduced },
    alternatives: alts.map(([kind, note]) => ({ templateId: kind, kind, note }))
  });

  if (!checkIn) {
    reasons.push('No check-in yet today.');
    return out('green', 'Check in first', 'floor', false, []);
  }

  // RED: sick or pain. The floor still happens.
  if (checkIn.sick) {
    reasons.push('Feeling sick. The body is busy; four minutes of breathing is the day.');
    if (hardYesterday) reasons.push('Yesterday was a hard day on top of it.');
    return out('red', 'Breathe, that is the day', 'floor', true, [['walk', 'A slow walk if you are up for air']]);
  }
  if (checkIn.pain) {
    reasons.push('Something hurts, not just sore. Nothing loads it today.');
    const painYesterday = sessions.some((s) => s.day === yesterday && s.status === 'stopped' && s.stoppedReason === 'pain');
    if (painYesterday) alerts.push('Pain two days in a row. Worth getting looked at rather than training around it.');
    return out('red', 'Easy day: breathe and walk', 'floor', true, [['walk', 'Walking is fine if it does not hurt'], ['stretch', 'Only the shapes that feel good; skip anything that pinches']]);
  }

  // ORANGE: wiped out, very sore, or five minutes. Something small.
  const five = checkIn.time === 5;
  if (checkIn.energy === 1 || checkIn.soreness === 'alot' || five) {
    if (checkIn.energy === 1) reasons.push('Wiped out. The floor keeps the chain alive and costs nothing.');
    if (checkIn.soreness === 'alot') reasons.push('Very sore. Muscles grow on the rest day; moving a little helps them along.');
    if (five) reasons.push('Five minutes is the budget, so the five-minute day it is.');
    if (hardYesterday) reasons.push('Yesterday was a hard physical day too.');
    return out('orange', 'The floor', 'floor', true, [['walk', 'A walk counts the same'], ['stretch', 'If you find twelve minutes later']]);
  }

  // YELLOW: short sleep, low energy, fried, fifteen minutes, or bands yesterday and a sore body.
  const tired = checkIn.sleep <= 2 || checkIn.energy === 2;
  const fried = checkIn.stress >= 4;
  const fifteen = checkIn.time === 15;
  const soreAfterBands = bandsYesterday && checkIn.soreness === 'some';
  if (tired || fried || fifteen || soreAfterBands || hardToday || (hardYesterday && checkIn.soreness === 'some')) {
    if (checkIn.sleep <= 2) reasons.push('Short night. Heavy bands on short sleep is where tweaks happen; a lighter day keeps the habit without the risk.');
    if (checkIn.energy === 2) reasons.push('Energy is low. Lighter day; it will be back tomorrow.');
    if (fried) reasons.push('Stress is high. The stretch and breathing day does more for that than another hard set.');
    if (fifteen) reasons.push('Fifteen minutes fits the stretch flow.');
    if (soreAfterBands) reasons.push('Bands yesterday and a bit sore: a mobility day in between helps the next band day.');
    if (hardToday) reasons.push('A hard physical day already happened; this is the easy part.');
    if (hardYesterday && checkIn.soreness === 'some') reasons.push('Yesterday was hard and you feel it; lighter today.');
    const offerKind: SessionKind = fifteen || fried ? 'stretch' : 'happybody';
    const alts: Array<[SessionKind, string]> = [];
    if (offerKind !== 'stretch') alts.push(['stretch', 'Shorter, if the time is tight']);
    if (offerKind !== 'happybody' && !fifteen) alts.push(['happybody', 'The slow sequence, fine on a tired day']);
    if (!bandsToday && !bandsYesterday && strengthDone < strengthTarget) alts.push([nextKind, 'If you want it anyway: one set each, no band up today']);
    alts.push(['walk', 'A walk counts the same']);
    return out('yellow', 'Lighter today', offerKind, true, alts);
  }

  // GREEN: the planned day.
  const owed = strengthDone < strengthTarget;
  const thirty = checkIn.time === 30;
  if (owed && !bandsToday) {
    reasons.push(`${NAMES[nextKind]} is next (${strengthDone} of ${strengthTarget} band days done this week).`);
    if (bandsYesterday) reasons.push('Bands yesterday too; the other half of the body is fresh, which is the point of push and pull.');
    if (checkIn.sleep >= 4 && checkIn.energy >= 4) reasons.push('Slept and feeling good: a day to push the reps.');
    const alts: Array<[SessionKind, string]> = [['happybody', 'The slow sequence instead, if the bands can wait'], ['stretch', 'Twelve minutes, if that is what there is'], ['walk', 'Counts the same']];
    return out('green', NAMES[nextKind], nextKind, false, alts);
  }
  if (bandsToday) {
    reasons.push('Bands are done today. Anything else is a bonus.');
    return out('green', 'Bonus round', 'stretch', false, [['walk', 'Counts the same'], ['happybody', 'If you have thirty minutes']]);
  }
  reasons.push(`Band days are done for the week (${strengthDone} of ${strengthTarget}). Happy Body keeps the chain going.`);
  if (thirty) reasons.push('Thirty minutes is exactly the sequence.');
  const alts: Array<[SessionKind, string]> = [['stretch', 'Shorter'], ['walk', 'Counts the same']];
  if (strengthTarget < 6) alts.push([nextKind, 'An extra band day is allowed if you feel great']);
  return out('green', 'Happy Body', 'happybody', false, alts);
}

/** Days in a row with something done, ending today or yesterday. */
export function chain(sessions: Session[], activity: ActivityLog[], day: Day): { length: number; aliveToday: boolean } {
  const days = new Set([...sessions.filter((s) => s.status === 'done').map((s) => s.day), ...activity.map((a) => a.day)]);
  const aliveToday = days.has(day);
  let d = aliveToday ? day : addDays(day, -1);
  let n = 0;
  while (days.has(d)) { n += 1; d = addDays(d, -1); }
  return { length: n, aliveToday };
}

export function daysSince(sessions: Session[], day: Day): number | undefined {
  const done = sessions.filter((s) => s.status === 'done' && s.day <= day).map((s) => s.day).sort();
  if (!done.length) return undefined;
  return daysBetween(done[done.length - 1], day);
}

export const COLOR_WORDS: Record<ReadinessColor, string> = { green: 'Green', yellow: 'Yellow', orange: 'Orange', red: 'Red' };
