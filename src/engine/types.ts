/**
 * Dad Lab data model. One person, every day, something.
 *
 * Every record has createdAt/updatedAt (or ts for append-only logs) so merge (backup restore and
 * device sync) keeps the newer copy and never silently overwrites. Sessions snapshot the exercise
 * name and catalog version so history still reads right after the library changes.
 */

export type Iso = string; // ISO timestamp
export type Day = string; // YYYY-MM-DD, local

export function nowIso(): Iso {
  return new Date().toISOString();
}

export function todayDay(d: Date = new Date()): Day {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function addDays(day: Day, n: number): Day {
  const d = new Date(day + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return todayDay(d);
}

export function daysBetween(a: Day, b: Day): number {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000);
}

export function newId(): string {
  const c: any = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---------------------------------------------------------------------------
// Profile and settings
// ---------------------------------------------------------------------------

export type ThemeChoice = 'slate' | 'minimal' | 'warm';

export interface Goal {
  id: string;
  text: string;
  status: 'active' | 'done';
  createdAt: Iso;
  doneAt?: Iso;
}

export interface Profile {
  id: 'me';
  firstName: string;
  theme: ThemeChoice;
  goals: Goal[];
  /** Day the program started; the chain and the weekly views count from here. */
  programStart: Day;
  /** Optional, for the Happy Body weigh-in line. Pounds. */
  goalWeightLbs?: number;
  createdAt: Iso;
  updatedAt: Iso;
}

export interface Reminders {
  enabled: boolean;
  /** 24h "HH:MM". Messages are not shown between quietStart and quietEnd. */
  quietStart: string;
  quietEnd: string;
  rotationDays: number;
  deviceNotifications: boolean;
}

/** The four band levels. Names are the user's (defaults are the X3 set); the keys never change. */
export type Band = 'band1' | 'band2' | 'band3' | 'band4';
export type Load = 'body' | Band | 'dumbbell';
export const BANDS: Band[] = ['band1', 'band2', 'band3', 'band4'];
export const DEFAULT_BAND_NAMES: Record<Band, string> = { band1: 'White', band2: 'Light gray', band3: 'Dark gray', band4: 'Elite' };

export interface Settings {
  id: 'settings';
  reminders: Reminders;
  /** Band days per week to aim for (push and pull together). */
  strengthDaysPerWeek: 2 | 3 | 4 | 5 | 6;
  bandNames: Record<Band, string>;
  /** Happy Body style weekly weigh-in on the Today screen. */
  weighIns: boolean;
  tourSeenAt?: Iso;
  demoLoaded?: boolean;
  lastBackupAt?: Iso;
  /** Automatic sync between this person's own devices through the device code. Per device; never backed up. */
  sync?: SyncState;
  createdAt?: Iso;
  updatedAt?: Iso;
}

export interface SyncState {
  /** The device code (20 characters). Every device holds it; the server only ever sees its hash. */
  secret: string;
  familyId: string;
  enabled: boolean;
  device: string;
  lastPush?: string;
  lastPullTs?: string;
  lastSyncAt?: Iso;
  lastError?: string;
}

/** A deleted record, kept so the deletion reaches the other device. */
export interface Tombstone {
  key: string; // `${tbl}:${id}`
  tbl: string;
  id: string;
  ts: Iso;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  reminders: { enabled: true, quietStart: '21:30', quietEnd: '06:00', rotationDays: 7, deviceNotifications: false },
  strengthDaysPerWeek: 4,
  bandNames: { ...DEFAULT_BAND_NAMES },
  weighIns: true
};

// ---------------------------------------------------------------------------
// Exercise catalog
// ---------------------------------------------------------------------------

export type Area = 'push' | 'pull' | 'legs' | 'core' | 'happybody' | 'mobility' | 'warmup' | 'breathing';
export type LoadTag = 'shoulder' | 'elbow' | 'back' | 'knee' | 'hip' | 'wrist';
export type Equipment = 'none' | 'band' | 'bar' | 'platform' | 'dumbbell' | 'floor' | 'wall' | 'chair';
export type Pose = 'squat' | 'chairsquat' | 'splitsquat' | 'bridge' | 'calfraise' | 'wallpush' | 'inclinepush' | 'pushup' | 'row' | 'curl' | 'scap' | 'deadbug' | 'birddog' | 'sideplank' | 'plank' | 'curlup' | 'rotation' | 'antirotation' | 'balance' | 'ankle' | 'hip' | 'thoracic' | 'hamstring' | 'shoulder' | 'breathe' | 'catcow' | 'march' | 'walk' | 'hinge' | 'ninety' | 'latlunge' | 'press' | 'chestpress' | 'triceps' | 'pullapart' | 'deadlift' | 'candle' | 'overhead' | 'sidebend' | 'lunge' | 'childpose' | 'downdog' | 'cobra' | 'twist' | 'squathold';

export interface Dose {
  sets: number;
  reps?: number;
  /** Shown as a range when both are set, for example 15 to 40. */
  repsMax?: number;
  seconds?: number;
  perSide?: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  area: Area;
  /** What it builds, in one line. */
  develops: string;
  /** Why it matters for a 40-year-old who wants to stay strong and mobile. */
  why: string;
  steps: string[];
  cues: string[];
  commonErrors: Array<{ error: string; fix: string }>;
  skipIf: string[];
  substitutes: string[];
  easier?: string;
  harder?: string;
  /** Loads this exercise is done with. The first is the default. */
  loads: Load[];
  loadTags: LoadTag[];
  equipment: Equipment[];
  defaultDose: Dose;
  /** Band moves: when the top of the range is reached twice in a row, the app suggests the next band. */
  progressRule?: 'band-up' | 'reps' | 'hold' | 'none';
  /** Official demonstration links (opened in the browser; nothing is copied). */
  links?: Array<{ title: string; url: string }>;
  pose: Pose;
  source: 'library' | 'custom';
  version: number;
  createdAt: Iso;
  updatedAt: Iso;
  archived?: boolean;
}

// ---------------------------------------------------------------------------
// Workout templates and sessions
// ---------------------------------------------------------------------------

export type SessionKind = 'push' | 'pull' | 'happybody' | 'stretch' | 'floor' | 'walk';
/** Band days: alternate push and pull, count against the weekly target. */
export const STRENGTH_KINDS: SessionKind[] = ['push', 'pull'];

export interface TemplateItem {
  exerciseId: string;
  dose: Dose;
  optional?: boolean;
  note?: string;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  kind: SessionKind;
  minutes: number;
  summary: string;
  items: TemplateItem[];
  source: 'library' | 'custom';
  version: number;
  createdAt: Iso;
  updatedAt: Iso;
  archived?: boolean;
}

export interface SetLog {
  reps?: number;
  seconds?: number;
  load: Load;
  /** Dumbbell weight in pounds when load is 'dumbbell'. */
  lbs?: number;
  /** Band work: did the set go to the point you could not do another clean rep. */
  toFailure?: boolean;
  done: boolean;
  ts: Iso;
}

export interface SessionItem {
  exerciseId: string;
  exerciseName: string;
  catalogVersion: number;
  planned: Dose;
  sets: SetLog[];
  swappedFromId?: string;
  swappedFromName?: string;
  difficulty?: 1 | 2 | 3 | 4 | 5;
  feltGood?: boolean;
  note?: string;
  skipped?: boolean;
  doseReason?: string;
}

export type ReadinessColor = 'green' | 'yellow' | 'orange' | 'red';

export interface Session {
  id: string;
  day: Day;
  templateId?: string;
  templateName: string;
  kind: SessionKind;
  status: 'planned' | 'in_progress' | 'done' | 'skipped' | 'stopped';
  readiness?: ReadinessColor;
  why: string[];
  items: SessionItem[];
  startedAt?: Iso;
  finishedAt?: Iso;
  live?: { index: number; paused: boolean; elapsedSec: number; runningSince?: Iso };
  overallDifficulty?: 1 | 2 | 3 | 4 | 5;
  feltGood?: boolean;
  note?: string;
  stoppedReason?: 'pain' | 'sick' | 'dizzy' | 'tired' | 'time' | 'other';
  achievements?: string[];
  /** Minutes actually spent, from the player. */
  minutes?: number;
  createdAt: Iso;
  updatedAt: Iso;
}

// ---------------------------------------------------------------------------
// Other activity and the daily check-in
// ---------------------------------------------------------------------------

export type Activity = 'walk' | 'run' | 'bike' | 'swim' | 'yard' | 'sport' | 'lifting' | 'golf' | 'other';
export type Duration = 'short' | 'medium' | 'long'; // under 30, 30 to 60, over 60 minutes
export type Intensity = 'easy' | 'medium' | 'hard';

export interface ActivityLog {
  id: string;
  day: Day;
  ts: Iso;
  activity: Activity;
  label?: string;
  duration: Duration;
  intensity: Intensity;
}

export type Feel = 1 | 2 | 3 | 4 | 5;
export type TimeBudget = 5 | 15 | 30 | 45;

export interface CheckIn {
  id: string;
  day: Day;
  ts: Iso;
  sleep: Feel;
  /** Hours slept, optional, kept for the chart. */
  sleepHours?: number;
  energy: Feel;
  stress: Feel; // 1 calm .. 5 fried
  soreness: 'none' | 'some' | 'alot';
  soreWhere?: LoadTag[];
  pain: boolean;
  painWhere?: string;
  sick: boolean;
  /** Minutes available today. */
  time: TimeBudget;
  note?: string;
  color: ReadinessColor;
}

export interface SafetyFlag {
  id: string;
  ts: Iso;
  day: Day;
  kind: 'pain' | 'sick' | 'stopped' | 'pain-streak' | 'no-rest';
  text: string;
  acknowledgedAt?: Iso;
}

// ---------------------------------------------------------------------------
// Journal, habits, weigh-ins, achievements
// ---------------------------------------------------------------------------

export interface JournalEntry {
  id: string;
  day: Day;
  ts: Iso;
  text: string;
  sessionId?: string;
  updatedAt: Iso;
}

export type HabitKey = 'water' | 'meals' | 'walk' | 'sleep' | 'relax' | 'nolate';

export interface HabitLog {
  id: string;
  day: Day;
  habit: HabitKey;
  done: boolean;
  ts: Iso;
}

export interface WeighIn {
  id: string;
  day: Day;
  lbs: number;
  note?: string;
  ts: Iso;
  updatedAt: Iso;
}

export interface MessageShown {
  id: string;
  day: Day;
  key: string;
  category: string;
  ts: Iso;
}

export interface Achievement {
  id: string;
  key: string;
  title: string;
  text: string;
  earnedAt: Iso;
}

export const FEEL_WORDS: Record<Feel, string> = { 1: 'Wiped out', 2: 'Low', 3: 'Okay', 4: 'Good', 5: 'Great' };
export const SLEEP_WORDS: Record<Feel, string> = { 1: 'Rough', 2: 'Short', 3: 'Okay', 4: 'Good', 5: 'Great' };
export const STRESS_WORDS: Record<Feel, string> = { 1: 'Calm', 2: 'Fine', 3: 'Busy', 4: 'Stretched', 5: 'Fried' };
export const ACTIVITY_WORDS: Record<Activity, string> = { walk: 'Walk', run: 'Run', bike: 'Bike', swim: 'Swim', yard: 'Yard or house work', sport: 'Sport or pickup game', lifting: 'Lifted somewhere else', golf: 'Golf', other: 'Something else' };
export const DURATION_WORDS: Record<Duration, string> = { short: 'Under 30 min', medium: '30 to 60 min', long: 'Over an hour' };
export const INTENSITY_WORDS: Record<Intensity, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
export const TIME_WORDS: Record<TimeBudget, string> = { 5: '5 minutes', 15: '15 minutes', 30: '30 minutes', 45: '45 or more' };
export const TAG_WORDS: Record<LoadTag, string> = { shoulder: 'Shoulders', elbow: 'Elbows', back: 'Back', knee: 'Knees', hip: 'Hips', wrist: 'Wrists' };
export const KIND_WORDS: Record<SessionKind, string> = { push: 'Push day', pull: 'Pull day', happybody: 'Happy Body', stretch: 'Stretch', floor: 'The floor', walk: 'Walk' };
