/**
 * Milestones. Earned things are never taken away. A missed day costs nothing but the chain, and the
 * chain starts again the next day. Resting on a red day and stopping on pain earn one too.
 */
import type { Achievement, CheckIn, Day, JournalEntry, Session, HabitLog, ActivityLog, WeighIn } from './types';
import { addDays, newId, nowIso, STRENGTH_KINDS } from './types';
import { chain } from './readiness';

export interface BadgeDef {
  key: string;
  title: string;
  text: string;
  test: (s: BadgeState) => boolean;
}

export interface BadgeState {
  sessions: Session[];
  checkIns: CheckIn[];
  journal: JournalEntry[];
  habits: HabitLog[];
  activity: ActivityLog[];
  weighIns: WeighIn[];
  day: Day;
}

const done = (s: BadgeState, kind?: Session['kind']) => s.sessions.filter((x) => x.status === 'done' && (!kind || x.kind === kind));
const bands = (s: BadgeState) => done(s).filter((x) => STRENGTH_KINDS.includes(x.kind));
const chainLen = (s: BadgeState) => chain(s.sessions, s.activity, s.day).length;

export const BADGES: BadgeDef[] = [
  { key: 'first-checkin', title: 'Checked in', text: 'First check-in. Knowing how you feel is the whole first step.', test: (s) => s.checkIns.length >= 1 },
  { key: 'first-day', title: 'Day one', text: 'Something done. The chain exists.', test: (s) => done(s).length >= 1 },
  { key: 'chain-7', title: 'Seven straight', text: 'A week without a zero. This is the habit you said you needed.', test: (s) => chainLen(s) >= 7 },
  { key: 'chain-30', title: 'Thirty straight', text: 'A month without a zero. It is who you are now.', test: (s) => chainLen(s) >= 30 },
  { key: 'chain-100', title: 'A hundred straight', text: 'A hundred days. Most people never see this number.', test: (s) => chainLen(s) >= 100 },
  { key: 'bands-10', title: 'Ten band days', text: 'Ten push and pull days in the book.', test: (s) => bands(s).length >= 10 },
  { key: 'bands-50', title: 'Fifty band days', text: 'Fifty. The bands are part of the furniture now.', test: (s) => bands(s).length >= 50 },
  { key: 'band-up', title: 'Next band', text: 'Moved up a band on a move. Forty clean reps, twice.', test: (s) => { const seen = new Map<string, number>(); for (const x of [...done(s)].sort((a, b) => a.day.localeCompare(b.day))) for (const i of x.items) { const st = i.sets.filter((q) => q.done).slice(-1)[0]; if (!st || !st.load.startsWith('band')) continue; const lvl = Number(st.load.slice(4)); const prev = seen.get(i.exerciseId); if (prev !== undefined && lvl > prev) return true; seen.set(i.exerciseId, lvl); } return false; } },
  { key: 'happy-10', title: 'Ten sequences', text: 'Ten Happy Body sessions. Slow and steady, like the book says.', test: (s) => done(s, 'happybody').length >= 10 },
  { key: 'floor-5', title: 'Floor days', text: 'Five days saved by the floor. Those are the days that make the chain.', test: (s) => done(s, 'floor').length >= 5 },
  { key: 'good-call', title: 'Good call', text: 'Took the easy day when the body asked for it.', test: (s) => s.checkIns.some((c) => c.color === 'orange' || c.color === 'red') },
  { key: 'stopped-smart', title: 'Stopped smart', text: 'Stopped because something did not feel right. Exactly right.', test: (s) => s.sessions.some((x) => x.status === 'stopped' && (x.stoppedReason === 'pain' || x.stoppedReason === 'sick')) },
  { key: 'walks-10', title: 'Ten walks', text: 'Ten walks logged. The most underrated workout there is.', test: (s) => done(s, 'walk').length + s.activity.filter((a) => a.activity === 'walk').length >= 10 },
  { key: 'journal-5', title: 'Noticing', text: 'Five notes. Paying attention is how it keeps getting better.', test: (s) => s.journal.length >= 5 },
  { key: 'habits-25', title: 'Habits', text: 'Twenty-five habit checks. Water, protein, sleep: the boring stuff that works.', test: (s) => s.habits.filter((h) => h.done).length >= 25 },
  { key: 'weigh-4', title: 'Four weigh-ins', text: 'A month of weekly weigh-ins. Trend, not the number.', test: (s) => s.weighIns.length >= 4 },
  { key: 'four-week', title: 'Four band days in a week', text: 'Four push and pull days in one week.', test: (s) => { for (let i = 0; i < 28; i++) { const end = addDays(s.day, -i); const start = addDays(end, -6); if (bands(s).filter((x) => x.day >= start && x.day <= end).length >= 4) return true; } return false; } }
];

/** Badges newly earned given current state; the caller saves them. */
export function newBadges(state: BadgeState, have: Achievement[]): Achievement[] {
  const owned = new Set(have.map((a) => a.key));
  const ts = nowIso();
  return BADGES.filter((b) => !owned.has(b.key) && b.test(state)).map((b) => ({ id: newId(), key: b.key, title: b.title, text: b.text, earnedAt: ts }));
}
