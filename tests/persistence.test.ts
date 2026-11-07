import { describe, it, expect, beforeEach } from 'vitest';
import { DadLabDB, seedLibrary, createProfile, saveSession, addJournal, saveCheckIn, saveWeighIn, getSettings, saveSettings } from '../src/db/db';
import { buildBackup, readBackup, restoreBackup, BackupFormatError } from '../src/io/backup';
import type { Session } from '../src/engine/types';
import { nowIso } from '../src/engine/types';

let n = 0;
const fresh = () => new DadLabDB('test-' + Date.now() + '-' + n++);

function session(day: string, patch: Partial<Session> = {}): Session {
  const ts = day + 'T18:00:00.000Z';
  return { id: 'sess-' + day, day, templateId: 'push', templateName: 'Push day', kind: 'push', status: 'done', why: [], items: [{ exerciseId: 'push-chest', exerciseName: 'Band chest press', catalogVersion: 1, planned: { sets: 1, reps: 15, repsMax: 40 }, sets: [{ reps: 32, load: 'band2', toFailure: true, done: true, ts }] }], createdAt: ts, updatedAt: ts, ...patch };
}

describe('storage', () => {
  let db: DadLabDB;
  beforeEach(() => { db = fresh(); });

  it('seeds the library once and refreshes untouched items only when the version moves', async () => {
    const first = await seedLibrary(db);
    expect(first.exercises).toBeGreaterThan(30);
    expect((await seedLibrary(db)).exercises).toBe(0);
    expect((await db.templates.toArray()).length).toBe(6);
  });

  it('a session saved offline is there when the app reopens (same database, new connection)', async () => {
    await createProfile({ firstName: 'Deren' }, db);
    await saveSession(session('2026-11-07'), db);
    const again = new DadLabDB(db.name);
    const s = await again.sessions.where('day').equals('2026-11-07').first();
    expect(s?.status).toBe('done');
    expect(s?.items[0].sets[0].load).toBe('band2');
  });

  it('data written at schema version 1 opens unchanged after a (future) version bump', async () => {
    await saveSession(session('2026-11-07'), db);
    db.close();
    class Next extends DadLabDB { constructor(name: string) { super(name); this.version(2).stores({ extra: 'id' }); } }
    const next = new Next(db.name);
    expect((await next.sessions.get('sess-2026-11-07'))?.templateName).toBe('Push day');
  });

  it('settings carry band names and the weekly target; a weigh-in replaces the same day', async () => {
    await saveSettings({ bandNames: { band1: 'Blue', band2: 'Green', band3: 'Black', band4: 'Silver', band5: '', band6: '', band7: '', band8: '' }, strengthDaysPerWeek: 3 }, db);
    const s = await getSettings(db);
    expect(s.bandNames.band3).toBe('Black');
    expect(s.strengthDaysPerWeek).toBe(3);
    await saveWeighIn('2026-11-07', 193, undefined, db);
    await saveWeighIn('2026-11-07', 192.4, undefined, db);
    expect(await db.weighIns.count()).toBe(1);
    expect((await db.weighIns.toArray())[0].lbs).toBe(192.4);
  });
});

describe('backup, restore and merge', () => {
  it('round trip: everything comes back, checksums verified, damaged file refused', async () => {
    const a = fresh();
    await seedLibrary(a);
    await createProfile({ firstName: 'Deren' }, a);
    await saveSession(session('2026-11-07'), a);
    await addJournal({ day: '2026-11-07', text: 'Rows felt strong.' }, a);
    await saveCheckIn({ day: '2026-11-07', sleep: 4, energy: 4, stress: 2, soreness: 'none', pain: false, sick: false, time: 30, color: 'green' }, a);
    await saveWeighIn('2026-11-07', 192, undefined, a);
    const { bytes, manifest } = await buildBackup('test', a);
    expect(manifest.files['journal.json'].records).toBe(1);
    expect(manifest.files['weighIns.json'].records).toBe(1);
    const contents = await readBackup(bytes);
    const b = fresh();
    const report = await restoreBackup(contents, 'replace', b);
    expect(report.added.sessions).toBe(1);
    expect((await b.profile.get('me'))?.firstName).toBe('Deren');
    expect(await b.weighIns.count()).toBe(1);
    const bad = new Uint8Array(bytes);
    bad[bad.length - 30] ^= 0xff;
    await expect(readBackup(bad)).rejects.toBeInstanceOf(BackupFormatError);
  });

  it('merge never overwrites a newer record here and keeps both goals', async () => {
    const phone = fresh();
    const ipad = fresh();
    await createProfile({ firstName: 'Deren' }, phone);
    await saveSession(session('2026-11-07'), phone);
    await restoreBackup(await readBackup((await buildBackup('t', phone)).bytes), 'replace', ipad);
    const pa = (await ipad.profile.get('me'))!;
    await ipad.profile.put({ ...pa, goals: [{ id: 'g-ipad', text: 'Thirty days', status: 'active', createdAt: nowIso() }], updatedAt: '2026-11-08T10:00:00.000Z' });
    await saveSession(session('2026-11-09'), phone);
    const ea = (await phone.profile.get('me'))!;
    await phone.profile.put({ ...ea, goals: [{ id: 'g-phone', text: 'Dark gray press', status: 'active', createdAt: nowIso() }], updatedAt: '2026-11-09T10:00:00.000Z' });
    const report = await restoreBackup(await readBackup((await buildBackup('t', phone)).bytes), 'merge', ipad);
    expect(report.added.sessions).toBe(1);
    expect(await ipad.sessions.count()).toBe(2);
    expect((await ipad.profile.get('me'))!.goals.map((g) => g.id).sort()).toEqual(['g-ipad', 'g-phone']);
    const back = await readBackup((await buildBackup('t', ipad)).bytes);
    const r2 = await restoreBackup(back, 'merge', ipad);
    expect(Object.values(r2.added).reduce((a, b) => a + b, 0)).toBe(0);
    expect(Object.values(r2.updated).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('a done session is never replaced by a planned copy of itself', async () => {
    const a = fresh();
    await saveSession(session('2026-11-07', { status: 'done', updatedAt: '2026-11-07T18:00:00.000Z' }), a);
    const contents = await readBackup((await buildBackup('t', a)).bytes);
    contents.tables.sessions[0] = { ...contents.tables.sessions[0], status: 'planned', updatedAt: '2026-11-10T18:00:00.000Z' };
    await restoreBackup(contents, 'merge', a);
    expect((await a.sessions.get('sess-2026-11-07'))?.status).toBe('done');
  });

  it('a backup never carries the sync state; replace keeps this device\'s link', async () => {
    const a = fresh();
    await createProfile({ firstName: 'Deren' }, a);
    await saveSettings({ sync: { secret: 'S', familyId: 'F', enabled: true, device: 'd' } }, a);
    const contents = await readBackup((await buildBackup('t', a)).bytes);
    expect(contents.settings?.sync).toBeUndefined();
    const b = fresh();
    await saveSettings({ sync: { secret: 'T', familyId: 'G', enabled: true, device: 'e' } }, b);
    await restoreBackup(contents, 'replace', b);
    expect((await getSettings(b)).sync?.secret).toBe('T');
  });
});
