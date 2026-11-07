import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSettings } from '../db/db';
import type { Profile, Settings, Exercise, WorkoutTemplate, Session, ActivityLog, CheckIn, SafetyFlag, JournalEntry, HabitLog, MessageShown, Achievement, WeighIn, Day } from '../engine/types';
import { DEFAULT_SETTINGS, todayDay } from '../engine/types';

export function useSettings(): Settings {
  return useLiveQuery(() => getSettings(), [], DEFAULT_SETTINGS) ?? DEFAULT_SETTINGS;
}
export function useProfile(): Profile | undefined | null {
  // null while loading, undefined when there is no profile yet
  const a = useLiveQuery(async () => (await db.profile.get('me')) ?? undefined, [], null as Profile | null | undefined);
  return a;
}
export function useExercises(): Exercise[] {
  return useLiveQuery(() => db.exercises.toArray(), [], []) ?? [];
}
export function useExerciseMap(): Map<string, Exercise> {
  const list = useExercises();
  return useMemo(() => new Map(list.map((e) => [e.id, e])), [list]);
}
export function useExercise(id?: string): Exercise | undefined {
  return useLiveQuery(() => (id ? db.exercises.get(id) : undefined), [id]);
}
export function useTemplates(): WorkoutTemplate[] {
  return useLiveQuery(() => db.templates.toArray(), [], []) ?? [];
}
export function useTemplate(id?: string): WorkoutTemplate | undefined {
  return useLiveQuery(() => (id ? db.templates.get(id) : undefined), [id]);
}
export function useSessions(): Session[] {
  return useLiveQuery(async () => (await db.sessions.toArray()).sort((a, b) => (b.day + b.createdAt).localeCompare(a.day + a.createdAt)), [], []) ?? [];
}
export function useSession(id?: string): Session | undefined {
  return useLiveQuery(() => (id ? db.sessions.get(id) : undefined), [id]);
}
export function useActivity(): ActivityLog[] {
  return useLiveQuery(async () => (await db.activity.toArray()).sort((a, b) => (b.day + b.ts).localeCompare(a.day + a.ts)), [], []) ?? [];
}
export function useWeighIns(): WeighIn[] {
  return useLiveQuery(async () => (await db.weighIns.toArray()).sort((a, b) => a.day.localeCompare(b.day)), [], []) ?? [];
}
export function useCheckIns(): CheckIn[] {
  return useLiveQuery(async () => (await db.checkIns.toArray()).sort((a, b) => b.day.localeCompare(a.day)), [], []) ?? [];
}
export function useFlags(): SafetyFlag[] {
  return useLiveQuery(async () => (await db.flags.toArray()).sort((a, b) => b.ts.localeCompare(a.ts)), [], []) ?? [];
}
export function useJournal(): JournalEntry[] {
  return useLiveQuery(async () => (await db.journal.toArray()).sort((a, b) => b.ts.localeCompare(a.ts)), [], []) ?? [];
}
export function useHabits(): HabitLog[] {
  return useLiveQuery(() => db.habits.toArray(), [], []) ?? [];
}
export function useMessagesShown(): MessageShown[] {
  return useLiveQuery(() => db.messages.toArray(), [], []) ?? [];
}
export function useAchievements(): Achievement[] {
  return useLiveQuery(async () => (await db.achievements.toArray()).sort((a, b) => b.earnedAt.localeCompare(a.earnedAt)), [], []) ?? [];
}
export function useMeta(key: string): unknown {
  return useLiveQuery(async () => (await db.meta.get(key))?.value, [key]);
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** Today's date, refreshed when the app comes back to the foreground past midnight. */
export function useToday(): Day {
  const [day, setDay] = useState(todayDay());
  useEffect(() => {
    const check = () => setDay(todayDay());
    document.addEventListener('visibilitychange', check);
    const t = window.setInterval(check, 60000);
    return () => { document.removeEventListener('visibilitychange', check); window.clearInterval(t); };
  }, []);
  return day;
}

export function fmtDate(d: string): string {
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
export function fmtDateLong(d: string): string {
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}
export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86400000);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 14) return `${d} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
export function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
