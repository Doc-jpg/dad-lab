import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProfile, useSettings } from '../hooks';
import { saveSettings } from '../../db/db';
import { nowIso } from '../../engine/types';

/**
 * A one-minute guided tour on the real screens with the real buttons lit. Offered once on Today,
 * from the last setup step, and from Help any time. Finishing or skipping stamps settings.tourSeenAt.
 */
interface Stop { route: string; anchor?: string; title: string; text: string }

const STOPS: Stop[] = [
  { route: '/today', anchor: 'checkin', title: 'Start with how you feel', text: 'Tap Check in: sleep, energy, stress, soreness, how much time you have, and anything you already did. Twenty seconds. The app picks the day from that.' },
  { route: '/today', anchor: 'ready', title: 'Green, yellow, orange, red', text: 'Green: the planned day, usually bands. Yellow: lighter, the stretch or Happy Body. Orange: the five-minute floor. Red: sick or hurt, still the floor. There is always something. It always says why.' },
  { route: '/today', anchor: 'start', title: 'Start, or pick another', text: 'Start opens the day one move at a time with the band, the rep range and the cues. The other days that fit are listed under it. Skipping is allowed; the floor is still there at bedtime.' },
  { route: '/today', anchor: 'chain', title: 'The chain', text: 'Days in a row with something done, and band days this week against your target. A five-minute floor day keeps the chain alive. That is the whole idea.' },
  { route: '/workouts', anchor: 'templates', title: 'The days and every move', text: 'Push day, Pull day, Happy Body, Stretch, The floor, Walk. Below them, every move with what it builds, why it matters, the steps and the common mistakes.' },
  { route: '/progress', title: 'Progress against yourself only', text: 'The chain, band days per week, which band you are on for each move, the weekly weigh-in trend. Milestones here are never taken away.' },
  { route: '/habits', title: 'The boring stuff that works', text: 'Water, meals on the clock, a walk, seven hours, five minutes of relaxation, nothing heavy late. Tap what you did.' },
  { route: '/journal', title: 'Notes in your own words', text: '"Rows felt strong." "Shoulder tight on the press." Short notes like that are what you look back at.' },
  { route: '/settings', anchor: 'sync', title: 'Your other devices', text: 'Settings has the link that keeps the phone, the iPad and the laptop in step, band names, days per week, backups and the tour.' }
];

interface TourApi { start: () => void; active: boolean }
const TourCtx = createContext<TourApi>({ start: () => undefined, active: false });
export const useTour = () => useContext(TourCtx);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [step, setStep] = useState<number | null>(null);
  const api = useMemo(() => ({ start: () => setStep(0), active: step !== null }), [step]);
  return (
    <TourCtx.Provider value={api}>
      {children}
      {step !== null && <TourOverlay step={step} setStep={setStep} />}
    </TourCtx.Provider>
  );
}

function TourOverlay({ step, setStep }: { step: number; setStep: (s: number | null) => void }) {
  const nav = useNavigate();
  const loc = useLocation();
  const stop = STOPS[step];
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => { if (loc.pathname !== stop.route) nav(stop.route); }, [step]);
  useLayoutEffect(() => {
    let tries = 0;
    let timer: number | undefined;
    const find = () => (stop.anchor ? (document.querySelector(`[data-tour="${stop.anchor}"]`) as HTMLElement | null) : null);
    const measure = () => {
      const el = find();
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior }); setRect(el.getBoundingClientRect()); }
      else { setRect(null); if (stop.anchor && tries++ < 8) timer = window.setTimeout(measure, 120); }
    };
    timer = window.setTimeout(measure, 80);
    const onMove = () => { const el = find(); if (el) setRect(el.getBoundingClientRect()); };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => { window.clearTimeout(timer); window.removeEventListener('resize', onMove); window.removeEventListener('scroll', onMove, true); };
  }, [step, loc.pathname]);
  const finish = async () => { setStep(null); await saveSettings({ tourSeenAt: nowIso() }); nav('/today'); };
  const pad = 6;
  const cardOnTop = rect ? rect.top + rect.height / 2 > window.innerHeight * 0.55 : false;
  return (
    <>
      {rect ? <div className="tour-spot" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} /> : <div className="tour-mask" style={{ background: 'rgba(10,14,20,0.5)' }} />}
      <div className={`tour-card ${cardOnTop ? 'top' : ''}`} role="dialog" aria-label="Guided tour">
        <div className="step">Tour · {step + 1} of {STOPS.length}</div>
        <h3>{stop.title}</h3>
        <p className="small" style={{ margin: '4px 0 10px' }}>{stop.text}</p>
        <div className="row between">
          <button className="btn ghost sm" onClick={finish}>{step + 1 < STOPS.length ? 'Skip the rest' : 'Done'}</button>
          <div className="row">
            {step > 0 && <button className="btn sm" onClick={() => setStep(step - 1)}>Back</button>}
            {step + 1 < STOPS.length ? <button className="btn primary" onClick={() => setStep(step + 1)}>Next ›</button> : <button className="btn primary" onClick={finish}>Done, let's go</button>}
          </div>
        </div>
      </div>
    </>
  );
}

export function TourOffer() {
  const settings = useSettings();
  const athlete = useProfile();
  const tour = useTour();
  if (!athlete || settings.tourSeenAt || tour.active) return null;
  return (
    <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
      <div className="row between">
        <div className="grow"><strong>New here?</strong><div className="small muted">A one-minute tour of the five screens.</div></div>
        <div className="row">
          <button className="btn ghost sm" onClick={() => saveSettings({ tourSeenAt: nowIso() })}>Not now</button>
          <button className="btn primary sm" onClick={tour.start}>Take the tour</button>
        </div>
      </div>
    </div>
  );
}
