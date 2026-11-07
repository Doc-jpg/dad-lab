import React, { useState } from 'react';
import { useSettings, timeAgo } from '../hooks';
import { useToast, Confirm } from './Sheet';
import { familyLink, formatCode, leaveFamily, startFamily, syncNow, deviceName } from '../../io/sync';
import { SYNC_AVAILABLE } from '../../sync-config';
import { APP_NAME } from '../version';

/** Sync status between this person's own devices, with the link, the code and the controls. */
export function SyncCard() {
  const settings = useSettings();
  const toast = useToast();
  const [confirmOff, setConfirmOff] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!SYNC_AVAILABLE) return null;
  const s = settings.sync;
  const status = !s?.enabled ? 'Not linked to another device.' : s.lastError ? `Last try failed: ${s.lastError}` : s.lastSyncAt ? `Up to date as of ${timeAgo(s.lastSyncAt)}${s.lastSyncAt.slice(0, 10) === new Date().toISOString().slice(0, 10) ? ` (${new Date(s.lastSyncAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })})` : ''}.` : 'Linked; waiting for the first sync.';
  const share = async () => {
    if (!s) return;
    const url = familyLink(s.secret);
    const nav2: any = navigator;
    try {
      if (nav2.share) { await nav2.share({ title: `${APP_NAME} device link`, text: `Open this on your other device to link it to ${APP_NAME}: ${url}` }); return; }
    } catch (e: any) { if (e?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); toast.show('Link copied'); } catch { toast.show(url); }
  };
  const syncNowClick = async () => { setBusy(true); const r = await syncNow(); setBusy(false); toast.show(r.error ? `Could not sync: ${r.error}` : r.skipped ? 'Offline or not linked' : `Synced (${r.pushed} sent, ${r.applied} received)`); };
  return (
    <div className="card">
      <h3>Linked devices</h3>
      <div className="small mt">{status}</div>
      {s?.enabled ? (
        <>
          <p className="small muted mt">Phone, iPad and laptop keep each other in step whenever one opens the app with a signal, after every change, and every two minutes while open.</p>
          <button className="btn block" onClick={share}>Send the link to another device</button>
          <p className="small muted mt">Code to type instead: <strong className="mono">{formatCode(s.secret)}</strong>. Anyone with this code can read your records, so keep it to yourself.</p>
          <div className="row mt">
            <button className="btn grow" disabled={busy} onClick={syncNowClick}>Sync now</button>
            <button className="btn ghost sm" style={{ color: 'var(--danger)' }} onClick={() => setConfirmOff(true)}>Unlink</button>
          </div>
        </>
      ) : (
        <div className="col mt">
          <p className="small muted">Make a device link here, then open it on the other device.</p>
          <button className="btn primary block" disabled={busy} onClick={async () => { setBusy(true); await startFamily(deviceName()); setBusy(false); toast.show('Device link made'); }}>Make a device link</button>
        </div>
      )}
      {confirmOff && <Confirm title="Unlink this device?" text="This device stops sending and receiving. Nothing is deleted anywhere. Link again any time with the link or code." yesLabel="Unlink" danger onNo={() => setConfirmOff(false)} onYes={async () => { await leaveFamily(); setConfirmOff(false); }} />}
      {toast.el}
    </div>
  );
}
