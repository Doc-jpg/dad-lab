import React, { useState } from 'react';
import { Sheet } from './Sheet';
import type { Day, Feel, Activity, Duration, Intensity, ActivityLog, LoadTag, TimeBudget } from '../../engine/types';
import { FEEL_WORDS, SLEEP_WORDS, STRESS_WORDS, ACTIVITY_WORDS, DURATION_WORDS, INTENSITY_WORDS, TIME_WORDS, TAG_WORDS } from '../../engine/types';

/**
 * The daily check-in. One sheet: sleep, energy, stress, soreness, anything wrong, time available,
 * and anything else you already did today. Defaults are "a normal day" so it is two taps when it is.
 */
export interface ActivityDraft {
  activity: Activity;
  duration: Duration;
  intensity: Intensity;
}

export interface CheckInDraft {
  sleep: Feel;
  sleepHours?: number;
  energy: Feel;
  stress: Feel;
  soreness: 'none' | 'some' | 'alot';
  soreWhere: LoadTag[];
  pain: boolean;
  painWhere?: string;
  sick: boolean;
  time: TimeBudget;
  note?: string;
}

const ACTIVITIES: Activity[] = ['walk', 'run', 'bike', 'golf', 'yard', 'sport', 'lifting', 'other'];
const TAGS: LoadTag[] = ['shoulder', 'elbow', 'wrist', 'back', 'hip', 'knee'];

export function ActivityCard({ draft, onChange, onRemove }: { draft: ActivityDraft; onChange: (d: ActivityDraft) => void; onRemove: () => void }) {
  const set = (p: Partial<ActivityDraft>) => onChange({ ...draft, ...p });
  return (
    <div className="card">
      <div className="row between"><strong>{ACTIVITY_WORDS[draft.activity]}</strong><button className="btn ghost sm" onClick={onRemove}>Remove</button></div>
      <div className="small muted mt">How long?</div>
      <div className="chips">{(['short', 'medium', 'long'] as Duration[]).map((d) => <button key={d} className={`chip sm ${draft.duration === d ? 'on' : ''}`} onClick={() => set({ duration: d })}>{DURATION_WORDS[d]}</button>)}</div>
      <div className="small muted mt">How hard?</div>
      <div className="chips">{(['easy', 'medium', 'hard'] as Intensity[]).map((d) => <button key={d} className={`chip sm ${draft.intensity === d ? 'on' : ''}`} onClick={() => set({ intensity: d })}>{INTENSITY_WORDS[d]}</button>)}</div>
    </div>
  );
}

export function newActivityDraft(activity: Activity): ActivityDraft {
  return { activity, duration: 'medium', intensity: 'medium' };
}

export function toLog(d: ActivityDraft, day: Day): Omit<ActivityLog, 'id' | 'ts'> {
  return { day, activity: d.activity, duration: d.duration, intensity: d.intensity };
}

function FiveScale({ value, words, onChange }: { value: Feel; words: Record<Feel, string>; onChange: (v: Feel) => void }) {
  return (
    <div className="btn-grid cols-5">
      {([1, 2, 3, 4, 5] as Feel[]).map((v) => <button key={v} className={`btn ${value === v ? 'primary' : ''}`} onClick={() => onChange(v)}>{words[v]}</button>)}
    </div>
  );
}

export const DEFAULT_DRAFT: CheckInDraft = { sleep: 4, energy: 4, stress: 2, soreness: 'none', soreWhere: [], pain: false, sick: false, time: 30 };

