/**
 * One short message a day, chosen by what today looks like, never repeated inside the rotation
 * window, never in quiet hours. Written for a grown man who already knows the rules: no cheerleading.
 */
import type { Day, MessageShown, Reminders, ReadinessColor, Session, ActivityLog } from './types';
import { addDays } from './types';

export type MessageCategory = 'sleep' | 'food' | 'recovery' | 'consistency' | 'posture' | 'breath' | 'strength' | 'perspective';

export interface MessageContext {
  day: Day;
  color?: ReadinessColor;
  todayActivity: ActivityLog[];
  chain: number;
  daysSinceSession?: number;
  sleepLow?: boolean;
  stressHigh?: boolean;
  bandsToday?: boolean;
  shown: MessageShown[];
  rotationDays: number;
  seed?: number;
}

interface Msg {
  key: string;
  category: MessageCategory;
  text: string;
  fit: (c: MessageContext) => number;
}

const any = () => 1;

export const MESSAGES: Msg[] = [
  { key: 'sleep-1', category: 'sleep', text: 'Short night. The workout is not the problem today; bedtime is. Lighter day, earlier night.', fit: (c) => (c.sleepLow ? 4 : 0) },
  { key: 'sleep-2', category: 'sleep', text: 'Muscle is built in bed, not under the band. Seven hours is part of the program.', fit: (c) => (c.bandsToday ? 2 : 1) },
  { key: 'sleep-3', category: 'sleep', text: 'Screens off thirty minutes before bed is the cheapest sleep upgrade there is.', fit: any },
  { key: 'food-1', category: 'food', text: 'Protein at every meal, a palm of it. The rest sorts itself out more than you would think.', fit: any },
  { key: 'food-2', category: 'food', text: 'Water first thing, before the coffee, and 16 ounces somewhere between meals. Most afternoon tiredness is a glass of water short.', fit: any },
  { key: 'food-3', category: 'food', text: 'The Happy Body eats on a clock: two meals and three snacks, three hours apart, the snack even when you are not hungry. Protein and about twice its weight in vegetables.', fit: any },
  { key: 'food-4', category: 'food', text: 'Nothing heavy in the two hours before bed. Sleep is better and so is the morning.', fit: any },
  { key: 'food-5', category: 'food', text: 'The book\'s pace is a pound or two a week and keep it. Faster than that is water and muscle, and it comes back.', fit: any },
  { key: 'recovery-1', category: 'recovery', text: 'Sore is not hurt. Sore gets a walk and a stretch; hurt gets rest and a look.', fit: (c) => (c.color === 'orange' ? 4 : 1) },
  { key: 'recovery-2', category: 'recovery', text: 'A rest day with five minutes on the floor is still a day in the chain. That is the whole trick.', fit: (c) => (c.color === 'red' || c.color === 'orange' ? 4 : 1) },
  { key: 'recovery-3', category: 'recovery', text: 'The day after bands is when the muscle actually gets built. Move a little, eat, sleep.', fit: (c) => (c.daysSinceSession === 1 && !c.bandsToday ? 3 : 1) },
  { key: 'consist-1', category: 'consistency', text: 'The goal was never a great workout. It was a workout. Seven small ones beat three big ones and four zeros.', fit: (c) => (c.chain >= 3 ? 2 : 3) },
  { key: 'consist-2', category: 'consistency', text: 'Missed yesterday? Fine. The chain starts again today; nobody is counting but you.', fit: (c) => (c.daysSinceSession !== undefined && c.daysSinceSession >= 2 ? 5 : 0) },
  { key: 'consist-3', category: 'consistency', text: 'Four weeks of anything is where it stops being effort. You are closer than it feels.', fit: (c) => (c.chain >= 7 && c.chain < 28 ? 3 : 1) },
  { key: 'consist-4', category: 'consistency', text: 'Travel day? The floor and a walk fit in any hotel room. Bands fit in a carry-on.', fit: any },
  { key: 'posture-1', category: 'posture', text: 'Every pull-apart is a deposit against the hours bent over a chair. Keep making them.', fit: any },
  { key: 'posture-2', category: 'posture', text: 'Between patients: shoulders back and down, chin in, three slow breaths. Costs nothing.', fit: any },
  { key: 'posture-3', category: 'posture', text: 'Open-book twists tonight. The mid-back is where dentists lose it first.', fit: any },
  { key: 'breath-1', category: 'breath', text: 'Stressed is a reason to do the stretch day, not a reason to skip. Four minutes of slow breathing changes the evening.', fit: (c) => (c.stressHigh ? 5 : 1) },
  { key: 'breath-2', category: 'breath', text: 'Five minutes flat on the floor after the sequence, same music every time. The book treats it as part of the workout, and the body learns the cue.', fit: any },
  { key: 'strength-1', category: 'strength', text: 'Slow reps. Three seconds out, three back. The band does not care how fast you move; the joints do.', fit: (c) => (c.bandsToday ? 4 : 1) },
  { key: 'strength-2', category: 'strength', text: 'Forty clean reps twice means the next band. Not thirty-eight ugly ones once.', fit: (c) => (c.bandsToday ? 3 : 1) },
  { key: 'strength-3', category: 'strength', text: 'Legs are the biggest lever: metabolism, bone, balance at 80. Do not skip the squat day because the chest day is more fun.', fit: any },
  { key: 'persp-1', category: 'perspective', text: 'Eli watches what you do, not what you say about it. Today counts twice.', fit: any },
  { key: 'persp-2', category: 'perspective', text: 'The point is to be the 70-year-old who still gets on the floor with the grandkids. Every day is a vote.', fit: any },
  { key: 'persp-3', category: 'perspective', text: 'You do not have to feel like it. You have to do five minutes. Feeling like it usually shows up around minute three.', fit: (c) => (c.color === 'yellow' ? 3 : 1) }
];

