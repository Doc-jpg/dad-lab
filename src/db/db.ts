/**
 * Storage: one IndexedDB database named "dad-lab". Athletic Lab uses "athletic-lab", Dugout Dad
 * "dugout-dad", Dugout Lab "dugout-lab"; none of them touch each other. Schema versions are explicit;
 * data written by version 1 opens in every later version.
 */
import Dexie, { type Table } from 'dexie';
import type { Profile, Settings, Exercise, WorkoutTemplate, Session, ActivityLog, CheckIn, SafetyFlag, JournalEntry, HabitLog, MessageShown, Achievement, WeighIn, Tombstone, Day } from '../engine/types';
import { DEFAULT_SETTINGS, newId, nowIso, todayDay } from '../engine/types';
import { LIBRARY_EXERCISES, CATALOG_VERSION } from '../data/exercises';
import { LIBRARY_TEMPLATES, TEMPLATES_VERSION } from '../data/templates';

export interface Meta {
  key: string;
  value: unknown;
}

export class DadLabDB extends Dexie {
  profile!: Table<Profile, string>;
  settings!: Table<Settings, string>;
  exercises!: Table<Exercise, string>;
  templates!: Table<WorkoutTemplate, string>;
  sessions!: Table<Session, string>;
  activity!: Table<ActivityLog, string>;
  checkIns!: Table<CheckIn, string>;
  flags!: Table<SafetyFlag, string>;
  journal!: Table<JournalEntry, string>;
  habits!: Table<HabitLog, string>;
  messages!: Table<MessageShown, string>;
  achievements!: Table<Achievement, string>;
  weighIns!: Table<WeighIn, string>;
  meta!: Table<Meta, string>;
  tombstones!: Table<Tombstone, string>;

  constructor(name = 'dad-lab') {
    super(name);
    this.version(1).stores({
      profile: 'id',
      settings: 'id',
      exercises: 'id, area, source, name',
      templates: 'id, kind, source',
      sessions: 'id, day, status, kind, templateId',
      activity: 'id, day, activity',
      checkIns: 'id, day',
      flags: 'id, day, kind',
      journal: 'id, day',
      habits: 'id, day, habit',
      messages: 'id, day, key',
      achievements: 'id, key',
      weighIns: 'id, day',
      meta: 'key',
      tombstones: 'key, ts'
    });
  }
}

export const db = new DadLabDB();

/** Tell the sync engine something changed (debounced there). Safe anywhere; no-op outside a browser. */
export function noteChange(): void {
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('dad-lab:changed'));
  } catch {
    /* ignore */
  }
}

/** All data tables, for backup, sync and replace. Settings and meta are handled separately. */
export const DATA_TABLES = ['profile', 'exercises', 'templates', 'sessions', 'activity', 'checkIns', 'flags', 'journal', 'habits', 'messages', 'achievements', 'weighIns'] as const;
export type DataTable = (typeof DATA_TABLES)[number];

/** Seed or refresh the shipped library. Custom items and edited library items are kept. */
export async function seedLibrary(database: DadLabDB = db): Promise<{ exercises: number; templates: number }> {
  const stampE = (await database.meta.get('catalogVersion'))?.value as number | undefined;
  const stampT = (await database.meta.get('templatesVersion'))?.value as number | undefined;
  let exercises = 0;
  let templates = 0;
  const ts = nowIso();
  await database.transaction('rw', database.exercises, database.templates, database.meta, async () => {
    const existingE = new Map((await database.exercises.where('source').equals('library').toArray()).map((e) => [e.id, e]));
    for (const e of LIBRARY_EXERCISES) {
      const cur = existingE.get(e.id);
      if (!cur) { await database.exercises.put({ ...e, createdAt: ts, updatedAt: ts }); exercises += 1; }
      else if (cur.updatedAt === cur.createdAt && stampE !== CATALOG_VERSION) { await database.exercises.put({ ...e, createdAt: cur.createdAt, updatedAt: cur.createdAt, archived: cur.archived }); exercises += 1; }
    }
    const existingT = new Map((await database.templates.where('source').equals('library').toArray()).map((t) => [t.id, t]));
    for (const t of LIBRARY_TEMPLATES) {
      const cur = existingT.get(t.id);
      if (!cur) { await database.templates.put({ ...t, createdAt: ts, updatedAt: ts }); templates += 1; }
      else if (cur.updatedAt === cur.createdAt && stampT !== TEMPLATES_VERSION) { await database.templates.put({ ...t, createdAt: cur.createdAt, updatedAt: cur.createdAt, archived: cur.archived }); templates += 1; }
    }
    await database.meta.put({ key: 'catalogVersion', value: CATALOG_VERSION });
    await database.meta.put({ key: 'templatesVersion', value: TEMPLATES_VERSION });
  });
  return { exercises, templates };
}

