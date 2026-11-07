import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useProfile, useCheckIns, useExerciseMap, useMessagesShown, useSessions, useSettings, useActivity, useTemplates, useToday, useWeighIns, fmtDateLong, fmtDate } from '../hooks';
import { CheckInSheet, ActivityCard, newActivityDraft, toLog, type ActivityDraft, type CheckInDraft } from '../components/CheckInSheet';
import { Sheet, useToast } from '../components/Sheet';
import { TourOffer } from '../components/Tour';
import { readinessFor, recordCheckIn, planSession, ensureMessageShown, type TodayContext } from '../../engine/today';
import { addActivity, db, updateSession, saveWeighIn, deleteWithTombstone } from '../../db/db';
import { pickMessage, daysSinceLastSession, CATEGORY_WORDS } from '../../engine/habits';
import { addDays, ACTIVITY_WORDS, DURATION_WORDS, INTENSITY_WORDS, KIND_WORDS, STRENGTH_KINDS, type ActivityLog, type Activity } from '../../engine/types';
import { COLOR_WORDS, chain, weekStartOf } from '../../engine/readiness';

export function TodayPage() {
  const nav = useNavigate();
  const day = useToday();
  const me = useProfile();
  const settings = useSettings();
  const activity = useActivity();
  const sessions = useSessions();
  const checkIns = useCheckIns();
  const templates = useTemplates();
  const exercises = useExerciseMap();
  const shown = useMessagesShown();
  const weighIns = useWeighIns();
  const toast = useToast();
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [actOpen, setActOpen] = useState<ActivityDraft | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [weight, setWeight] = useState('');

  const checkIn = checkIns.find((c) => c.day === day);
  const todayActivity = activity.filter((l) => l.day === day);
  const ctx: TodayContext | undefined = useMemo(() => (me ? { day, checkIn, activity, sessions, templates, exercises, settings } : undefined), [day, me, checkIn, activity, sessions, templates, exercises, settings]);
  const readiness = useMemo(() => (ctx && templates.length ? readinessFor(ctx) : undefined), [ctx, templates.length]);
  const todaySessions = sessions.filter((s) => s.day === day);
  const openSession = todaySessions.find((s) => s.status === 'planned' || s.status === 'in_progress');
  const doneToday = todaySessions.filter((s) => s.status === 'done');
  const yesterday = addDays(day, -1);
  const ySessions = sessions.filter((s) => s.day === yesterday && s.status === 'done');
  const yActivity = activity.filter((l) => l.day === yesterday);
  const ch = useMemo(() => chain(sessions, activity, day), [sessions, activity, day]);
  const bandsToday = doneToday.some((s) => STRENGTH_KINDS.includes(s.kind));
  const ws = weekStartOf(day);
  const weighedThisWeek = weighIns.some((w) => w.day >= ws && w.day <= day);
  const lastWeigh = weighIns[weighIns.length - 1];

  const message = useMemo(() => pickMessage({ day, color: readiness?.color, todayActivity, chain: ch.length, daysSinceSession: daysSinceLastSession(sessions, day), sleepLow: checkIn ? checkIn.sleep <= 2 : false, stressHigh: checkIn ? checkIn.stress >= 4 : false, bandsToday, shown, rotationDays: settings.reminders.rotationDays }, settings.reminders), [day, readiness?.color, todayActivity.length, ch.length, sessions.length, checkIn?.sleep, checkIn?.stress, bandsToday, shown.length, settings.reminders]);
  useEffect(() => { if (message) ensureMessageShown(day, message.key, message.category).catch(() => undefined); }, [message?.key, day]);

  if (!me || !ctx) return null;
  const name = me.firstName;

  const saveCheckIn = async (acts: ActivityDraft[], draft: CheckInDraft) => {
    for (const a of acts) await addActivity(toLog(a, day));
    const fresh = await db.activity.toArray();
    const { readiness: r } = await recordCheckIn({ ...draft, day }, { ...ctx, activity: fresh });
    setCheckInOpen(false);
    toast.show(`${COLOR_WORDS[r.color]} day: ${r.headline}`);
  };

  const start = async (templateId: string) => {
    if (!checkIn) { setCheckInOpen(true); return; }
    if (!readiness) return;
    const existing = todaySessions.find((s) => s.templateId === templateId && (s.status === 'planned' || s.status === 'in_progress'));
    if (existing) { nav(`/workout/${existing.id}`); return; }
    const s = await planSession(templateId, readiness, ctx);
    nav(`/workout/${s.id}`);
  };

  const skip = async () => {
    if (openSession) await updateSession(openSession.id, { status: 'skipped' });
    toast.show('Skipped. The floor is still there if you change your mind.');
  };

  const minutesFor = (templateId: string) => templates.find((t) => t.id === templateId)?.minutes ?? 15;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

  return (
    <div className="col">
      <div className="hero">
        <div className="row between">
          <div><h1>{greet}, {name}</h1><div className="sub">{fmtDateLong(day)}</div></div>
          <Link to="/settings" className="btn sm" style={{ background: 'rgba(255,255,255,.18)', color: '#fff', borderColor: 'transparent' }} aria-label="Settings">⚙︎</Link>
        </div>
        <div className="row mt" style={{ gap: 14 }} data-tour="chain">
          <div><div className="hero-num">{ch.length}</div><div className="small" style={{ opacity: .85 }}>{ch.length === 1 ? 'day' : 'days'} in a row{ch.aliveToday ? '' : ch.length ? ', today still open' : ''}</div></div>
          <div><div className="hero-num">{readiness?.week.strengthDone ?? 0}<span className="small" style={{ opacity: .7 }}>/{settings.strengthDaysPerWeek}</span></div><div className="small" style={{ opacity: .85 }}>band days this week</div></div>
        </div>
      </div>
      <TourOffer />

      {/* 1. Check-in */}
      <div className="card" data-tour="checkin">
        {checkIn ? (
          <div className="row between">
            <div className="grow"><strong>Checked in</strong><div className="small muted">Sleep {checkIn.sleep}/5 · Energy {checkIn.energy}/5 · Stress {checkIn.stress}/5 · {checkIn.soreness === 'none' ? 'Not sore' : checkIn.soreness === 'some' ? 'A little sore' : 'Very sore'} · {checkIn.time === 45 ? '45+ min' : `${checkIn.time} min`}{checkIn.pain ? ' · Something hurts' : ''}{checkIn.sick ? ' · Sick' : ''}</div></div>
            <button className="btn sm" onClick={() => setCheckInOpen(true)}>Change</button>
          </div>
        ) : (
          <div className="col">
            <div><strong>How are you today?</strong><div className="small muted">Sleep, energy, stress, soreness, time. Twenty seconds, then the app picks the day.</div></div>
            <button className="btn primary xl block" onClick={() => setCheckInOpen(true)}>Check in</button>
          </div>
        )}
      </div>

      {/* 2. The day */}
      {readiness && (
        <div className={`ready ${checkIn ? readiness.color : 'green'}`} data-tour="ready">
          <div className="row between">
            <div className="row"><span className="color-dot" /><h2>{checkIn ? readiness.headline : 'Check in for today'}</h2></div>
            <span className={`pill ${checkIn ? readiness.color : ''}`}>{checkIn ? COLOR_WORDS[readiness.color] : 'Before check-in'}</span>
          </div>
          {checkIn && (
            <>
              <ul className="why">{readiness.reasons.slice(0, 3).map((r, i) => <li key={i}>{r}</li>)}{readiness.blockedWhy.map((r, i) => <li key={'b' + i}>{r}</li>)}</ul>
              {readiness.reasons.length > 3 && <button className="btn ghost sm" onClick={() => setWhyOpen(true)}>Why this day</button>}
            </>
          )}
          {!checkIn && <div className="small muted mt">The day is picked from the check-in, the last two weeks of sessions, and what else you already did.</div>}
        </div>
      )}

      {/* 3. Start */}
      <div className="card" data-tour="start">
        {doneToday.length > 0 ? (
          <div className="col">
            {doneToday.map((s) => <div key={s.id} className="row between"><div><strong>{s.templateName} done</strong><div className="small muted">{s.minutes ? `${s.minutes} min · ` : ''}{s.items.filter((i) => i.sets.some((x) => x.done)).length} moves. Day in the chain.</div></div><Link className="btn sm" to={`/sessions/${s.id}`}>Summary</Link></div>)}
            {readiness && readiness.offer.templateId !== doneToday[0].templateId && readiness.color !== 'red' && (
              <div className="row between" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                <div className="grow"><strong>Bonus: {readiness.offer.name}</strong><div className="small muted">Only if you want it. The day already counts.</div></div>
                <button className="btn sm" onClick={() => start(readiness.offer.templateId)}>Do it</button>
              </div>
            )}
          </div>
        ) : readiness ? (
          <div className="col">
            <div><strong>{checkIn ? 'Today: ' : 'A normal day would be: '}{readiness.offer.name}</strong><div className="small muted">About {minutesFor(readiness.offer.templateId)} minutes{readiness.offer.reduced && STRENGTH_KINDS.includes(readiness.offer.kind) ? ', one set each' : ''}.</div></div>
            {openSession && openSession.status === 'in_progress' ? (
              <button className="btn primary xl block" onClick={() => nav(`/workout/${openSession.id}`)}>Continue {openSession.templateName}</button>
            ) : (
              <button className="btn primary xl block" onClick={() => start(readiness.offer.templateId)}>{checkIn ? 'Start' : 'Check in, then start'}</button>
            )}
            {checkIn && readiness.alternatives.length > 0 && (
              <div className="list">
                {readiness.alternatives.map((a) => <button key={a.templateId} className="item tappable" onClick={() => start(a.templateId)} style={{ textAlign: 'left' }}><div className="grow"><div className="title">{KIND_WORDS[a.kind]} <span className="small muted">· {minutesFor(a.templateId)} min</span></div><div className="sub">{a.note}</div></div><span className="chev">›</span></button>)}
              </div>
            )}
            <div className="row">
              {openSession && <button className="btn grow" onClick={skip}>Skip today</button>}
              <Link className="btn grow" to="/workouts">All the days</Link>
            </div>
          </div>
        ) : null}
      </div>

      {/* 4. Weigh-in, weekly */}
      {settings.weighIns && checkIn && !weighedThisWeek && (
        <div className="card" data-tour="weigh">
          <div className="row between"><div className="grow"><strong>Weekly weigh-in</strong><div className="small muted">Once a week, same morning, after the bathroom, before coffee. Trend, not the number.{lastWeigh ? ` Last: ${lastWeigh.lbs} lb on ${fmtDate(lastWeigh.day)}.` : ''}</div></div></div>
          <div className="row mt"><input className="input grow" inputMode="decimal" placeholder="lb" value={weight} onChange={(e) => setWeight(e.target.value)} /><button className="btn primary" disabled={!parseFloat(weight)} onClick={async () => { await saveWeighIn(day, parseFloat(weight)); setWeight(''); toast.show('Logged'); }}>Save</button></div>
        </div>
      )}

      {/* 5. Other activity today */}
      <div className="card">
        <div className="row between"><h3>Else today</h3><button className="btn sm" onClick={() => setActOpen(newActivityDraft('walk'))}>+ Add</button></div>
        {todayActivity.length === 0 ? <div className="small muted">A walk, a round of golf, yard work: log it and it counts toward the day.</div> : (
          <div className="list mt">{todayActivity.map((l) => <ActivityRow key={l.id} log={l} onRemove={() => deleteWithTombstone('activity', l.id)} />)}</div>
        )}
      </div>

      {/* 6. Message */}
      {message && (
        <div className="msg" data-tour="message">
          <div className="cat">{CATEGORY_WORDS[message.category]}</div>
          <div className="text">{message.text}</div>
        </div>
      )}

      {/* 7. Yesterday */}
      <div className="card">
        <div className="row between"><h3>Yesterday</h3><Link className="small" to="/progress">All history</Link></div>
        {ySessions.length === 0 && yActivity.length === 0 ? <div className="small muted">Nothing logged {fmtDate(yesterday)}. Today is a new day; nothing to make up.</div> : (
          <div className="list mt">
            {ySessions.map((s) => <Link key={s.id} className="item tappable" to={`/sessions/${s.id}`}><div className="grow"><div className="title">{s.templateName}</div><div className="sub">{s.items.filter((i) => i.sets.some((x) => x.done)).length} moves{s.overallDifficulty ? ` · felt ${['', 'easy', 'pretty easy', 'okay', 'hard', 'very hard'][s.overallDifficulty]}` : ''}{s.note ? ` · "${s.note}"` : ''}</div></div><span className="chev">›</span></Link>)}
            {yActivity.map((l) => <ActivityRow key={l.id} log={l} />)}
          </div>
        )}
      </div>

      {checkInOpen && <CheckInSheet name={name} initial={checkIn ? { sleep: checkIn.sleep, sleepHours: checkIn.sleepHours, energy: checkIn.energy, stress: checkIn.stress, soreness: checkIn.soreness, soreWhere: checkIn.soreWhere ?? [], pain: checkIn.pain, painWhere: checkIn.painWhere, sick: checkIn.sick, time: checkIn.time, note: checkIn.note } : undefined} onSave={saveCheckIn} onClose={() => setCheckInOpen(false)} />}
      {actOpen && (
        <Sheet title="Add something you did" onClose={() => setActOpen(null)} footer={<><button className="btn" onClick={() => setActOpen(null)}>Cancel</button><button className="btn primary" onClick={async () => { await addActivity(toLog(actOpen, day)); setActOpen(null); toast.show('Added; it counts.'); }}>Add</button></>}>
          <div className="chips mb">{(['walk', 'run', 'bike', 'golf', 'yard', 'sport', 'lifting', 'other'] as Activity[]).map((s) => <button key={s} className={`chip sm ${actOpen.activity === s ? 'on' : ''}`} onClick={() => setActOpen({ ...actOpen, activity: s })}>{ACTIVITY_WORDS[s]}</button>)}</div>
          <ActivityCard draft={actOpen} onChange={setActOpen} onRemove={() => setActOpen(null)} />
        </Sheet>
      )}
      {whyOpen && readiness && (
        <Sheet title="Why this day" onClose={() => setWhyOpen(false)}>
          <ul className="why">{[...readiness.reasons, ...readiness.blockedWhy].map((r, i) => <li key={i}>{r}</li>)}</ul>
          <p className="small muted mt">This week (Sunday to Saturday): {readiness.week.strengthDone} of {readiness.week.strengthTarget} band days, {readiness.week.activeDays} active days so far.</p>
        </Sheet>
      )}
      {toast.el}
    </div>
  );
}

export function ActivityRow({ log, onRemove }: { log: ActivityLog; onRemove?: () => void }) {
  return (
    <div className="item">
      <div className="grow"><div className="title">{ACTIVITY_WORDS[log.activity]}{log.label ? ` · ${log.label}` : ''}</div><div className="sub">{DURATION_WORDS[log.duration]} · {INTENSITY_WORDS[log.intensity]}</div></div>
      {onRemove && <button className="btn ghost sm" onClick={onRemove}>Remove</button>}
    </div>
  );
}
