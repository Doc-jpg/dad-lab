/**
 * Automatic two-way sync between this person's own devices (phone, iPad, laptop).
 *
 * Every device holds the same device code (20 characters, made on the first device and passed to
 * the others by a link or typed in). Every request sends it in a header; the server keeps only its
 * hash and only returns rows for that hash. The server is the same free project Athletic Lab uses,
 * same `records` table; the hash of a different code keeps the two apps' rows apart. The server is a dumb record store: one row per record with
 * the record's own stamp, and a rule that an older copy never overwrites a newer one.
 *
 * Push: every local record whose stamp is newer than the last push (plus tombstones).
 * Pull: every server row newer than the last pull, merged with the same rule backups use.
 * What never leaves the device: settings (sync state), meta, and library exercises or templates
 * that were never edited.
 *
 * Runs when the app opens, comes to the foreground, gets back online, two seconds after any write,
 * and every two minutes while open. iPhone web apps cannot run in the background, so "automatic"
 * means the next time either phone opens the app with a signal.
 */
import type { DadLabDB } from '../db/db';
import { db as defaultDb, DATA_TABLES, type DataTable, getSettings, saveSettings } from '../db/db';
import { mergeRecord, stamp, keyOf } from './backup';
import { sha256Hex } from './hash';
import { SYNC_CONFIG, SYNC_AVAILABLE } from '../sync-config';
import type { SyncState } from '../engine/types';
import { newId, nowIso } from '../engine/types';

export interface SyncReport {
  pushed: number;
  pulled: number;
  applied: number;
  deleted: number;
  skipped: boolean;
  error?: string;
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L

/** A new family code: 20 characters in four groups, shown as XXXXX-XXXXX-XXXXX-XXXXX. */
export function makeFamilyCode(): string {
  const bytes = new Uint8Array(20);
  const c: any = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 20; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export function formatCode(secret: string): string {
  return secret.replace(/(.{5})(?=.)/g, '$1-');
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z2-9]/g, '');
}

export async function familyIdFor(secret: string): Promise<string> {
  return sha256Hex(secret);
}

/** The link to open on another of your own devices. The secret rides in the hash fragment, which never reaches a server log. */
export function familyLink(secret: string): string {
  const base = typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : 'https://doc-jpg.github.io/dad-lab/';
  return `${base}#/join?k=${secret}`;
}

export async function startFamily(device: string, database: DadLabDB = defaultDb, secret = makeFamilyCode()): Promise<SyncState> {
  const state: SyncState = { secret, familyId: await familyIdFor(secret), enabled: true, device };
  await saveSettings({ sync: state }, database);
  return state;
}

export async function joinFamily(secretInput: string, device: string, database: DadLabDB = defaultDb): Promise<SyncState> {
  const secret = normalizeCode(secretInput);
  if (secret.length !== 20) throw new Error('That code is not complete. It has 20 letters and numbers.');
  const state: SyncState = { secret, familyId: await familyIdFor(secret), enabled: true, device };
  await saveSettings({ sync: state }, database);
  return state;
}

export async function leaveFamily(database: DadLabDB = defaultDb): Promise<void> {
  await saveSettings({ sync: undefined }, database);
}

// ---------------------------------------------------------------------------

type FetchLike = (input: string, init?: any) => Promise<{ ok: boolean; status: number; json: () => Promise<any>; text: () => Promise<string> }>;

interface ServerRow {
  family_id: string;
  tbl: string;
  id: string;
  stamp: string;
  data: any;
  deleted: boolean;
  device?: string;
  server_ts?: string;
}

function shouldPush(table: DataTable, r: any): boolean {
  if (table === 'messages') return false;
  if ((table === 'exercises' || table === 'templates') && r.source === 'library' && r.updatedAt === r.createdAt) return false;
  return true;
}

let syncing: Promise<SyncReport> | null = null;

/** Push then pull. Safe to call often; concurrent calls share one run. */
export function syncNow(database: DadLabDB = defaultDb, fetchImpl?: FetchLike, config = SYNC_CONFIG): Promise<SyncReport> {
  if (syncing) return syncing;
  syncing = runSync(database, fetchImpl ?? (globalThis.fetch as any), config).finally(() => { syncing = null; });
  return syncing;
}