export async function getSettings(database: DadLabDB = db): Promise<Settings> {
  const s = await database.settings.get('settings');
  return { ...DEFAULT_SETTINGS, ...(s ?? {}), reminders: { ...DEFAULT_SETTINGS.reminders, ...(s?.reminders ?? {}) }, bandNames: { ...DEFAULT_SETTINGS.bandNames, ...(s?.bandNames ?? {}) } };
}

export async function saveSettings(patch: Partial<Settings>, database: DadLabDB = db): Promise<Settings> {
  const cur = await getSettings(database);
  const next: Settings = { ...cur, ...patch, id: 'settings', updatedAt: nowIso(), createdAt: cur.createdAt ?? nowIso() };
  await database.settings.put(next);
  return next;
}

export async function getProfile(database: DadLabDB = db): Promise<Profile | undefined> {
  return database.profile.get('me');
}

export async function createProfile(input: { firstName: string; theme?: Profile['theme']; goalWeightLbs?: number }, database: DadLabDB = db): Promise<Profile> {
  const ts = nowIso();
  const p: Profile = { id: 'me', firstName: input.firstName, theme: input.theme ?? 'slate', goals: [], programStart: todayDay(), goalWeightLbs: input.goalWeightLbs, createdAt: ts, updatedAt: ts };
  await database.profile.put(p);
  noteChange();
  return p;
}

export async function updateProfile(patch: Partial<Profile>, database: DadLabDB = db): Promise<void> {
  const cur = await database.profile.get('me');
  if (!cur) return;
  await database.profile.put({ ...cur, ...patch, id: 'me', updatedAt: nowIso() });
  noteChange();
}

export async function addGoal(text: string, database: DadLabDB = db): Promise<void> {
  const cur = await database.profile.get('me');
  if (!cur) return;
  await database.profile.put({ ...cur, goals: [...cur.goals, { id: newId(), text, status: 'active', createdAt: nowIso() }], updatedAt: nowIso() });
  noteChange();
}

export async function setGoalStatus(id: string, status: 'active' | 'done', database: DadLabDB = db): Promise<void> {
  const cur = await database.profile.get('me');
  if (!cur) return;
  await database.profile.put({ ...cur, goals: cur.goals.map((g) => (g.id === id ? { ...g, status, doneAt: status === 'done' ? nowIso() : undefined } : g)), updatedAt: nowIso() });
  noteChange();
}

export async function saveSession(s: Session, database: DadLabDB = db): Promise<void> {
  await database.sessions.put({ ...s, updatedAt: nowIso() });
  noteChange();
}

export async function updateSession(id: string, patch: Partial<Session>, database: DadLabDB = db): Promise<void> {
  await database.sessions.update(id, { ...patch, updatedAt: nowIso() });
  noteChange();
}

export async function addActivity(input: Omit<ActivityLog, 'id' | 'ts'>, database: DadLabDB = db): Promise<ActivityLog> {
  const l: ActivityLog = { id: newId(), ts: nowIso(), ...input };
  await database.activity.put(l);
  noteChange();
  return l;
}

export async function saveCheckIn(input: Omit<CheckIn, 'id' | 'ts'>, database: DadLabDB = db): Promise<CheckIn> {
  const existing = await database.checkIns.where('day').equals(input.day).first();
  const c: CheckIn = { id: existing?.id ?? newId(), ts: nowIso(), ...input };
  await database.checkIns.put(c);
  noteChange();
  return c;
}

