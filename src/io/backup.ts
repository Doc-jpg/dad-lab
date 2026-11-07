/**
 * Backup, restore and merge.
 *
 * A backup is a ZIP of pretty-printed JSON, one file per table, plus manifest.json with a SHA-256
 * for every file. Restore has two modes:
 *   merge   (default): add what is missing, keep the newer copy of a record, report what was kept.
 *                      Append-only logs (sessions, check-ins, sports logs, journal, flags,
 *                      achievements) are never lost: a record on this phone is never overwritten
 *                      by an older copy, and nothing is deleted.
 *   replace: wipe this phone and load the backup (new phone, recovery, or a test).
 *
 * Nothing in this file sends anything.
 */
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { sha256Hex } from './hash';
import type { DadLabDB } from '../db/db';
import { db as defaultDb, DATA_TABLES, type DataTable } from '../db/db';
import type { Settings } from '../engine/types';
import { nowIso } from '../engine/types';

export const BACKUP_FORMAT = 'dad-lab-backup';
export const BACKUP_FORMAT_VERSION = 1;

export interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  appVersion: string;
  createdAt: string;
  scope: 'full';
  name?: string;
  files: Record<string, { sha256: string; bytes: number; records: number }>;
}

export interface BackupContents {
  manifest: BackupManifest;
  tables: Record<DataTable, any[]>;
  settings: Settings | null;
}

export class BackupFormatError extends Error {}

export async function buildBackup(appVersion: string, database: DadLabDB = defaultDb): Promise<{ bytes: Uint8Array; fileName: string; manifest: BackupManifest }> {
  const json = (v: unknown) => strToU8(JSON.stringify(v, null, 2));
  const files: Record<string, Uint8Array> = {};
  const counts: Record<string, number> = {};
  for (const t of DATA_TABLES) {
    const rows: any[] = await (database as any)[t].toArray();
    files[`${t}.json`] = json(rows);
    counts[`${t}.json`] = rows.length;
  }
  const settings = await database.settings.get('settings');
  files['settings.json'] = json(settings ? { ...settings, sync: undefined } : null);
  counts['settings.json'] = settings ? 1 : 0;
  const me = await database.profile.get('me');
  const manifest: BackupManifest = { format: BACKUP_FORMAT, formatVersion: BACKUP_FORMAT_VERSION, appVersion, createdAt: nowIso(), scope: 'full', name: me?.firstName, files: {} };
  for (const [name, bytes] of Object.entries(files)) manifest.files[name] = { sha256: await sha256Hex(bytes), bytes: bytes.length, records: counts[name] ?? 0 };
  files['manifest.json'] = json(manifest);
  const bytes = zipSync(files, { level: 6 });
  const stamp = manifest.createdAt.slice(0, 16).replace(/[:T]/g, '-');
  return { bytes, fileName: `dad-lab-backup-${stamp}.zip`, manifest };
}

export async function readBackup(bytes: Uint8Array): Promise<BackupContents> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new BackupFormatError('That file is not a ZIP archive.');
  }
  const m = entries['manifest.json'];
  if (!m) throw new BackupFormatError('manifest.json is missing; this is not a Dad Lab backup.');
  const manifest = JSON.parse(strFromU8(m)) as BackupManifest;
  if (manifest.format !== BACKUP_FORMAT) throw new BackupFormatError(`Unknown format "${manifest.format}". This is not a Dad Lab backup (Athletic Lab, Dugout Dad and Dugout Lab files do not open here).`);
  if (manifest.formatVersion > BACKUP_FORMAT_VERSION) throw new BackupFormatError('This backup was made by a newer version of the app. Update the app first.');
  for (const [name, info] of Object.entries(manifest.files)) {
    const data = entries[name];
    if (!data) throw new BackupFormatError(`${name} is missing from the backup.`);
    const h = await sha256Hex(data);
    if (h !== info.sha256) throw new BackupFormatError(`${name} does not match its checksum; the file may be damaged.`);
  }
  const tables = {} as Record<DataTable, any[]>;
  for (const t of DATA_TABLES) tables[t] = entries[`${t}.json`] ? JSON.parse(strFromU8(entries[`${t}.json`])) : [];
  return { manifest, tables, settings: entries['settings.json'] ? JSON.parse(strFromU8(entries['settings.json'])) : null };
}

