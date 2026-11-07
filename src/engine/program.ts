/**
 * Building today's session from a template, and the small progression rules.
 *
 * Bands: the app remembers the band you used last time for each move and suggests the next band
 * up after two sessions in a row at the top of the rep range (40) with that band. It never raises
 * it on its own; the suggestion sits on the card and you pick the band. Under 15 reps means the
 * band was too heavy today; the next session offers the one below.
 * Bodyweight moves: +2 reps or +5 seconds after two sessions where the last set hit the plan.
 * Happy Body: the sequence stays at the sequence; the weight is yours to raise, slowly.
 * Reduced day: one set each, no band up, the optional items out.
 */
import type { Exercise, Session, SessionItem, SessionKind, WorkoutTemplate, Dose, Load, Day, LoadTag, Band, Settings } from './types';
import { newId, nowIso, BANDS, activeBands, bandShort } from './types';
import type { Readiness } from './readiness';

export interface BuildContext {
  day: Day;
  exercises: Map<string, Exercise>;
  sessions: Session[];
  settings: Pick<Settings, 'bandNames'>;
}

/** Done items for this exercise, newest first. */
function history(exerciseId: string, sessions: Session[]): Array<{ day: Day; item: SessionItem }> {
  return sessions
    .filter((s) => s.status === 'done')
    .sort((a, b) => (b.day + b.createdAt).localeCompare(a.day + a.createdAt))
    .flatMap((s) => s.items.filter((i) => i.exerciseId === exerciseId && i.sets.some((x) => x.done)).map((item) => ({ day: s.day, item })));
}

function lastDoneSet(item: SessionItem) {
  const done = item.sets.filter((x) => x.done);
  return done[done.length - 1];
}

/** Where a band move starts the first time, inside the bands he owns: light, mid or heavy. */
export function startingBand(exercise: Exercise, names: Record<Band, string>): Band | undefined {
  const own = activeBands(names);
  if (!own.length) return undefined;
  const idx = { light: 3, mid: 4, heavy: 5 }[exercise.bandStart ?? 'mid'];
  return own[Math.min(idx, own.length - 1)];
}

/** The load used last time for this exercise, or the exercise's starting point. */
export function lastLoad(exercise: Exercise, sessions: Session[], names: Record<Band, string> = {} as Record<Band, string>): { load: Load; lbs?: number } {
  const h = history(exercise.id, sessions);
  if (h.length) {
    const set = lastDoneSet(h[0].item);
    if (set && exercise.loads.includes(set.load)) return { load: set.load, lbs: set.lbs };
  }
  if (exercise.progressRule === 'band-up') return { load: startingBand(exercise, names) ?? exercise.loads[0] };
  return { load: exercise.loads[0] };
}

/** The next heavier band he owns, or the next lighter one. */
export function bandUp(b: Load, names?: Record<Band, string>): Band | undefined {
  const list = names ? activeBands(names) : BANDS;
  const i = list.indexOf(b as Band);
  return i >= 0 && i < list.length - 1 ? list[i + 1] : undefined;
}
export function bandDown(b: Load, names?: Record<Band, string>): Band | undefined {
  const list = names ? activeBands(names) : BANDS;
  const i = list.indexOf(b as Band);
  return i > 0 ? list[i - 1] : undefined;
}

export interface DoseDecision {
  dose: Dose;
  load: Load;
  lbs?: number;
  reason?: string;
  /** A band the app suggests trying; never applied by itself. */
  suggestBand?: Band;
}

export function decideDose(exercise: Exercise, templateDose: Dose, ctx: BuildContext, reduced: boolean, bandNames: Record<Band, string>): DoseDecision {
  const h = history(exercise.id, ctx.sessions);
  const { load, lbs } = lastLoad(exercise, ctx.sessions, bandNames);
  const dose: Dose = { ...templateDose };
  if (reduced) {
    dose.sets = 1;
    return { dose, load, lbs, reason: 'Lighter day: one set, same band as last time.' };
  }
  const rule = exercise.progressRule ?? 'none';
  if (rule === 'band-up' && BANDS.includes(load as Band)) {
    const recent = h.filter((x) => lastDoneSet(x.item)?.load === load).slice(0, 2);
    const tops = recent.filter((x) => (lastDoneSet(x.item)?.reps ?? 0) >= (templateDose.repsMax ?? 40));
    const under = h[0] && lastDoneSet(h[0].item)?.load === load && (lastDoneSet(h[0].item)?.reps ?? 99) < (templateDose.reps ?? 15);
    if (recent.length >= 2 && tops.length >= 2) {
      const up = bandUp(load, bandNames);
      if (up) return { dose, load, lbs, suggestBand: up, reason: `${templateDose.repsMax ?? 40} clean reps twice in a row with the ${bandShort(bandNames, load as Band)} band. Try the ${bandShort(bandNames, up)} today if it feels right.` };
      return { dose, load, lbs, reason: `Top band, top of the range twice. Slow the reps down instead: four seconds each way.` };
    }
    if (under) {
      const down = bandDown(load, bandNames);
      if (down) return { dose, load: down, lbs, reason: `Under ${templateDose.reps ?? 15} reps last time with the ${bandShort(bandNames, load as Band)}; the ${bandShort(bandNames, down)} is on the card today.` };
    }
    return { dose, load, lbs, reason: h.length ? `${bandShort(bandNames, load as Band)} band, same as last time.` : undefined };
  }
  if (rule === 'reps' && dose.reps !== undefined && h.length >= 2) {
    const [a, b] = h;
    const hit = (x: { item: SessionItem }) => (lastDoneSet(x.item)?.reps ?? 0) >= (x.item.planned.repsMax ?? x.item.planned.reps ?? 0);
    const planned = a.item.planned;
    if (hit(a) && hit(b)) {
      const next = Math.min((planned.repsMax ?? planned.reps ?? dose.reps) + 2, (dose.repsMax ?? dose.reps) + 10);
      return { dose: { ...planned, reps: planned.reps, repsMax: next }, load, lbs, reason: `Hit the top twice; the range goes to ${next}.` };
    }
    return { dose: planned, load, lbs };
  }
  if (rule === 'hold' && dose.seconds !== undefined && h.length >= 2) {
    const [a, b] = h;
    const planned = a.item.planned;
    const hit = (x: { item: SessionItem }) => (lastDoneSet(x.item)?.seconds ?? 0) >= (x.item.planned.seconds ?? 0);
    if (hit(a) && hit(b)) {
      const next = Math.min((planned.seconds ?? dose.seconds) + 5, dose.seconds + 60);
      return { dose: { ...planned, seconds: next }, load, lbs, reason: `Held it twice; ${next} seconds today.` };
    }
    return { dose: planned, load, lbs };
  }
  return { dose, load, lbs };
}

