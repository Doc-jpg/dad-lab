import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProfile, useCheckIns, useExercises, useSessions, useSettings, useActivity, useTemplates, useToday, fmtDate } from '../hooks';
import { readinessFor, planSession, type TodayContext } from '../../engine/today';
import { AREA_WORDS } from '../../data/exercises';
import type { Area, Exercise } from '../../engine/types';
import { Sheet } from '../components/Sheet';

/** The days at the top, the whole library under them, history at the bottom. */
export function WorkoutsPage() {
  const nav = useNavigate();
  const day = useToday();
  const me = useProfile();
  const settings = useSettings();
  const templates = useTemplates();
  const exercises = useExercises();
  const sessions = useSessions();
  const activity = useActivity();
  const checkIns = useCheckIns();
  const [q, setQ] = useState('');
  const [area, setArea] = useState<Area | 'all'>('all');
  const [confirm, setConfirm] = useState<string | null>(null);
  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const checkIn = checkIns.find((c) => c.day === day);
  const ctx: TodayContext | undefined = me ? { day, checkIn, activity, sessions, templates, exercises: exMap, settings } : undefined;
  const readiness = ctx && templates.length ? readinessFor(ctx) : undefined;
  if (!me || !ctx) return null;

  const startTemplate = async (id: string) => {
    if (!checkIn) { nav('/today'); return; }
    if (!readiness) return;
    const s = await planSession(id, readiness, ctx);
    nav(`/workout/${s.id}`);
  };
  const pick = (id: string) => {
    if (!checkIn) { nav('/today'); return; }
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    const easy = t.kind === 'floor' || t.kind === 'walk' || t.kind === 'stretch';
    if (readiness?.color === 'red' && !easy) { setConfirm('red'); return; }
    if (readiness?.offer?.templateId !== id && !easy && !readiness?.alternatives.some((a) => a.templateId === id)) setConfirm(id);
    else startTemplate(id);
  };

  const visible = exercises.filter((e) => !e.archived && (area === 'all' || e.area === area) && (!q || e.name.toLowerCase().includes(q.toLowerCase()) || e.develops.toLowerCase().includes(q.toLowerCase())));
  const byArea = new Map<Area, Exercise[]>();
  for (const e of visible) byArea.set(e.area, [...(byArea.get(e.area) ?? []), e]);
  const history = sessions.filter((s) => s.status !== 'planned').slice(0, 30);

  return (
    <div className="col">
      <h1>Days</h1>
      <div className="small muted">Six kinds of day. The one with the colored edge is today's pick; the rest are a tap away.</div>
      <div className="list" data-tour="templates">
        {templates.filter((t) => !t.archived).map((t) => (
          <button key={t.id} className="item tappable" onClick={() => pick(t.id)} style={readiness?.offer?.templateId === t.id ? { borderColor: 'var(--accent)' } : undefined}>
            <div className="grow"><div className="title">{t.name} <span className="small muted">· {t.minutes} min</span></div><div className="sub">{t.summary}</div></div>
            <span className="chev">›</span>
          </button>
        ))}
      </div>
      <p className="small muted">Picking a different one is always allowed; on a day it would rather you did not, the app says what it thinks first.</p>

      <div className="section-title"><h2>Every move</h2><span className="small muted">{exercises.filter((e) => !e.archived).length}</span></div>
      <input className="input" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        <button className={`chip sm ${area === 'all' ? 'on' : ''}`} onClick={() => setArea('all')}>All</button>
        {(Object.keys(AREA_WORDS) as Area[]).map((a) => <button key={a} className={`chip sm ${area === a ? 'on' : ''}`} onClick={() => setArea(a)}>{AREA_WORDS[a]}</button>)}
      </div>
      {[...byArea.entries()].map(([a, list]) => (
        <div key={a} className="section">
          <h3>{AREA_WORDS[a]}</h3>
          <div className="list mt">
            {list.map((e) => (
              <Link key={e.id} className="item tappable" to={`/exercises/${e.id}`}>
                <div className="grow"><div className="title">{e.name}</div><div className="sub">{e.develops}</div></div>
                {e.progressRule === 'band-up' && <span className="pill">bands</span>}
              </Link>
            ))}
          </div>
        </div>
      ))}

      <div className="section-title"><h2>History</h2></div>
      {history.length === 0 ? <div className="empty">No sessions yet.</div> : (
        <div className="list">{history.map((s) => <Link key={s.id} className="item tappable" to={`/sessions/${s.id}`}><div className="grow"><div className="title">{s.templateName}</div><div className="sub">{fmtDate(s.day)} · {s.status === 'done' ? `${s.items.filter((i) => i.sets.some((x) => x.done)).length} moves${s.minutes ? ` · ${s.minutes} min` : ''}` : s.status}</div></div><span className="chev">›</span></Link>)}</div>
      )}

      {confirm === 'red' && <Sheet title="Not today" onClose={() => setConfirm(null)}><p>Your check-in says something hurts or you are sick. Nothing loads today. The floor, a walk or the easy parts of the stretch still count; tomorrow is a new check-in.</p></Sheet>}
      {confirm && confirm !== 'red' && (
        <Sheet title="Different from the recommendation" onClose={() => setConfirm(null)} footer={<><button className="btn" onClick={() => setConfirm(null)}>Go with the recommendation</button><button className="btn primary" onClick={() => { const id = confirm; setConfirm(null); startTemplate(id); }}>Do it anyway</button></>}>
          <p>Today the app suggests <strong>{readiness?.offer?.name ?? 'the floor'}</strong>. Reasons:</p>
          <ul className="why">{readiness?.reasons.map((r, i) => <li key={i}>{r}</li>)}{readiness?.blockedWhy.map((r, i) => <li key={'b' + i}>{r}</li>)}</ul>
          <p className="small muted">If you go ahead on a yellow or orange day it is one set each and no band up, and any joint you marked sore stays swapped out. Your call.</p>
        </Sheet>
      )}
    </div>
  );
}
