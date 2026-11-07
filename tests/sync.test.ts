import { describe, it, expect } from 'vitest';
import { DadLabDB, createProfile, saveSession, addJournal, deleteWithTombstone, getSettings, addGoal, saveWeighIn, saveCheckIn } from '../src/db/db';
import { startFamily, joinFamily, syncNow, makeFamilyCode, formatCode, normalizeCode, familyLink } from '../src/io/sync';
import { SYNC_CONFIG } from '../src/sync-config';
import { sha256Hex } from '../src/io/hash';
import type { Session } from '../src/engine/types';

let n = 0;
const fresh = () => new DadLabDB('sync-' + Date.now() + '-' + n++);

function session(day: string, patch: Partial<Session> = {}): Session {
  const ts = day + 'T18:00:00.000Z';
  return { id: 'sess-' + day, day, templateId: 'push', templateName: 'Push day', kind: 'push', status: 'done', why: [], items: [], createdAt: ts, updatedAt: ts, ...patch };
}

/** An in-memory stand-in for the server with the same rules: code isolation, older copy never overwrites, server_ts on accept. */
function fakeServer() {
  const rows = new Map<string, any>();
  let clock = 1;
  const fetchImpl = async (url: string, init: any = {}) => {
    const secret = init.headers?.['x-family-key'] ?? '';
    const fid = await sha256Hex(secret);
    if (init.method === 'POST') {
      const body = JSON.parse(init.body);
      for (const r of body) {
        if (r.family_id !== fid) return { ok: false, status: 401, json: async () => ({}), text: async () => 'rls' };
        const key = `${r.family_id}|${r.tbl}|${r.id}`;
        const cur = rows.get(key);
        if (cur && r.stamp < cur.stamp) continue;
        rows.set(key, { ...r, server_ts: new Date(Date.UTC(2026, 10, 2, 0, 0, clock++)).toISOString() });
      }
      return { ok: true, status: 201, json: async () => [], text: async () => '' };
    }
    const u = new URL(url, 'https://x');
    const gt = decodeURIComponent((u.searchParams.get('server_ts') ?? 'gt.1970').slice(3));
    const offset = Number(u.searchParams.get('offset') ?? 0);
    const out = [...rows.values()].filter((r) => r.family_id === fid && r.server_ts > gt).sort((a, b) => a.server_ts.localeCompare(b.server_ts)).slice(offset, offset + 500);
    return { ok: true, status: 200, json: async () => out, text: async () => '' };
  };
  return { fetchImpl, rows };
}

const cfg = { url: 'https://fake', anonKey: 'k' };

describe('family code and link', () => {
  it('makes a 20-character code without confusable letters, formats and normalizes it', () => {
    const c = makeFamilyCode();
    expect(c).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{20}$/);
    expect(formatCode(c).split('-').length).toBe(4);
    expect(normalizeCode(formatCode(c).toLowerCase())).toBe(c);
    expect(familyLink(c)).toContain(`#/join?k=${c}`);
  });
});