async function runSync(database: DadLabDB, fetchImpl: FetchLike, config: { url: string; anonKey: string }): Promise<SyncReport> {
  const report: SyncReport = { pushed: 0, pulled: 0, applied: 0, deleted: 0, skipped: false };
  const settings = await getSettings(database);
  const state = settings.sync;
  if (!state?.enabled || !config.url || !config.anonKey || !fetchImpl) { report.skipped = true; return report; }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { report.skipped = true; return report; }
  const headers = { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, 'Content-Type': 'application/json', 'x-family-key': state.secret };
  const base = `${config.url.replace(/\/$/, '')}/rest/v1/records`;
  try {
    const push = async (): Promise<number> => {
      const cur = (await getSettings(database)).sync!;
      const since = cur.lastPush ?? '';
      const rows: ServerRow[] = [];
      let maxStamp = since;
      for (const t of DATA_TABLES) {
        const all: any[] = await (database as any)[t].toArray();
        for (const r of all) {
          const s = stamp(r);
          if (!s || s <= since || !shouldPush(t, r)) continue;
          rows.push({ family_id: cur.familyId, tbl: t, id: keyOf(t, r), stamp: s, data: r, deleted: false, device: cur.device });
          if (s > maxStamp) maxStamp = s;
        }
      }
      for (const tomb of await database.tombstones.toArray()) {
        if (tomb.ts <= since) continue;
        rows.push({ family_id: cur.familyId, tbl: tomb.tbl, id: tomb.id, stamp: tomb.ts, data: null, deleted: true, device: cur.device });
        if (tomb.ts > maxStamp) maxStamp = tomb.ts;
      }
      for (let i = 0; i < rows.length; i += 200) {
        const res = await fetchImpl(base, { method: 'POST', headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows.slice(i, i + 200)) });
        if (!res.ok) throw new Error(`push failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
      }
      if (rows.length) await saveSettings({ sync: { ...(await getSettings(database)).sync!, lastPush: maxStamp } }, database);
      return rows.length;
    };

    const pull = async (): Promise<void> => {
      const cur = (await getSettings(database)).sync!;
      const sinceTs = cur.lastPullTs ?? '1970-01-01T00:00:00Z';
      let maxTs = sinceTs;
      let page = 0;
      for (;;) {
        const url = `${base}?select=*&family_id=eq.${cur.familyId}&server_ts=gt.${encodeURIComponent(sinceTs)}&order=server_ts.asc,tbl.asc,id.asc&limit=500&offset=${page * 500}`;
        const res = await fetchImpl(url, { headers });
        if (!res.ok) throw new Error(`pull failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
        const batch: ServerRow[] = await res.json();
        report.pulled += batch.length;
        await database.transaction('rw', database.tables, async () => {
          for (const row of batch) {
            if (!DATA_TABLES.includes(row.tbl as DataTable)) continue;
            const t = row.tbl as DataTable;
            const table = (database as any)[t];
            if (row.deleted) {
              const existing = await table.get(row.id);
              if (existing && stamp(existing) <= row.stamp) { await table.delete(row.id); report.deleted += 1; }
              continue;
            }
            if (!row.data) continue;
            const existing = await table.get(keyOf(t, row.data));
            const merged = existing ? mergeRecord(t, existing, row.data) : row.data;
            if (!existing || JSON.stringify(merged) !== JSON.stringify(existing)) { await table.put(merged); report.applied += 1; }
            if (row.server_ts && row.server_ts > maxTs) maxTs = row.server_ts;
          }
        });
        if (batch.length < 500) break;
        page += 1;
      }
      const fresh = (await getSettings(database)).sync!;
      await saveSettings({ sync: { ...fresh, lastPullTs: maxTs, lastSyncAt: nowIso(), lastError: undefined } }, database);
    };

    report.pushed = await push();
    await pull();
    // A pull that merged something may have produced a record newer than what the server holds
    // (a goal union, for example); send it back now so the other phone gets it on its next sync.
    if (report.applied > 0) report.pushed += await push();
  } catch (e: any) {
    report.error = e?.message ?? String(e);
    const fresh = (await getSettings(database)).sync;
    if (fresh) await saveSettings({ sync: { ...fresh, lastError: report.error } }, database);
  }
  return report;
}

/** Wire the triggers in a browser. Returns a stop function. */
export function startSyncLoop(database: DadLabDB = defaultDb): () => void {
  if (!SYNC_AVAILABLE || typeof window === 'undefined') return () => undefined;
  let timer: number | undefined;
  const kick = (delay = 0) => { window.clearTimeout(timer); timer = window.setTimeout(() => { syncNow(database).catch(() => undefined); }, delay); };
  const onChange = () => kick(2000);
  const onVisible = () => { if (document.visibilityState === 'visible') kick(300); };
  const onOnline = () => kick(300);
  window.addEventListener('dad-lab:changed', onChange);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  const interval = window.setInterval(() => kick(0), 120000);
  kick(500);
  return () => { window.clearTimeout(timer); window.clearInterval(interval); window.removeEventListener('dad-lab:changed', onChange); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', onOnline); };
}

export function deviceName(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const kind = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : 'computer';
  return `${kind}-${newId().slice(0, 6)}`;
}
