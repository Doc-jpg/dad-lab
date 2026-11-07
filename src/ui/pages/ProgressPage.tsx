import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAchievements, useProfile, useCheckIns, useExerciseMap, useJournal, useSessions, useActivity, useSettings, useToday, useWeighIns, fmtDate } from '../hooks';
import { Spark, Bars } from '../components/Charts';
import { BADGES } from '../../engine/achievements';
import { addDays, STRENGTH_KINDS, BANDS, type Day, type Band } from '../../engine/types';
import { Sheet } from '../components/Sheet';
import { ActivityRow } from './TodayPage';
import { COLOR_WORDS, chain, weekStartOf } from '../../engine/readiness';
import { deleteWithTombstone } from '../../db/db';

/** Progress against your own earlier self: the chain, band days, which band per move, the weigh-in trend, and a calendar. */
export function ProgressPage() {
  const day = useToday();
  const me = useProfile();
  const settings = useSettings();
  const sessions = useSessions();
  const activity = useActivity();
  const checkIns = useCheckIns();
  const achievements = useAchievements();
  const exercises = useExerciseMap();
  const journal = useJournal();
  const weighIns = useWeighIns();
  const [pick, setPick] = useState<Day | null>(null);
  const [exId, setExId] = useState('push-chest');
  const done = sessions.filter((s) => s.status === 'done');
  const bandDays = done.filter((s) => STRENGTH_KINDS.includes(s.kind));
  const ch = chain(sessions, activity, day);

  // Days with something, and band days, per week, last 8 weeks.
  const weeks = useMemo(() => { const ws = weekStartOf(day); return Array.from({ length: 8 }, (_, i) => addDays(ws, -7 * (7 - i))); }, [day]);
  const activeDays = (w: Day) => new Set([...done.filter((s) => s.day >= w && s.day <= addDays(w, 6)).map((s) => s.day), ...activity.filter((a) => a.day >= w && a.day <= addDays(w, 6)).map((a) => a.day)]).size;
  const perWeek = weeks.map(activeDays);
  const bandsPerWeek = weeks.map((w) => bandDays.filter((s) => s.day >= w && s.day <= addDays(w, 6)).length);

  // Band per move: last band used and best reps with it.
  const bandMoves = [...exercises.values()].filter((e) => e.progressRule === 'band-up').sort((a, b) => a.area.localeCompare(b.area));
  const bandState = bandMoves.map((e) => {
    const hist = done.filter((s) => s.items.some((i) => i.exerciseId === e.id && i.sets.some((x) => x.done))).sort((a, b) => b.day.localeCompare(a.day));
    const last = hist[0]?.items.find((i) => i.exerciseId === e.id)?.sets.filter((x) => x.done).slice(-1)[0];
    return { e, load: last?.load, reps: last?.reps, sessions: hist.length };
  });

  // One move over time.
  const tracked = [...exercises.values()].filter((e) => done.some((s) => s.items.some((i) => i.exerciseId === e.id && i.sets.some((x) => x.done)))).filter((e) => e.area !== 'warmup' && e.area !== 'breathing' && e.area !== 'mobility');
  const trend = done.filter((s) => s.items.some((i) => i.exerciseId === exId && i.sets.some((x) => x.done))).sort((a, b) => a.day.localeCompare(b.day)).map((s) => { const it = s.items.find((i) => i.exerciseId === exId)!; const d = it.sets.filter((x) => x.done); const last = d[d.length - 1]; return { day: s.day, v: it.planned.seconds !== undefined ? Math.max(...d.map((x) => x.seconds ?? 0)) : (last?.reps ?? 0), unit: it.planned.seconds !== undefined ? 'best hold (sec)' : 'reps on the last set', band: last?.load }; });

  // Calendar: current month.
  const monthStart = day.slice(0, 8) + '01';
  const first = new Date(monthStart + 'T12:00:00');
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const cells: Array<Day | null> = [...Array.from({ length: lead }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => addDays(monthStart, i))];
  const marks = (d: Day) => ({ w: bandDays.some((s) => s.day === d), f: done.some((s) => s.day === d && !STRENGTH_KINDS.includes(s.kind)), s: activity.some((l) => l.day === d), j: journal.some((j) => j.day === d) });
  const bandName = (l?: string) => (l && BANDS.includes(l as Band) ? settings.bandNames[l as Band] : l === 'body' ? 'Body weight' : l ?? '–');
  const sinceStart = me ? Math.max(1, Math.round((new Date(day + 'T12:00:00').getTime() - new Date(me.programStart + 'T12:00:00').getTime()) / 86400000) + 1) : 0;
  const allDays = new Set([...done.map((s) => s.day), ...activity.map((a) => a.day)]).size;

  return (
    <div className="col">
      <h1>Progress</h1>
      <div className="small muted">Compared with your own earlier self only.{me ? ` Day ${sinceStart} since ${fmtDate(me.programStart)}.` : ''}</div>
      <div className="kpi">
        <div className="k"><div className="v">{ch.length}</div><div className="l">Chain</div></div>
        <div className="k"><div className="v">{allDays}<span className="small muted">/{sinceStart}</span></div><div className="l">Days with something</div></div>
        <div className="k"><div className="v">{bandDays.length}</div><div className="l">Band days</div></div>
        <div className="k"><div className="v">{done.filter((s) => s.kind === 'happybody').length}</div><div className="l">Happy Body</div></div>
        <div className="k"><div className="v">{done.filter((s) => s.kind === 'floor').length}</div><div className="l">Floor days</div></div>
        <div className="k"><div className="v">{achievements.length}</div><div className="l">Milestones</div></div>
      </div>

      <div className="card">
        <h3>Days with something (last 8 weeks)</h3>
        <Bars values={perWeek} labels={weeks.map((w) => fmtDate(w).replace(/^\w+,? /, ''))} max={7} />
        <div className="small muted">Band days per week: {bandsPerWeek.join(' · ')} (target {settings.strengthDaysPerWeek})</div>
      </div>

      {settings.weighIns && weighIns.length > 0 && (
        <div className="card">
          <div className="row between"><h3>Weigh-ins</h3><span className="small muted">{weighIns[weighIns.length - 1].lbs} lb{me?.goalWeightLbs ? ` · goal ${me.goalWeightLbs}` : ''}</span></div>
          {weighIns.length >= 2 ? <Spark values={weighIns.map((w) => w.lbs)} labels={weighIns.map((w) => fmtDate(w.day).replace(/^\w+,? /, ''))} /> : <div className="small muted mt">One point so far. The line starts next week.</div>}
          {weighIns.length >= 2 && <div className="small muted">{(() => { const a = weighIns[0]; const b = weighIns[weighIns.length - 1]; const wk = Math.max(1, (new Date(b.day).getTime() - new Date(a.day).getTime()) / (7 * 86400000)); const rate = (b.lbs - a.lbs) / wk; return `${rate > 0 ? '+' : ''}${rate.toFixed(1)} lb a week over ${Math.round(wk)} week${Math.round(wk) === 1 ? '' : 's'}. The book's pace is a pound or two down, kept.`; })()}</div>}
        </div>
      )}

      {bandState.some((b) => b.sessions > 0) && (
        <div className="card">
          <h3>Where you are on each band move</h3>
          <div className="list mt">{bandState.filter((b) => b.sessions > 0).map((b) => <Link key={b.e.id} className="item tappable" to={`/exercises/${b.e.id}`}><div className="grow"><div className="title">{b.e.name}</div><div className="sub">{bandName(b.load)} · {b.reps ?? '–'} reps last time · {b.sessions} session{b.sessions === 1 ? '' : 's'}</div></div><span className="chev">›</span></Link>)}</div>
        </div>
      )}

      {tracked.length > 0 && (
        <div className="card">
          <h3>One move over time</h3>
          <div className="chips mt">{tracked.map((e) => <button key={e.id} className={`chip sm ${exId === e.id ? 'on' : ''}`} onClick={() => setExId(e.id)}>{e.name}</button>)}</div>
          {trend.length ? <><div className="small muted mt">{trend[0].unit}{trend[trend.length - 1].band && trend[trend.length - 1].band !== 'body' ? ` · now on ${bandName(trend[trend.length - 1].band)}` : ''}</div><Spark values={trend.map((t) => t.v)} labels={trend.map((t) => fmtDate(t.day).replace(/^\w+,? /, ''))} /></> : <div className="small muted mt">Pick a move.</div>}
        </div>
      )}

      <div className="card">
        <div className="row between"><h3>{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3><span className="tiny muted">● bands · ● other day · ● activity · ● note</span></div>
        <div className="cal mt">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((h, i) => <div key={i} className="h">{h}</div>)}
          {cells.map((d, i) => d ? (() => { const m = marks(d); const has = m.w || m.f || m.s || m.j; return <button key={i} className={`d ${has ? 'has' : ''} ${d === day ? 'today' : ''}`} onClick={() => setPick(d)}><span>{Number(d.slice(8))}</span><span className="marks">{m.w && <i className="w" />}{m.f && <i className="f" />}{m.s && <i className="s" />}{m.j && <i className="j" />}</span></button>; })() : <div key={i} />)}
        </div>
      </div>

      <div className="card">
        <h3>Milestones</h3>
        <div className="list mt">
          {BADGES.map((b) => { const a = achievements.find((x) => x.key === b.key); return <div key={b.key} className={`badge ${a ? '' : 'locked'}`}><div className="medal">{a ? '★' : '·'}</div><div className="grow"><div><strong>{b.title}</strong></div><div className="small muted">{b.text}{a ? ` · ${fmtDate(a.earnedAt.slice(0, 10))}` : ''}</div></div></div>; })}
        </div>
        <p className="small muted mt">Earned, never lost. A missed day changes nothing here.</p>
      </div>

      {pick && (
        <Sheet title={fmtDate(pick)} onClose={() => setPick(null)}>
          {(() => {
            const ss = sessions.filter((s) => s.day === pick && s.status !== 'planned');
            const ls = activity.filter((l) => l.day === pick);
            const js = journal.filter((j) => j.day === pick);
            const c = checkIns.find((x) => x.day === pick);
            const w = weighIns.find((x) => x.day === pick);
            if (!ss.length && !ls.length && !js.length && !c && !w) return <div className="small muted">Nothing logged.</div>;
            return (
              <div className="list">
                {c && <div className="item"><div className="grow"><div className="title">Check-in: {COLOR_WORDS[c.color]} day</div><div className="sub">Sleep {c.sleep}/5 · Energy {c.energy}/5 · Stress {c.stress}/5{c.note ? ` · "${c.note}"` : ''}</div></div></div>}
                {w && <div className="item"><div className="grow"><div className="title">Weigh-in: {w.lbs} lb</div></div><button className="btn ghost sm" onClick={() => deleteWithTombstone('weighIns', w.id)}>Remove</button></div>}
                {ss.map((s) => <Link key={s.id} className="item tappable" to={`/sessions/${s.id}`} onClick={() => setPick(null)}><div className="grow"><div className="title">{s.templateName}</div><div className="sub">{s.status}{s.note ? ` · "${s.note}"` : ''}</div></div><span className="chev">›</span></Link>)}
                {ls.map((l) => <ActivityRow key={l.id} log={l} onRemove={() => deleteWithTombstone('activity', l.id)} />)}
                {js.map((j) => <div key={j.id} className="item"><div className="grow"><div className="sub">Note</div><div>{j.text}</div></div></div>)}
              </div>
            );
          })()}
        </Sheet>
      )}
    </div>
  );
}
