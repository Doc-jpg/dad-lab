/* Dad Lab acceptance walkthrough on a phone-sized browser, from an empty device.
   Run: node server.cjs  (in another terminal)  then  URL=http://localhost:4176/ node scripts/acceptance.cjs
   DEVICE="Pixel 5" runs the same walk as an Android phone. LIVE=1 also links a second simulated device
   through the real server. */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const URL = process.env.URL || 'http://localhost:4176/';
const fails = [];
function expect(label, got, want) { if (JSON.stringify(got) !== JSON.stringify(want)) { fails.push(`${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); console.log('  !! MISMATCH', label, JSON.stringify(got), 'want', JSON.stringify(want)); } else console.log('  ok', label); }
const shotsDir = path.join(__dirname, 'shots');
fs.mkdirSync(shotsDir, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(shotsDir, `${name}.png`), fullPage: false });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices[process.env.DEVICE || 'iPhone 13'], acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { console.log('PAGEERROR', e.message); fails.push('pageerror ' + e.message); });
  const settle = (ms = 350) => page.waitForTimeout(ms);
  const body = () => page.locator('body').innerText();
  let t = '';

  // --- Setup ---
  console.log('Setup');
  await page.goto(URL);
  await page.waitForSelector('text=Is this the first device?');
  await page.click('text=Yes, set it up here');
  await page.waitForSelector('text=About you');
  expect('name is prefilled', await page.inputValue('input[autocapitalize="words"]'), 'Deren');
  await page.click('role=button[name="4"]');
  await page.fill('input[placeholder="Band 3"]', 'Dark gray');
  await page.click('text=Dark');
  await page.click('role=button[name="Done"]');
  await page.waitForSelector('text=Your other devices');
  const codeText = await page.locator('strong.mono').innerText();
  expect('device code shown', /^[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(codeText), true);
  const CODE = codeText;
  await shot(page, '00_link');
  await page.click('role=button[name="Skip the tour"]');
  await page.waitForSelector('text=Take the tour');
  await page.click('role=button[name="Not now"]');
  await settle();
  t = await body();
  expect('Today greets by name', /, Deren/.test(t), true);
  expect('theme applied', await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'warm');
  expect('chain starts at zero', /0\s+days in a row/.test(t.replace(/\s+/g, ' ')), true);
  expect('start needs a check-in', /Check in, then start/.test(t), true);
  await shot(page, '01_today_fresh');

  // --- A normal day: check-in, push day ---
  console.log('Green day');
  await page.click('role=button[name="Check in"]');
  await page.waitForSelector('text=Sleep last night');
  await page.click('role=button[name="7 h"]');
  await page.click('role=button[name="Save and see today"]');
  await page.waitForSelector('text=Checked in');
  await settle();
  t = await body();
  expect('green day offers Push day', /Today: Push day/.test(t), true);
  expect('alternatives listed', /Happy Body/.test(t) && /Stretch/.test(t), true);
  expect('weekly weigh-in asked', /Weekly weigh-in/.test(t), true);
  await page.fill('input[placeholder="lb"]', '192');
  await page.click('role=button[name="Save"]');
  await settle();
  expect('weigh-in saved and card gone', /Weekly weigh-in/.test(await body()), false);
  await shot(page, '02_today_green');
  await page.click('role=button[name="Start"]');
  await page.waitForURL(/\/workout\//);
  await settle();
  t = await body();
  expect('player shows the push day', /Push day · 1 of/.test(t), true);
  const total = await page.locator('.progress-dots i').count();
  expect('push day has all its moves', total, 8);
  let sawBand = false;
  let sawFailure = false;
  for (let i = 0; i < total; i++) {
    await settle(120);
    const txt = await body();
    if (/Light gray band|Dark gray band|White band/.test(txt)) sawBand = true;
    if (/Went to failure/.test(txt)) { sawFailure = true; await page.click('role=button[name="35"]'); await page.click('text=Went to failure'); }
    const sets = page.locator('.set-btn:not(.done)');
    const n = await sets.count();
    for (let k = 0; k < n; k++) {
      const label = await sets.nth(k).innerText();
      await sets.nth(k).click();
      if (/s$/.test(label.split('\n')[1] || '')) await page.click('role=button[name="Done early"]');
      await settle(80);
      const restSkip = page.locator('role=button[name="Skip rest"]');
      if (await restSkip.count()) await restSkip.click();
    }
    if (i < total - 1) await page.click('text=/Next ›|Skip to next ›/');
  }
  expect('band shown on the card', sawBand, true);
  expect('band moves offer a failure toggle and rep chips', sawFailure, true);
  await shot(page, '03_player_last');
  await page.click('role=button[name="Finish workout"]');
  await page.waitForSelector('text=How was it?');
  await page.click('role=button[name="Okay"]');
  await page.fill('input[placeholder*="Rows felt strong"]', 'Chest press felt strong, 35 on light gray.');
  await page.click('role=button[name="Save workout"]');
  await page.waitForURL(/\/sessions\//);
  await settle();
  t = await body();
  expect('session summary shows the band and failure', /Light gray band/.test(t) && /to failure/.test(t), true);
  expect('milestones earned on the first day', /Day one|Checked in/.test(t), true);
  await shot(page, '04_summary');
  await page.goto(URL + '#/today');
  await settle();
  t = await body().then((x) => x.replace(/\s+/g, ' '));
  expect('chain is one and today counts', /1 day in a row/.test(t), true);
  expect('band days this week 1 of 4', /1\/4 band days/.test(t), true);
  expect('bonus offered, not required', /Bonus:/.test(t), true);

  // --- Offline ---
  console.log('Offline');
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('text=Checked in');
  expect('offline: Today opens with the finished day', /Push day done/.test(await body()), true);
  await page.goto(URL + '#/journal');
  await page.fill('input[placeholder*="note"], textarea', 'Shoulder a little tight on the press.');
  await page.click('role=button[name="Save"]');
  await settle();
  expect('offline: journal note saved', /Shoulder a little tight/.test(await body()), true);
  await page.goto(URL + '#/exercises/pull-deadlift');
  await page.waitForSelector('text=How to do it');
  expect('offline: exercise page with the moving drawing', await page.locator('.figure svg').count(), 1);
  await shot(page, '05_exercise_offline');
  await ctx.setOffline(false);

  // --- Yellow day: short sleep offers Happy Body, bands as a reduced alternative ---
  console.log('Yellow day');
  await page.goto(URL + '#/today');
  await page.waitForSelector('text=Checked in');
  await page.click('role=button[name="Change"]');
  await page.waitForSelector('text=Sleep last night');
  await page.click('role=button[name="Short"]');
  await page.click('role=button[name="Save and see today"]');
  await page.waitForSelector('text=Checked in');
  await settle();
  t = await body();
  expect('short sleep is a yellow day with the floor or Happy Body as a bonus', /Yellow/.test(t), true);
  await page.goto(URL + '#/workouts');
  await page.waitForSelector('text=Every move');
  t = await body();
  expect('six days listed', ['Push day', 'Pull day', 'Happy Body', 'Stretch', 'The floor', 'Walk'].every((n) => t.includes(n)), true);
  await page.click('text=Pull day');
  await page.waitForSelector('text=Different from the recommendation');
  await page.click('role=button[name="Do it anyway"]');
  await page.waitForURL(/\/workout\//);
  await settle();
  t = await body();
  expect('pull day on a yellow day is one set each', /Lighter day: one set/.test(t), true);
  await page.click('role=button[name="Stop"]');
  await page.click('role=button[name="Out of time"]');
  await page.waitForURL(/\/sessions\//);

  // --- Red day: sick still gets the floor ---
  console.log('Red day');
  await page.goto(URL + '#/today');
  await page.waitForSelector('text=Checked in');
  await page.click('role=button[name="Change"]');
  await page.waitForSelector('text=Sleep last night');
  await page.locator('role=button[name="Good"]').first().click();
  await page.click('role=button[name="Sick"]');
  await page.waitForSelector('text=Nothing loads today');
  await page.click('role=button[name="Save and see today"]');
  await page.waitForSelector('text=Checked in');
  await settle();
  t = await body();
  expect('red day', /Red/.test(t), true);
  expect('red still offers the floor, never nothing', /The floor|Breathe/.test(t), true);
  await shot(page, '06_red');
  await page.click('role=button[name="Change"]');
  await page.waitForSelector('text=Sleep last night');
  await page.click('role=button[name="Sick"]');
  await page.click('role=button[name="Save and see today"]');
  await page.waitForSelector('text=Checked in');

  // --- Progress, habits ---
  console.log('Progress and habits');
  await page.goto(URL + '#/progress');
  await page.waitForSelector('text=Progress');
  t = await body();
  expect('progress shows band moves', /Where you are on each band move/i.test(t) && /Band chest press/.test(t), true);
  expect('weigh-in listed', /192 lb/.test(t), true);
  await shot(page, '07_progress');
  await page.goto(URL + '#/habits');
  await page.waitForSelector('text=Meals on the clock');
  await page.click('text=Meals on the clock');
  await page.click('text=Five minutes flat');
  await settle();
  expect('habits tick', await page.locator('.check.on').count(), 2);

  // --- Backup and merge ---
  console.log('Backup');
  await page.goto(URL + '#/settings');
  await page.waitForSelector('text=Linked devices');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    (async () => { await page.click('role=button[name="Back up everything"]'); await page.waitForSelector('text=Backup ready'); await page.click('role=button[name="Share or save"]'); })()
  ]);
  const file = path.join(os.tmpdir(), `dad-lab-acceptance-${Date.now()}.zip`);
  await download.saveAs(file);
  expect('backup file written', fs.statSync(file).size > 500, true);
  await page.locator('input[type="file"]').last().setInputFiles(file);
  await page.waitForSelector('text=Restore a backup');
  expect('restore preview reads the manifest', /Backup for Deren/.test(await body()), true);
  await page.click('role=button[name="Merge (safe)"]');
  await page.waitForSelector('text=Merged.');
  expect('merging the same file changes nothing', /Added 0, updated 0/.test(await body()), true);
  await page.keyboard.press('Escape');

  // --- Its own app ---
  console.log('Identity');
  const manifest = await page.evaluate(async () => { const r = await fetch('manifest.webmanifest'); return r.json(); });
  expect('manifest name', manifest.name, 'Dad Lab');
  expect('manifest id is its own scope', typeof manifest.id === 'string' && manifest.id === manifest.scope, true);
  const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
  expect('own IndexedDB database', dbs.includes('dad-lab'), true);
  expect('no other lab databases touched', dbs.some((n) => /athletic|dugout/.test(n)), false);

  // --- Tour and FAQ ---
  console.log('Tour, FAQ');
  await page.click('role=button[name="Take the one-minute tour"]');
  await page.waitForSelector('text=Tour · 1 of 9');
  for (let i = 0; i < 8; i++) { await page.click('role=button[name="Next ›"]'); await settle(250); }
  expect('tour reaches the last stop', /Tour · 9 of 9/.test(await body()), true);
  await shot(page, '08_tour_last');
  await page.click('role=button[name="Done, let\'s go"]');
  await settle(800);
  await page.goto(URL + '#/help');
  await page.reload();
  await page.waitForSelector('input[placeholder="Search the questions"]');
  await page.fill('input[placeholder="Search the questions"]', 'floor');
  await settle();
  expect('FAQ search finds the floor', /What is "the floor"/.test(await body()), true);

  // --- A second device joins by code and syncs (live server) ---
  if (process.env.LIVE === '1') {
    console.log('Second device');
    const ctx2 = await browser.newContext({ ...devices['iPad Mini'] });
    const p2 = await ctx2.newPage();
    p2.on('pageerror', (e) => { console.log('PAGEERROR2', e.message); fails.push('pageerror2 ' + e.message); });
    await p2.goto(URL);
    await p2.waitForSelector('text=Is this the first device?');
    await p2.click('text=No, link it to the one I already set up');
    await p2.waitForSelector('text=Device code');
    await p2.fill('input.mono', CODE);
    await p2.click('role=button[name="Connect"]');
    await p2.waitForSelector('text=, Deren', { timeout: 30000 });
    await p2.waitForTimeout(1500);
    const t2 = await p2.locator('body').innerText();
    expect('second device has the day', /Push day done/.test(t2), true);
    await shot(p2, '09_second_device');
    await ctx2.close();
  }

  await browser.close();
  console.log(fails.length ? `\n${fails.length} FAILED\n${fails.join('\n')}` : '\nALL PASSED');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