function blockedBy(exercise: Exercise, blocked: LoadTag[]): LoadTag | undefined {
  return exercise.loadTags.find((t) => blocked.includes(t));
}

function pickSubstitute(exercise: Exercise, ctx: BuildContext, blocked: LoadTag[]): Exercise | undefined {
  const candidates = [...exercise.substitutes, exercise.easier].filter((x): x is string => !!x).map((id) => ctx.exercises.get(id)).filter((e): e is Exercise => !!e && !e.archived);
  return candidates.find((c) => !blockedBy(c, blocked));
}

export interface BuiltSession {
  session: Session;
  changes: string[];
}

/** Build today's session from a template and the verdict. */
export function buildSession(template: WorkoutTemplate, readiness: Readiness, ctx: BuildContext): BuiltSession {
  const reduced = readiness.color !== 'green';
  const changes: string[] = [];
  const items: SessionItem[] = [];
  const bandNames = ctx.settings.bandNames;
  for (const ti of template.items) {
    let ex = ctx.exercises.get(ti.exerciseId);
    if (!ex || ex.archived) continue;
    let swappedFrom: Exercise | undefined;
    const tag = blockedBy(ex, readiness.blocked);
    const loaded = ex.loads.some((l) => l !== 'body');
    if (tag && loaded) {
      const sub = pickSubstitute(ex, ctx, readiness.blocked);
      const why = `${ex.name} loads the ${({ shoulder: 'shoulders', elbow: 'elbows', back: 'back', knee: 'knees', hip: 'hips', wrist: 'wrists' })[tag]}, which are sore`;
      if (sub) { changes.push(`${why}, so ${sub.name} is in its place.`); swappedFrom = ex; ex = sub; }
      else if (ti.optional) { changes.push(`${why}; it was optional, so it is out.`); continue; }
      else { changes.push(`${why}; nothing fits, so it is out today.`); continue; }
    }
    if (reduced && ti.optional) { changes.push(`${ex.name} was optional; out on a lighter day.`); continue; }
    const base = swappedFrom ? ex.defaultDose : ti.dose;
    const d = decideDose(ex, base, ctx, reduced, bandNames);
    items.push({
      exerciseId: ex.id, exerciseName: ex.name, catalogVersion: ex.version, planned: d.dose, sets: [],
      swappedFromId: swappedFrom?.id, swappedFromName: swappedFrom?.name, doseReason: d.reason,
      ...(d.suggestBand ? { note: `Try: ${bandShort(bandNames, d.suggestBand)}` } : {})
    });
  }
  const ts = nowIso();
  const session: Session = {
    id: newId(), day: ctx.day, templateId: template.id, templateName: template.name, kind: template.kind as SessionKind, status: 'planned',
    readiness: readiness.color, why: [...readiness.reasons, ...readiness.blockedWhy, ...changes], items, createdAt: ts, updatedAt: ts
  };
  return { session, changes };
}

/** Minutes a session will take, roughly: band reps at 4 seconds, others at 3, holds as timed, 40 seconds between sets. */
export function estimateMinutes(items: SessionItem[], exercises?: Map<string, Exercise>): number {
  let sec = 0;
  for (const it of items) {
    const sides = it.planned.perSide ? 2 : 1;
    const band = exercises?.get(it.exerciseId)?.progressRule === 'band-up';
    const per = it.planned.seconds ?? ((it.planned.repsMax ?? it.planned.reps ?? 8) * (band ? 3 : 3));
    sec += it.planned.sets * sides * per + it.planned.sets * 40;
  }
  return Math.max(3, Math.round(sec / 60));
}

export function doseText(d: Dose): string {
  const reps = d.reps !== undefined ? (d.repsMax && d.repsMax !== d.reps ? `${d.reps} to ${d.repsMax}` : `${d.reps}`) : undefined;
  const unit = d.seconds !== undefined ? (d.seconds >= 120 ? `${Math.round(d.seconds / 60)} min` : `${d.seconds} sec`) : `${reps} reps`;
  return `${d.sets} × ${unit}${d.perSide ? ' per side' : ''}`;
}

export function loadWord(load: Load, bandNames: Record<Band, string>, lbs?: number): string {
  if (load === 'body') return 'Body weight';
  if (load === 'dumbbell') return lbs ? `${lbs} lb dumbbells` : 'Dumbbells';
  return `${bandShort(bandNames, load as Band)} band`;
}
