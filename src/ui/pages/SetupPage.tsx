import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProfile, saveSettings, seedLibrary } from '../../db/db';
import { startFamily, joinFamily, familyLink, formatCode, deviceName, syncNow } from '../../io/sync';
import { SYNC_AVAILABLE } from '../../sync-config';
import { useToast } from '../components/Sheet';
import { useProfile } from '../hooks';
import { useTour } from '../components/Tour';
import type { ThemeChoice, Band, Settings } from '../../engine/types';
import { nowIso, DEFAULT_BAND_NAMES, BANDS } from '../../engine/types';
import { APP_NAME } from '../version';

/**
 * First run, one person. Name, how many band days a week, band names, then a device code so the
 * phone, the iPad and the laptop stay in step. A second device joins with the link or the code.
 */
export function SetupPage() {
  const nav = useNavigate();
  const me = useProfile();
  const tour = useTour();
  const [step, setStep] = useState<'who' | 'me' | 'link' | 'join'>('who');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const toast = useToast();
  const [name, setName] = useState('Deren');
  const [days, setDays] = useState<Settings['strengthDaysPerWeek']>(4);
  const [bands, setBands] = useState<Record<Band, string>>({ ...DEFAULT_BAND_NAMES });
  const [theme, setTheme] = useState<ThemeChoice>('slate');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const finish = async () => {
    if (!name.trim()) { setErr('A first name, so the app can say good morning.'); return; }
    setErr('');
    setBusy(true);
    await seedLibrary();
    await createProfile({ firstName: name.trim(), theme });
    await saveSettings({ strengthDaysPerWeek: days, bandNames: bands, createdAt: nowIso() });
    if (SYNC_AVAILABLE) {
      const fam = await startFamily(deviceName());
      setSecret(fam.secret);
      syncNow().catch(() => undefined);
      setBusy(false);
      setStep('link');
    } else {
      setBusy(false);
      nav('/today');
    }
  };

  const shareLink = async () => {
    const url = familyLink(secret);
    const nav2: any = navigator;
    try {
      if (nav2.share) { await nav2.share({ title: `${APP_NAME} device link`, text: `Open this on your other device to link it to ${APP_NAME}: ${url}` }); return; }
    } catch (e: any) { if (e?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); toast.show('Link copied'); } catch { toast.show(url); }
  };

  const joinWithCode = async () => {
    setErr('');
    setBusy(true);
    try {
      await seedLibrary();
      await joinFamily(code, deviceName());
      const r = await syncNow();
      if (r.error) throw new Error(r.error);
      setBusy(false);
      nav('/today');
    } catch (e: any) {
      setBusy(false);
      setErr(e?.message?.includes('20 characters') ? 'That code does not look right. It is 20 letters and numbers, shown under Settings, Linked devices, on the first device.' : `Could not connect: ${e?.message ?? 'unknown error'}. Check the signal and try again.`);
    }
  };

  if (me && (step === 'who' || step === 'me')) {
    return (
      <div className="col">
        <div className="card"><h2>Already set up</h2><p className="small muted">This device is {me.firstName}'s. Settings has the device link and everything else.</p>
        <button className="btn primary lg block" onClick={() => nav('/today')}>Open the app</button></div>
      </div>
    );
  }

  return (
    <div className="col">
      <div className="hero">
        <h1>{APP_NAME}</h1>
        <div className="sub">Something every day. Bands when you are fresh, the floor when you are not, and a check-in that picks which.</div>
      </div>

      {step === 'who' && (
        <div className="card">
          <h3>Is this the first device?</h3>
          <div className="col mt">
            <button className="btn lg block" style={{ minHeight: 72, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }} onClick={() => setStep('me')}><span>Yes, set it up here ›</span><span className="small muted" style={{ fontWeight: 500 }}>Two minutes. You get a link afterward for your other devices.</span></button>
            {SYNC_AVAILABLE && <button className="btn lg block" style={{ minHeight: 72, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }} onClick={() => setStep('join')}><span>No, link it to the one I already set up ›</span><span className="small muted" style={{ fontWeight: 500 }}>Open the link from the first device here, or type its code.</span></button>}
          </div>
        </div>
      )}

      {step === 'me' && (
        <div className="card">
          <h3>About you</h3>
          <div className="field"><label>First name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoCapitalize="words" /></div>
          <div className="field"><label>Band days a week to aim for (push and pull together)</label>
            <div className="btn-grid cols-5">{([2, 3, 4, 5, 6] as const).map((d) => <button key={d} className={`btn ${days === d ? 'primary' : ''}`} onClick={() => setDays(d)}>{d}</button>)}</div>
            <p className="small muted">The app never asks for more than this in a week. The other days get Happy Body, the stretch, or the five-minute floor. Change it any time in Settings.</p>
          </div>
          <div className="field"><label>Your bands, lightest to heaviest</label>
            {BANDS.map((b, i) => <input key={b} className="input mb" value={bands[b]} onChange={(e) => setBands({ ...bands, [b]: e.target.value })} placeholder={`Band ${i + 1}`} />)}
            <p className="small muted">Defaults are the X3 set. Call them whatever is written on yours.</p>
          </div>
          <div className="field"><label>Look</label>
            <div className="btn-grid cols-3">{([['slate', 'Slate'], ['minimal', 'Minimal'], ['warm', 'Dark']] as Array<[ThemeChoice, string]>).map(([k, label]) => <button key={k} className={`theme-swatch ${theme === k ? 'on' : ''}`} onClick={() => { setTheme(k); document.documentElement.setAttribute('data-theme', k); }}>{label}</button>)}</div>
          </div>
          {err && <div className="banner danger small">{err}</div>}
          <div className="row mt"><button className="btn" onClick={() => setStep('who')}>Back</button><button className="btn primary grow" disabled={busy} onClick={finish}>{busy ? 'Saving…' : 'Done'}</button></div>
        </div>
      )}

      {step === 'link' && (
        <div className="card">
          <h3>Your other devices</h3>
          <p className="small muted">Phone, iPad, laptop: install the same address on each and open this link there. From then on they keep each other in step on their own. You can do this later from Settings too.</p>
          <button className="btn primary lg block" onClick={shareLink}>Send myself the link</button>
          <p className="small muted mt">Or type this code there under "link it to the one I already set up": <strong className="mono">{formatCode(secret)}</strong></p>
          <button className="btn block mt" onClick={() => { nav('/today'); setTimeout(tour.start, 200); }}>Take the one-minute tour</button>
          <button className="btn ghost block" onClick={() => nav('/today')}>Skip the tour</button>
        </div>
      )}

      {step === 'join' && (
        <div className="card">
          <h3>Link this device</h3>
          <p className="small muted">Open the link from the first device on this one, or type the code it shows under Settings, Linked devices.</p>
          <div className="field"><label>Device code</label><input className="input mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXXX-XXXXX-XXXXX-XXXXX" autoCapitalize="characters" autoCorrect="off" spellCheck={false} /></div>
          {err && <div className="banner danger small">{err}</div>}
          <div className="row mt"><button className="btn" onClick={() => setStep('who')}>Back</button><button className="btn primary grow" disabled={busy} onClick={joinWithCode}>{busy ? 'Connecting…' : 'Connect'}</button></div>
        </div>
      )}
      {toast.el}
    </div>
  );
}
