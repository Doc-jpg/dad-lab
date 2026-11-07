import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { seedLibrary } from '../../db/db';
import { useProfile, useSettings } from '../hooks';
import { joinFamily, deviceName, syncNow, normalizeCode } from '../../io/sync';
import { SYNC_AVAILABLE } from '../../sync-config';
import { APP_NAME } from '../version';

/** Where the device link lands (#/join?k=CODE). Connects this device and pulls everything down. */
export function JoinPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const me = useProfile();
  const settings = useSettings();
  const code = normalizeCode(params.get('k') ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const already = settings.sync?.secret === code;

  const connect = async () => {
    setErr('');
    setBusy(true);
    try {
      await seedLibrary();
      await joinFamily(code, deviceName());
      const r = await syncNow();
      if (r.error) throw new Error(r.error);
      setBusy(false);
      setDone(true);
    } catch (e: any) {
      setBusy(false);
      setErr(e?.message ?? 'Could not connect. Check the signal and try again.');
    }
  };

  if (!SYNC_AVAILABLE) return <div className="card">Sync is not set up in this build.</div>;
  if (code.length !== 20) return <div className="card"><h2>That link is not complete</h2><p className="small muted">Open the link exactly as it was sent, or type the code under Setup, "link it to the one I already set up".</p></div>;
  if (done) {
    return (
      <div className="col">
        <div className="hero"><h1>{APP_NAME}</h1><div className="sub">Linked.</div></div>
        <div className="card">
          <p className="small">This device now carries the same days, check-ins and notes as the first one, and anything you do here goes back the same way.</p>
          <button className="btn primary lg block" onClick={() => nav('/today')}>Open Today</button>
        </div>
      </div>
    );
  }
  return (
    <div className="col">
      <div className="hero"><h1>{APP_NAME}</h1><div className="sub">Device link</div></div>
      <div className="card">
        {already ? <p className="small">This device is already linked.</p> : <p className="small">{me ? 'Link this device to the one that sent the link. Records on both are kept; the newer copy of anything wins.' : 'This links the device to the one you set up first. Everything arrives here on its own.'}</p>}
        {err && <div className="banner danger small">{err}</div>}
        <button className="btn primary lg block" disabled={busy || already} onClick={connect}>{busy ? 'Connecting…' : already ? 'Already linked' : 'Link this device'}</button>
        {already && <button className="btn block mt" onClick={() => nav('/today')}>Open Today</button>}
      </div>
    </div>
  );
}