export interface RestoreReport {
  mode: 'merge' | 'replace';
  added: Record<string, number>;
  updated: Record<string, number>;
  unchanged: Record<string, number>;
  /** Records where this phone had a newer copy; kept as they were. */
  keptNewerHere: Array<{ table: string; id: string; here: string; backup: string }>;
}

export function stamp(r: any): string {
  return r.updatedAt ?? r.ts ?? r.earnedAt ?? r.createdAt ?? '';
}
export function keyOf(table: DataTable, r: any): string {
  return r.id;
}

/** Profile merge: goals union by id, newer scalars win. */
function mergeProfile(cur: any, incoming: any): any {
  const newer = stamp(incoming) >= stamp(cur) ? incoming : cur;
  const older = newer === incoming ? cur : incoming;
  const goals = new Map<string, any>();
  for (const g of older.goals ?? []) goals.set(g.id, g);
  for (const g of newer.goals ?? []) goals.set(g.id, g);
  return { ...older, ...newer, goals: [...goals.values()] };
}

/** Sessions: the more finished status wins; a done session is never replaced by a planned one. */
function mergeSession(cur: any, incoming: any): any {
  const rank: Record<string, number> = { planned: 0, in_progress: 1, skipped: 2, stopped: 3, done: 4 };
  if ((rank[incoming.status] ?? 0) > (rank[cur.status] ?? 0)) return incoming;
  if ((rank[incoming.status] ?? 0) < (rank[cur.status] ?? 0)) return cur;
  return stamp(incoming) > stamp(cur) ? incoming : cur;
}

/** The one merge rule for backups and sync: what this phone should hold given its copy and another copy. */
export function mergeRecord(table: DataTable, cur: any, incoming: any): any {
  if (table === 'profile') return mergeProfile(cur, incoming);
  if (table === 'sessions') return mergeSession(cur, incoming);
  return stamp(incoming) > stamp(cur) ? incoming : cur;
}

export async function restoreBackup(contents: BackupContents, mode: 'merge' | 'replace', database: DadLabDB = defaultDb): Promise<RestoreReport> {
  const report: RestoreReport = { mode, added: {}, updated: {}, unchanged: {}, keptNewerHere: [] };
  await database.transaction('rw', database.tables, async () => {
    const localSettings = await database.settings.get('settings');
    if (mode === 'replace') for (const t of database.tables) if (t.name !== 'meta') await t.clear();
    for (const t of DATA_TABLES) {
      const incoming: any[] = contents.tables[t] ?? [];
      const table = (database as any)[t];
      let added = 0;
      let updated = 0;
      let unchanged = 0;
      for (const rec of incoming) {
        const cur = mode === 'replace' ? undefined : await table.get(keyOf(t, rec));
        if (!cur) { await table.put(rec); added += 1; continue; }
        const merged: any = mergeRecord(t, cur, rec);
        if (JSON.stringify(merged) !== JSON.stringify(cur)) { await table.put(merged); updated += 1; } else unchanged += 1;
        if (stamp(rec) < stamp(cur)) report.keptNewerHere.push({ table: t, id: keyOf(t, rec), here: stamp(cur), backup: stamp(rec) });
      }
      report.added[t] = added;
      report.updated[t] = updated;
      report.unchanged[t] = unchanged;
    }
    // Settings: a replace takes the backup's settings but keeps this device's tour flag and sync state; a merge keeps local settings.
    let next: any = mode === 'replace' ? { ...(contents.settings ?? localSettings ?? {}) } : { ...(localSettings ?? {}) };
    if (mode === 'replace') {
      next.tourSeenAt = localSettings?.tourSeenAt ?? next.tourSeenAt;
      next.sync = localSettings?.sync;
    }
    if (Object.keys(next).length) await database.settings.put({ ...next, id: 'settings' });
  });
  return report;
}

/** Share on a phone (Files, AirDrop, Messages, Mail) or download on a computer. Cancelling the share sheet is reported, not counted. */
export async function shareOrDownload(bytes: Uint8Array, fileName: string, mime = 'application/zip'): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: mime });
  const nav: any = typeof navigator !== 'undefined' ? navigator : undefined;
  try {
    if (nav?.canShare && nav?.share) {
      const file = new File([blob], fileName, { type: mime });
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: fileName });
        return 'shared';
      }
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') return 'cancelled';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}