describe('automatic sync between two of your own devices (fake server)', () => {
  it('a day done on the phone shows up on the iPad; a weigh-in on the iPad shows up on the phone', async () => {
    const { fetchImpl } = fakeServer();
    const phone = fresh();
    const ipad = fresh();
    await createProfile({ firstName: 'Deren' }, phone);
    const fam = await startFamily('phone', phone);
    await joinFamily(formatCode(fam.secret), 'ipad', ipad);
    await saveSession(session('2026-11-07'), phone);
    const r1 = await syncNow(phone, fetchImpl, cfg);
    expect(r1.error).toBeUndefined();
    expect(r1.pushed).toBeGreaterThanOrEqual(2); // profile + session
    const r2 = await syncNow(ipad, fetchImpl, cfg);
    expect(r2.applied).toBeGreaterThanOrEqual(2);
    expect((await ipad.profile.get('me'))?.firstName).toBe('Deren');
    expect((await ipad.sessions.get('sess-2026-11-07'))?.status).toBe('done');
    await saveWeighIn('2026-11-07', 192.5, undefined, ipad);
    await syncNow(ipad, fetchImpl, cfg);
    await syncNow(phone, fetchImpl, cfg);
    expect((await phone.weighIns.toArray())[0]?.lbs).toBe(192.5);
  });

  it('a journal note goes across; a deletion reaches the other device', async () => {
    const { fetchImpl } = fakeServer();
    const phone = fresh();
    const ipad = fresh();
    await createProfile({ firstName: 'Deren' }, phone);
    const fam = await startFamily('phone', phone);
    await joinFamily(fam.secret, 'ipad', ipad);
    const note = await addJournal({ day: '2026-11-07', text: 'rows felt strong' }, phone);
    await syncNow(phone, fetchImpl, cfg);
    await syncNow(ipad, fetchImpl, cfg);
    expect((await ipad.journal.toArray()).map((j) => j.text)).toEqual(['rows felt strong']);
    await deleteWithTombstone('journal', note.id, phone);
    await syncNow(phone, fetchImpl, cfg);
    await syncNow(ipad, fetchImpl, cfg);
    expect(await ipad.journal.count()).toBe(0);
  });

  it('is idempotent, keeps both goals on a conflict, a check-in rides across, and never sends settings', async () => {
    const { fetchImpl, rows } = fakeServer();
    const phone = fresh();
    const ipad = fresh();
    await createProfile({ firstName: 'Deren' }, phone);
    const fam = await startFamily('phone', phone);
    await joinFamily(fam.secret, 'ipad', ipad);
    await saveSession(session('2026-11-07', { status: 'done' }), phone);
    await saveCheckIn({ day: '2026-11-07', sleep: 4, energy: 4, stress: 2, soreness: 'none', pain: false, sick: false, time: 30, color: 'green' }, phone);
    await syncNow(phone, fetchImpl, cfg);
    await syncNow(ipad, fetchImpl, cfg);
    expect((await ipad.checkIns.toArray()).length).toBe(1);
    await addGoal('Dark gray on the chest press', phone);
    await new Promise((r) => setTimeout(r, 5));
    await addGoal('Thirty days without a zero', ipad);
    await syncNow(ipad, fetchImpl, cfg);
    await syncNow(phone, fetchImpl, cfg);
    await syncNow(ipad, fetchImpl, cfg);
    expect((await phone.profile.get('me'))!.goals.map((g) => g.text).sort()).toEqual(['Dark gray on the chest press', 'Thirty days without a zero']);
    expect((await ipad.profile.get('me'))!.goals.map((g) => g.text).sort()).toEqual(['Dark gray on the chest press', 'Thirty days without a zero']);
    const again = await syncNow(phone, fetchImpl, cfg);
    expect(again.pushed).toBe(0);
    expect(again.applied).toBe(0);
    expect([...rows.values()].some((r) => r.tbl === 'settings' || r.tbl === 'meta')).toBe(false);
    expect((await getSettings(ipad)).sync?.enabled).toBe(true);
  });

  it('another code cannot see the rows', async () => {
    const { fetchImpl, rows } = fakeServer();
    const mine = fresh();
    const stranger = fresh();
    await createProfile({ firstName: 'Deren' }, mine);
    await startFamily('phone', mine);
    await startFamily('x', stranger);
    await saveSession(session('2026-11-07'), mine);
    await syncNow(mine, fetchImpl, cfg);
    const r = await syncNow(stranger, fetchImpl, cfg);
    expect(r.pulled).toBe(0);
    expect(rows.size).toBeGreaterThan(0);
  });

  it('without a code the app just works offline (sync skipped)', async () => {
    const mine = fresh();
    await createProfile({ firstName: 'Deren' }, mine);
    const r = await syncNow(mine, fakeServer().fetchImpl, cfg);
    expect(r.skipped).toBe(true);
  });
});

const LIVE = (globalThis as any).process?.env?.LIVE_SYNC === '1';
describe.skipIf(!LIVE)('live Supabase round trip', () => {
  it('two fresh databases meet at the real server', async () => {
    const phone = fresh();
    const ipad = fresh();
    await createProfile({ firstName: 'Deren' }, phone);
    const fam = await startFamily('test-phone', phone);
    await joinFamily(fam.secret, 'test-ipad', ipad);
    await saveSession(session('2026-11-07'), phone);
    const r1 = await syncNow(phone, globalThis.fetch as any, SYNC_CONFIG);
    expect(r1.error).toBeUndefined();
    const r2 = await syncNow(ipad, globalThis.fetch as any, SYNC_CONFIG);
    expect(r2.error).toBeUndefined();
    expect((await ipad.sessions.get('sess-2026-11-07'))?.status).toBe('done');
  }, 30000);
});