export function CheckInSheet({ name, initialActivity, initial, onSave, onClose }: { name: string; initialActivity?: ActivityDraft[]; initial?: Partial<CheckInDraft>; onSave: (activity: ActivityDraft[], draft: CheckInDraft) => Promise<void>; onClose: () => void }) {
  const [activity, setActivity] = useState<ActivityDraft[]>(initialActivity ?? []);
  const [draft, setDraft] = useState<CheckInDraft>({ ...DEFAULT_DRAFT, ...(initial ?? {}) });
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<CheckInDraft>) => setDraft({ ...draft, ...p });
  const red = draft.pain || draft.sick;
  return (
    <Sheet
      title={`Morning, ${name}.`}
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy} onClick={async () => { setBusy(true); await onSave(activity, draft); setBusy(false); }}>Save and see today</button></>}
    >
      <h3>Sleep last night</h3>
      <FiveScale value={draft.sleep} words={SLEEP_WORDS} onChange={(v) => set({ sleep: v })} />
      <div className="chips mt">{[5, 6, 7, 8, 9].map((h) => <button key={h} className={`chip sm ${draft.sleepHours === h ? 'on' : ''}`} onClick={() => set({ sleepHours: draft.sleepHours === h ? undefined : h })}>{h === 5 ? 'Under 6 h' : h === 9 ? '9 h or more' : `${h} h`}</button>)}</div>
      <h3 className="mt">Energy</h3>
      <FiveScale value={draft.energy} words={FEEL_WORDS} onChange={(v) => set({ energy: v })} />
      <h3 className="mt">Stress</h3>
      <FiveScale value={draft.stress} words={STRESS_WORDS} onChange={(v) => set({ stress: v })} />
      <h3 className="mt">Sore?</h3>
      <div className="btn-grid cols-3">
        {([['none', 'Not really'], ['some', 'A little'], ['alot', 'A lot']] as Array<[CheckInDraft['soreness'], string]>).map(([k, l]) => <button key={k} className={`btn ${draft.soreness === k ? 'primary' : ''}`} onClick={() => set({ soreness: k, soreWhere: k === 'none' ? [] : draft.soreWhere })}>{l}</button>)}
      </div>
      {draft.soreness !== 'none' && (
        <>
          <p className="small muted mt">Any joint, not just muscle? Tap it and the moves that load it swap out today.</p>
          <div className="chips">{TAGS.map((t) => <button key={t} className={`chip sm ${draft.soreWhere.includes(t) ? 'on' : ''}`} onClick={() => set({ soreWhere: draft.soreWhere.includes(t) ? draft.soreWhere.filter((x) => x !== t) : [...draft.soreWhere, t] })}>{TAG_WORDS[t]}</button>)}</div>
        </>
      )}
      <h3 className="mt">Time today</h3>
      <div className="btn-grid cols-4">
        {([5, 15, 30, 45] as TimeBudget[]).map((t) => <button key={t} className={`btn ${draft.time === t ? 'primary' : ''}`} onClick={() => set({ time: t })}>{TIME_WORDS[t]}</button>)}
      </div>
      <h3 className="mt">Already did something today?</h3>
      <p className="small muted">A walk, a round, yard work. It counts, and the app plans around it.</p>
      <div className="chips mb">
        {ACTIVITIES.map((s) => <button key={s} className="chip sm" onClick={() => setActivity([...activity, newActivityDraft(s)])}>+ {ACTIVITY_WORDS[s]}</button>)}
      </div>
      <div className="list mb">
        {activity.map((d, i) => <ActivityCard key={i} draft={d} onChange={(x) => setActivity(activity.map((y, j) => (j === i ? x : y)))} onRemove={() => setActivity(activity.filter((_, j) => j !== i))} />)}
      </div>
      <h3 className="mt">Anything wrong?</h3>
      <p className="small muted">Sore is normal. These are different.</p>
      <div className="chips">
        <button className={`chip red ${draft.pain ? 'on' : ''}`} onClick={() => set({ pain: !draft.pain })}>Something hurts</button>
        <button className={`chip red ${draft.sick ? 'on' : ''}`} onClick={() => set({ sick: !draft.sick })}>Sick</button>
      </div>
      {draft.pain && <div className="field mt"><label>Where?</label><input className="input" value={draft.painWhere ?? ''} onChange={(e) => set({ painWhere: e.target.value })} placeholder="for example right shoulder" /></div>}
      {red && <div className="banner danger mt">Nothing loads today. The floor still counts: breathing, maybe a walk. Pain that sticks around for a few days is worth a look.</div>}
      <div className="field mt"><label>Anything else? (optional)</label><input className="input" value={draft.note ?? ''} onChange={(e) => set({ note: e.target.value })} placeholder="Long day at Gold Leaf" /></div>
    </Sheet>
  );
}
