import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProfile, useSettings } from '../hooks';
import { addGoal, setGoalStatus, updateProfile, saveSettings, clearAll } from '../../db/db';
import { BackupPanel } from '../components/BackupPanel';
import { SyncCard } from '../components/SyncCard';
import { Confirm, useToast } from '../components/Sheet';
import { useTour } from '../components/Tour';
import type { ThemeChoice, Band, Settings } from '../../engine/types';
import { BANDS } from '../../engine/types';
import { APP_NAME, APP_VERSION } from '../version';

export function SettingsPage() {
  const nav = useNavigate();
  const me = useProfile();
  const settings = useSettings();
  const tour = useTour();
  const toast = useToast();
  const [goal, setGoal] = useState('');
  const [erase, setErase] = useState(false);
  const [bands, setBands] = useState<Record<Band, string> | null>(null);
  const [goalWeight, setGoalWeight] = useState<string | null>(null);
  if (!me) return null;
  const bn = bands ?? settings.bandNames;
  return (
    <div className="col">
      <div className="row between"><h1>Settings</h1><Link className="btn sm" to="/help">Help</Link></div>

      <div data-tour="sync"><SyncCard /></div>

      <div className="card">
        <h3>Band days a week</h3>
        <p className="small muted">Push and pull together. The app never offers more than this in a week on its own.</p>
        <div className="btn-grid cols-5 mt">{([2, 3, 4, 5, 6] as Settings['strengthDaysPerWeek'][]).map((d) => <button key={d} className={`btn ${settings.strengthDaysPerWeek === d ? 'primary' : ''}`} onClick={() => saveSettings({ strengthDaysPerWeek: d })}>{d}</button>)}</div>
      </div>

      <div className="card">
        <h3>Your bands, lightest to heaviest</h3>
        {BANDS.map((b, i) => <input key={b} className="input mb" value={bn[b]} onChange={(e) => setBands({ ...bn, [b]: e.target.value })} onBlur={async () => { if (bands) { await saveSettings({ bandNames: bands }); setBands(null); toast.show('Saved'); } }} placeholder={`Band ${i + 1} (blank if you do not have it)`} />)}
        <p className="small muted">The order is what matters for "next band". Blank slots are skipped. Defaults are the Draper's Strength set with the X3 band each one stands in for.</p>
      </div>

      <div className="card">
        <h3>Weekly weigh-in</h3>
        <div className="row between mt"><div className="grow small">Ask once a week on Today, and chart it under Progress.</div><button className={`btn sm ${settings.weighIns ? 'primary' : ''}`} onClick={() => saveSettings({ weighIns: !settings.weighIns })}>{settings.weighIns ? 'On' : 'Off'}</button></div>
        {settings.weighIns && <div className="row mt"><span className="small muted">Goal (optional, lb)</span><input className="input grow" inputMode="numeric" value={goalWeight ?? (me.goalWeightLbs ? String(me.goalWeightLbs) : '')} onChange={(e) => setGoalWeight(e.target.value)} onBlur={async () => { if (goalWeight !== null) { await updateProfile({ goalWeightLbs: parseFloat(goalWeight) || undefined }); setGoalWeight(null); } }} placeholder="for example 185" /></div>}
      </div>

      <div className="card">
        <h3>Look</h3>
        <div className="btn-grid cols-3 mt">
          {([['slate', 'Slate'], ['minimal', 'Minimal'], ['warm', 'Dark']] as Array<[ThemeChoice, string]>).map(([k, label]) => <button key={k} className={`theme-swatch ${me.theme === k ? 'on' : ''}`} onClick={() => updateProfile({ theme: k })}>{label}</button>)}
        </div>
      </div>

      <div className="card">
        <h3>Goals</h3>
        <p className="small muted">Your own words. "Dark gray band on the chest press." "Thirty days without a zero."</p>
        <div className="list mt">
          {me.goals.filter((g) => g.status === 'active').map((g) => <div key={g.id} className="item"><div className="grow">{g.text}</div><button className="btn sm" onClick={() => setGoalStatus(g.id, 'done')}>Done</button></div>)}
          {me.goals.filter((g) => g.status === 'done').slice(0, 3).map((g) => <div key={g.id} className="item" style={{ opacity: .6 }}><div className="grow"><s>{g.text}</s></div><span className="pill green">Done</span></div>)}
        </div>
        <div className="row mt"><input className="input grow" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="New goal" /><button className="btn primary" disabled={!goal.trim()} onClick={async () => { await addGoal(goal.trim()); setGoal(''); }}>Add</button></div>
      </div>

      <div className="card">
        <h3>Daily message</h3>
        <div className="row between mt"><div className="grow small">One line a day on Today. Quiet {settings.reminders.quietStart} to {settings.reminders.quietEnd}.</div><button className={`btn sm ${settings.reminders.enabled ? 'primary' : ''}`} onClick={() => saveSettings({ reminders: { ...settings.reminders, enabled: !settings.reminders.enabled } })}>{settings.reminders.enabled ? 'On' : 'Off'}</button></div>
      </div>

      <div className="card">
        <h3>Learn the app</h3>
        <div className="col mt">
          <button className="btn block" onClick={() => { nav('/today'); setTimeout(tour.start, 150); }}>Take the one-minute tour</button>
          <Link className="btn block" to="/help">Questions and answers</Link>
        </div>
      </div>

      <BackupPanel />

      <div className="card">
        <h3>Start over</h3>
        <p className="small muted">Erases everything on this device only. Linked devices and the cloud copy keep theirs; a fresh link brings it all back.</p>
        <button className="btn block mt" style={{ color: 'var(--danger)' }} onClick={() => setErase(true)}>Erase this device</button>
      </div>

      <div className="card">
        <div className="small muted">{APP_NAME} {APP_VERSION}. Set up for {me.firstName}. Works offline; everything is stored on this device. Not medical advice.</div>
      </div>

      {erase && <Confirm title="Erase everything here?" text="Every day, check-in and note on this device goes. There is no undo. The cloud copy and your other devices are untouched." yesLabel="Erase" danger onNo={() => setErase(false)} onYes={async () => { await clearAll(); setErase(false); nav('/setup'); }} />}
      {toast.el}
    </div>
  );
}