function inQuietHours(now: Date, r: Reminders): boolean {
  const [qsH, qsM] = r.quietStart.split(':').map(Number);
  const [qeH, qeM] = r.quietEnd.split(':').map(Number);
  const qs = qsH * 60 + qsM;
  const qe = qeH * 60 + qeM;
  const cur = now.getHours() * 60 + now.getMinutes();
  return qs > qe ? cur >= qs || cur < qe : cur >= qs && cur < qe;
}

/** The message for today, or null in quiet hours or when reminders are off. Stable for a day once chosen (via `shown`). */
export function pickMessage(ctx: MessageContext, reminders: Reminders, now: Date = new Date()): Msg | null {
  if (!reminders.enabled) return null;
  const already = ctx.shown.find((m) => m.day === ctx.day);
  if (already) return MESSAGES.find((m) => m.key === already.key) ?? null;
  if (inQuietHours(now, reminders)) return null;
  const since = addDays(ctx.day, -ctx.rotationDays);
  const recent = new Set(ctx.shown.filter((m) => m.day > since).map((m) => m.key));
  const recentCats = ctx.shown.filter((m) => m.day > addDays(ctx.day, -2)).map((m) => m.category);
  const scored = MESSAGES.filter((m) => !recent.has(m.key)).map((m) => ({ m, s: m.fit(ctx) - (recentCats.includes(m.category) ? 0.5 : 0) })).filter((x) => x.s > 0);
  if (!scored.length) return MESSAGES.find((m) => !recent.has(m.key)) ?? MESSAGES[0];
  scored.sort((a, b) => b.s - a.s);
  const top = scored.filter((x) => x.s === scored[0].s);
  const seed = ctx.seed ?? ctx.day.split('-').reduce((a, b) => a + Number(b), 0);
  return top[seed % top.length].m;
}

export const CATEGORY_WORDS: Record<MessageCategory, string> = { sleep: 'Sleep', food: 'Food', recovery: 'Recovery', consistency: 'Consistency', posture: 'Posture', breath: 'Breathing', strength: 'Strength', perspective: 'Why' };

export function daysSinceLastSession(sessions: Session[], day: Day): number | undefined {
  const last = sessions.filter((s) => s.status === 'done' && s.day <= day).sort((a, b) => b.day.localeCompare(a.day))[0];
  if (!last) return undefined;
  return Math.round((new Date(day + 'T12:00:00').getTime() - new Date(last.day + 'T12:00:00').getTime()) / 86400000);
}
