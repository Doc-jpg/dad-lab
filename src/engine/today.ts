/**
 * The glue between the engines and the database: what Today needs, and the writes that follow a
 * check-in, a session, or a finished workout (flags, badges).
 */
import { db, addFlag, saveSession, updateSession, saveCheckIn, addJournal } from '../db/db';
import type { CheckIn, Day, Exercise, Session, ActivityLog, WorkoutTemplate, Achievement, Settings } from './types';
import { newId, nowIso } from './types';
import { assessReadiness, type Readiness } from './readiness';
import { buildSession, type BuildContext } from './program';
import { newBadges, type BadgeState } from './achievements';

export interface TodayContext {
  day: Day;
  checkIn?: CheckIn;
  activity: ActivityLog[];
  sessions: Session[];
  templates: WorkoutTemplate[];
  exercises: Map<string, Exercise>;
  settings: Settings;
}

export function readinessFor(ctx: TodayContext): Readiness {
  return assessReadiness({ day: ctx.day, checkIn: ctx.checkIn ?? null, activity: ctx.activity, sessions: ctx.sessions, settings: { strengthDaysPerWeek: ctx.settings.strengthDaysPerWeek } });
}

/** Record a check-in and any flag worth keeping. */
export async function recordCheckIn(input: Omit<CheckIn, 'id' | 'ts' | 'color'>, ctx: Omit<TodayContext, 'checkIn'>): Promise<{ checkIn: CheckIn; readiness: Readiness }> {
  const readiness = readinessFor({ ...ctx, checkIn: { ...input, id: 'tmp', ts: nowIso(), color: 'green' } });
  const checkIn = await saveCheckIn({ ...input, color: readiness.color });
  if (input.pain) await addFlag({ day: input.day, kind: 'pain', text: `Pain${input.painWhere ? `: ${input.painWhere}` : ''}.` });
  if (input.sick) await addFlag({ day: input.day, kind: 'sick', text: 'Sick day.' });
  for (const a of readiness.alerts) await addFlag({ day: input.day, kind: 'pain-streak', text: a });
  await refreshRewards(ctx.day);
  return { checkIn, readiness };
}

/** Make today's session from a template and the verdict, save it as planned, return it. */
export async function planSession(templateId: string, readiness: Readiness, ctx: TodayContext): Promise<Session> {
  const template = ctx.templates.find((t) => t.id === templateId);
  if (!template) throw new Error('Template not found');
  const bctx: BuildContext = { day: ctx.day, exercises: ctx.exercises, sessions: ctx.sessions, settings: { bandNames: ctx.settings.bandNames } };
  const { session } = buildSession(template, readiness, bctx);
  await saveSession(session);
  return session;
}

export async function finishSession(id: string, patch: Partial<Session>, day: Day): Promise<Achievement[]> {
  await updateSession(id, { ...patch, status: patch.status ?? 'done', finishedAt: nowIso(), live: undefined });
  const s = await db.sessions.get(id);
  if (s && patch.note?.trim()) await addJournal({ day, text: patch.note.trim(), sessionId: id });
  if (s?.status === 'stopped' && (s.stoppedReason === 'pain' || s.stoppedReason === 'sick')) {
    await addFlag({ day, kind: 'stopped', text: `Stopped ${s.templateName} because of ${s.stoppedReason === 'pain' ? 'pain' : 'feeling sick'}.` });
  }
  return refreshRewards(day, id);
}

/** Badges after anything changes. Returns the ones newly earned (and stamps them on the session if given). */
export async function refreshRewards(day: Day, sessionId?: string): Promise<Achievement[]> {
  const [sessions, checkIns, journal, habits, activity, weighIns, have] = await Promise.all([db.sessions.toArray(), db.checkIns.toArray(), db.journal.toArray(), db.habits.toArray(), db.activity.toArray(), db.weighIns.toArray(), db.achievements.toArray()]);
  const state: BadgeState = { sessions, checkIns, journal, habits, activity, weighIns, day };
  const earned = newBadges(state, have);
  if (earned.length) await db.achievements.bulkPut(earned);
  if (earned.length && sessionId) {
    const s = await db.sessions.get(sessionId);
    if (s) await db.sessions.update(sessionId, { achievements: [...(s.achievements ?? []), ...earned.map((e) => e.key)] });
  }
  return earned;
}

export async function ensureMessageShown(day: Day, key: string, category: string): Promise<void> {
  const existing = await db.messages.where('day').equals(day).first();
  if (existing) return;
  await db.messages.put({ id: newId(), day, key, category, ts: nowIso() });
}