export async function addFlag(input: Omit<SafetyFlag, 'id' | 'ts'>, database: DadLabDB = db): Promise<SafetyFlag> {
  const dup = await database.flags.where('day').equals(input.day).filter((f) => f.kind === input.kind && f.text === input.text).first();
  if (dup) return dup;
  const f: SafetyFlag = { id: newId(), ts: nowIso(), ...input };
  await database.flags.put(f);
  noteChange();
  return f;
}

export async function addJournal(input: { day: Day; text: string; sessionId?: string }, database: DadLabDB = db): Promise<JournalEntry> {
  const ts = nowIso();
  const j: JournalEntry = { id: newId(), ts, updatedAt: ts, ...input };
  await database.journal.put(j);
  noteChange();
  return j;
}

export async function setHabit(day: Day, habit: HabitLog['habit'], done: boolean, database: DadLabDB = db): Promise<void> {
  const cur = await database.habits.where('day').equals(day).filter((h) => h.habit === habit).first();
  await database.habits.put({ id: cur?.id ?? newId(), day, habit, done, ts: nowIso() });
  noteChange();
}

export async function saveWeighIn(day: Day, lbs: number, note?: string, database: DadLabDB = db): Promise<WeighIn> {
  const cur = await database.weighIns.where('day').equals(day).first();
  const ts = nowIso();
  const w: WeighIn = { id: cur?.id ?? newId(), day, lbs, note, ts: cur?.ts ?? ts, updatedAt: ts };
  await database.weighIns.put(w);
  noteChange();
  return w;
}

export async function saveExercise(e: Exercise, database: DadLabDB = db): Promise<void> {
  await database.exercises.put({ ...e, updatedAt: nowIso() });
  noteChange();
}

export async function saveTemplate(t: WorkoutTemplate, database: DadLabDB = db): Promise<void> {
  await database.templates.put({ ...t, updatedAt: nowIso() });
  noteChange();
}

/** Delete a row and leave a tombstone so the deletion reaches the other device. */
export async function deleteWithTombstone(tbl: 'journal' | 'activity' | 'weighIns' | 'sessions', id: string, database: DadLabDB = db): Promise<void> {
  await database.transaction('rw', (database as any)[tbl], database.tombstones, async () => {
    await (database as any)[tbl].delete(id);
    await database.tombstones.put({ key: `${tbl}:${id}`, tbl, id, ts: nowIso() });
  });
  noteChange();
}

/** Wipe everything on this device. Used by Replace restore and "start over". */
export async function clearAll(database: DadLabDB = db): Promise<void> {
  await database.transaction('rw', database.tables, async () => {
    for (const t of database.tables) await t.clear();
  });
}

// ---------------------------------------------------------------------------
// Storage health
// ---------------------------------------------------------------------------

export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean((window.navigator as any).standalone) || window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

export interface StorageHealth {
  persisted: boolean | null;
  usageBytes: number | null;
  installed: boolean;
  verdict: 'safe' | 'install' | 'unknown';
  message: string;
}

export async function storageHealth(): Promise<StorageHealth> {
  const nav: any = typeof navigator !== 'undefined' ? navigator : undefined;
  let persisted: boolean | null = null;
  let usageBytes: number | null = null;
  try {
    if (nav?.storage?.persisted) persisted = await nav.storage.persisted();
    if (nav?.storage?.estimate) usageBytes = (await nav.storage.estimate()).usage ?? null;
  } catch {
    /* ignore */
  }
  const installed = isInstalled();
  if (installed || persisted === true) {
    return { persisted, usageBytes, installed, verdict: 'safe', message: installed ? 'Installed on the home screen: your days stay on this device. Link a second device or back up every few weeks.' : 'Storage is persistent on this device. Back up every few weeks.' };
  }
  return { persisted, usageBytes, installed, verdict: 'install', message: 'Running in a browser tab. Add the app to your home screen (Share, Add to Home Screen) so the browser cannot clear it.' };
}

export async function requestPersistence(): Promise<boolean | null> {
  const nav: any = typeof navigator !== 'undefined' ? navigator : undefined;
  try {
    if (nav?.storage?.persist) return await nav.storage.persist();
  } catch {
    /* ignore */
  }
  return null;
}
