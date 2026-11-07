import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useExercise, useExerciseMap, useSessions, useSettings, fmtDate } from '../hooks';
import { Figure } from '../components/Figure';
import { AREA_WORDS } from '../../data/exercises';
import { doseText, lastLoad, loadWord } from '../../engine/program';
import { Spark } from '../components/Charts';
import { activeBands, bandShort, type Band } from '../../engine/types';

/** One move: what it builds, why it matters, how to do it, mistakes, when to skip, versions, official links, and your own history with it. */
export function ExercisePage() {
  const { exerciseId } = useParams();
  const e = useExercise(exerciseId);
  const all = useExerciseMap();
  const sessions = useSessions();
  const settings = useSettings();
  if (!e) return <div className="empty">Loading…</div>;
  const history = sessions.filter((s) => s.status === 'done').flatMap((s) => s.items.filter((i) => i.exerciseId === e.id && i.sets.some((x) => x.done)).map((i) => ({ day: s.day, item: i }))).sort((a, b) => a.day.localeCompare(b.day));
  const series = history.map((h) => { const done = h.item.sets.filter((x) => x.done); const last = done[done.length - 1]; return h.item.planned.seconds !== undefined ? Math.max(...done.map((x) => x.seconds ?? 0)) : (last?.reps ?? 0); });
  const unit = e.defaultDose.seconds !== undefined ? 'best hold (sec)' : 'reps on the last set';
  const band = e.progressRule === 'band-up';
  const cur = lastLoad(e, sessions, settings.bandNames);
  return (
    <div className="col">
      <div className="row between"><Link className="btn sm" to="/workouts">‹ Days</Link><span className="pill">{AREA_WORDS[e.area]}</span></div>
      <div className="card">
        <h1>{e.name}</h1>
        <div className="small muted">Usual dose {doseText(e.defaultDose)}{e.loads.length > 1 ? ` · ${e.loads.map((l) => loadWord(l, settings.bandNames).toLowerCase()).join(' or ')}` : ''}</div>
        <Figure pose={e.pose} />
        <p><strong>Builds:</strong> {e.develops}</p>
        <p><strong>Why it matters:</strong> {e.why}</p>
      </div>
      <div className="card">
        <h3>How to do it</h3>
        <ol className="step-list">{e.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        <div className="chips">{e.cues.map((c) => <span key={c} className="cue">{c}</span>)}</div>
      </div>
      {e.links && e.links.length > 0 && (
        <div className="card">
          <h3>Watch it</h3>
          <div className="list mt">{e.links.map((l) => <a key={l.url} className="item tappable" href={l.url} target="_blank" rel="noopener noreferrer"><div className="grow"><div className="title">{l.title}</div><div className="sub">{l.url.replace(/^https?:\/\//, '').split('/')[0]} · opens in the browser</div></div><span className="chev">↗</span></a>)}</div>
        </div>
      )}
      {e.commonErrors.length > 0 && <div className="card"><h3>Common mistakes</h3><ul className="step-list">{e.commonErrors.map((x, i) => <li key={i}><strong>{x.error}.</strong> {x.fix}</li>)}</ul></div>}
      <div className="card"><h3>Skip it when</h3><ul className="step-list">{e.skipIf.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
      {band && (
        <div className="card">
          <h3>Progression</h3>
          <p className="small">{history.length ? `Last time: ${loadWord(cur.load, settings.bandNames)}, ${history[history.length - 1].item.sets.filter((x) => x.done).slice(-1)[0]?.reps ?? '–'} reps.` : 'Not done yet.'} Forty clean reps twice in a row with the same band and the next band is offered on the card. Under fifteen and the band below is on the card next time. The app never changes the band itself; you pick it each set.</p>
          <div className="chips mt">{activeBands(settings.bandNames).map((b) => <span key={b} className={`chip sm ${cur.load === b ? 'on' : ''}`}>{bandShort(settings.bandNames, b as Band)}</span>)}</div>
        </div>
      )}
      {(e.easier || e.harder || e.substitutes.length > 0) && (
        <div className="card">
          <h3>Versions</h3>
          <div className="list mt">
            {e.easier && all.get(e.easier) && <Link className="item tappable" to={`/exercises/${e.easier}`}><div className="grow"><div className="title">{all.get(e.easier)!.name}</div><div className="sub">Easier</div></div><span className="chev">›</span></Link>}
            {e.harder && all.get(e.harder) && <Link className="item tappable" to={`/exercises/${e.harder}`}><div className="grow"><div className="title">{all.get(e.harder)!.name}</div><div className="sub">Harder</div></div><span className="chev">›</span></Link>}
            {e.substitutes.map((id) => all.get(id) && <Link key={id} className="item tappable" to={`/exercises/${id}`}><div className="grow"><div className="title">{all.get(id)!.name}</div><div className="sub">Can stand in for it</div></div><span className="chev">›</span></Link>)}
          </div>
        </div>
      )}
      <div className="card">
        <h3>Your history</h3>
        {history.length === 0 ? <div className="small muted mt">Not done yet.</div> : (
          <>
            <div className="small muted mt">{history.length} session{history.length === 1 ? '' : 's'} · {unit}</div>
            <Spark values={series} labels={history.map((h) => fmtDate(h.day))} />
            <div className="list mt">{history.slice(-5).reverse().map((h, i) => <div key={i} className="item"><div className="grow"><div className="title">{fmtDate(h.day)}</div><div className="sub">{h.item.sets.filter((x) => x.done).map((x) => (x.seconds !== undefined ? `${x.seconds}s` : `${x.reps}${x.partials ? `+${x.partials}` : ''}${x.load !== 'body' ? ` @ ${loadWord(x.load, settings.bandNames, x.lbs)}` : ''}${x.toFailure ? ' (failure)' : ''}`)).join(' · ')}{h.item.feltGood === false ? ' · did not feel great' : ''}{h.item.note ? ` · "${h.item.note}"` : ''}</div></div></div>)}</div>
          </>
        )}
      </div>
    </div>
  );
}
