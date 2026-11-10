// End-to-end smoke test at phone size: node tests/e2e/smoke.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { startServer } from '../../scripts/serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const server = await startServer(0);
const base = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const results = [];
const errors = [];
async function step(name, fn) {
  try { await fn(); results.push(['ok', name]); }
  catch (e) { results.push(['FAIL', name, e.message.split('\n')[0]]); }
}
const phone = async (opts = {}) => {
  const { layout = 'mobile', ...rest } = opts;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...rest });
  if (layout) await ctx.addInitScript(l => { try { localStorage.setItem('deckhand:layout', JSON.stringify(l)); } catch {} }, layout);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  return { ctx, page };
};

// 1. First visit → lesson 1 → quiz → map shows island 1 done
{
  const { ctx, page } = await phone();
  await step('first visit shows Start here', async () => {
    await page.goto(base);
    await page.getByRole('link', { name: 'Start here' }).waitFor({ timeout: 8000 });
  });
  await step('lesson 1 can be completed with a 3/3 quiz', async () => {
    await page.getByRole('link', { name: 'Start here' }).click();
    await page.locator('.lesson-title').waitFor();
    const lesson = await (await page.request.get(base + 'content/lessons/01.json')).json();
    for (let i = 0; i < lesson.steps.length; i++) { await page.click('.lesson-next'); await page.waitForTimeout(150); }
    for (const q of lesson.quiz) {
      await page.click(`.choice[data-n="${q.answer}"]`);
      await page.click('.quiz-next');
    }
    await page.locator('.lesson-done').waitFor();
    assert.match(await page.textContent('.quiz-score'), /3\/3/);
  });
  await step('map shows lesson 1 completed and ship at lesson 2', async () => {
    await page.click('text=Back to the map');
    await page.locator('.island.done').first().waitFor();
    assert.equal(await page.locator('.island.here .isle-n').textContent(), '2');
  });
  await step('practice board in lesson 7 can be solved', async () => {
    await page.goto(base + '#/lesson/7');
    await page.locator('.lesson-title').waitFor();
    while (!(await page.locator('.board').count())) { await page.click('.lesson-next'); await page.waitForTimeout(150); }
    assert.equal(await page.isDisabled('.lesson-next'), true);
    await page.click('.hand .bcard[data-id="vivi"]');
    await page.click('.hand .bcard[data-id="brook"]');
    await page.click('[data-act="resolve"]');
    await page.waitForFunction(() => !document.querySelector('.lesson-next').disabled);
  });

  // 2. Cards
  await step('card search finds Luffy and opens detail with TCGplayer link', async () => {
    await page.goto(base + '#/cards');
    await page.fill('.search-field input', 'luffy');
    await page.waitForTimeout(400);
    assert.ok(await page.locator('.tile').count() >= 1);
    await page.locator('.tile').first().click();
    await page.locator('.card-title').waitFor();
    assert.match(await page.getAttribute('.buy a', 'href'), /tcgplayer\.com/);
  });
  await step('keyword in card text opens the definition sheet', async () => {
    await page.goto(base + '#/card/ST31-002');
    await page.locator('.effect-text .kw').first().click();
    await page.locator('.sheet.open').waitFor();
    assert.match(await page.textContent('#sheet-title'), /Blocker/);
    await page.keyboard.press('Escape');
  });

  // 3. Meta
  await step('meta lists at least 5 decks and #1 opens a decklist', async () => {
    await page.goto(base + '#/meta');
    await page.locator('.meta-row').first().waitFor();
    assert.ok(await page.locator('.meta-row').count() >= 5);
    await page.locator('.meta-row').first().click();
    await page.locator('.dl-card').first().waitFor();
    assert.ok(await page.locator('.curve-col').count() >= 8);
  });

  // 4. Glossary
  await step('glossary search finds blocker', async () => {
    await page.goto(base + '#/glossary');
    await page.fill('.search-field input', 'blocker');
    await page.locator('details[data-term="Blocker"]').waitFor();
  });

  // 5. Offline (Review Focus 1)
  await step('after first load, the app and lesson 1 work offline', async () => {
    await page.goto(base + '#/learn');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload(); // make sure the page is controlled by the service worker
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await ctx.setOffline(true);
    await page.goto(base + '#/lesson/1');
    await page.locator('.lesson-title').waitFor({ timeout: 8000 });
    await page.goto(base + '#/learn');
    await page.locator('.island').first().waitFor({ timeout: 8000 });
    await ctx.setOffline(false);
  });
  await ctx.close();
}

// 6. Blocked storage (Review Focus 2)
{
  const { ctx, page } = await phone();
  await ctx.addInitScript(() => {
    const deny = () => { throw new DOMException('denied', 'SecurityError'); };
    Object.defineProperty(window, 'localStorage', { get: deny });
  });
  await step('with storage blocked, lesson 1 still opens and quiz runs', async () => {
    await page.goto(base + '#/lesson/1');
    await page.click('.lc-opt[data-layout="mobile"]'); // nothing can be remembered, so the chooser asks
    await page.locator('.lesson-title').waitFor();
    await page.click('.lesson-next');
    await page.locator('.lesson-page').waitFor();
  });
  await ctx.close();
}

// 7. Deck builder, price section, backup → restore on another "phone" (Phase 2)
{
  const { ctx, page } = await phone();
  await ctx.addInitScript(() => localStorage.setItem('deckhand:seenIntro', 'true'));
  await step('new deck: pick a Leader, add 4 copies, 5th is refused with a reason', async () => {
    await page.goto(base + '#/decks');
    await page.click('text=New deck');
    await page.locator('.pick-leader').first().click();
    const first = page.locator('.add-tile').first();
    await first.waitFor();
    for (let i = 0; i < 5; i++) { await first.click(); await page.waitForTimeout(120); }
    assert.match(await page.textContent('.toast'), /4 copies/);
    assert.match(await page.textContent('.bar-main strong'), /^4 \/ 50/);
  });
  await step('a winning meta list copies into my decks as a legal 50-card deck', async () => {
    await page.goto(base + '#/deck/1');
    await page.click('text=Copy into my decks');
    await page.locator('.bar-check').waitFor();
    assert.match(await page.textContent('.bar-main strong'), /^50 \/ 50/);
    assert.match(await page.textContent('.bar-check'), /Legal/);
    await page.click('.seg [data-tab="check"]');
    assert.match(await page.inputValue('.export-box'), /^1x[A-Z0-9]+-\d+\n\d+x/);
  });
  await step('card detail shows a price history section', async () => {
    await page.goto(base + '#/card/OP14-020');
    await page.locator('.price-host h2').waitFor();
  });
  let code;
  await step('backup code is produced', async () => {
    await page.goto(base + '#/about');
    code = await page.evaluate(async () => (await import('./js/lib/backup.js')).makeBackup({
      progress: JSON.parse(localStorage.getItem('deckhand:progress') || '{"completed":[],"quiz":{}}'),
      decks: JSON.parse(localStorage.getItem('deckhand:decks') || '[]'), theme: null }));
    assert.match(code, /^DH1\./);
  });
  await ctx.close();
  const other = await phone();
  await step('restoring the code on a fresh phone brings the decks back', async () => {
    await other.page.goto(base + '#/about');
    await other.page.click('text=Restore from a backup');
    await other.page.fill('#restore-box', code);
    await other.page.click('text=Check the code');
    await other.page.click('.restore-go');
    await other.page.locator('.good-text').waitFor();
    await other.page.goto(base + '#/decks');
    await other.page.locator('.my-deck').first().waitFor({ timeout: 5000 });
    assert.equal(await other.page.locator('.my-deck').count(), 2, `restored from: ${code.slice(0, 12)}…`);
  });
  await other.ctx.close();
}

// 8. Phase 2 review regressions (service worker blocked so network stubs apply)
{
  const { ctx, page } = await phone({ serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    localStorage.setItem('deckhand:seenIntro', 'true');
    localStorage.setItem('deckhand:decks', JSON.stringify([{ id: 'd_lost', name: 'Lost leader', leaderId: 'ZZ99-001', entries: [{ id: 'OP07-022', count: 4 }], updatedAt: '2026-11-01T00:00:00Z' }]));
  });
  await step('a deck whose Leader vanished opens the Leader picker instead of breaking', async () => {
    await page.goto(base + '#/build/d_lost');
    await page.locator('.pick-leader').first().waitFor({ timeout: 5000 });
    assert.match(await page.textContent('.build-leader'), /ZZ99-001/);
  });
  await step('visiting the builder repeatedly does not pile listeners on the page', async () => {
    await page.evaluate(() => {
      const view = document.getElementById('view');
      window.__viewListeners = 0;
      const orig = view.addEventListener.bind(view);
      view.addEventListener = (...a) => { window.__viewListeners++; return orig(...a); };
    });
    for (let i = 0; i < 3; i++) { await page.goto(base + '#/decks'); await page.locator('.my-deck').first().waitFor(); await page.goto(base + '#/build/d_lost'); await page.locator('.pick-leader').first().waitFor(); }
    assert.equal(await page.evaluate(() => window.__viewListeners), 0);
  });
  await step('a slow price file for the previous card never draws on the next card', async () => {
    const dates = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10));
    await page.route('**/data/prices/OP14.json', async r => { await new Promise(res => setTimeout(res, 1500)); r.fulfill({ contentType: 'application/json', body: JSON.stringify({ dates, p: { 'OP14-031': dates.map((_, i) => 5 + i / 10) } }) }); });
    await page.goto(base + '#/card/OP14-031');
    await page.locator('.card-title').waitFor();
    await page.goto(base + '#/card/ST01-001');
    await page.locator('.card-title').waitFor();
    await page.waitForTimeout(2200);
    assert.match(await page.textContent('.card-title'), /Luffy/);
    assert.equal(await page.locator('.price-host svg').count(), 0, 'OP14-031 chart drawn on ST01-001');
  });
  await ctx.close();
}
{
  const { ctx, page } = await phone({ serviceWorkers: 'block' });
  await step('a malformed tournament entry does not crash the builder', async () => {
    await page.route('**/data/meta.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ source: 'x', decks: [{ rank: 1, name: 'Broken', leaderId: 'OP13-001', colors: [] }] }) }));
    await page.goto(base + '#/build/from/1/0');
    await page.getByText("isn't available").waitFor({ timeout: 5000 });
  });
  await ctx.close();
}
{
  const { ctx, page } = await phone();
  await ctx.addInitScript(() => { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'deckhand:decks') throw new DOMException('full', 'QuotaExceededError'); return orig.call(this, k, v); }; });
  await step('restore warns when the phone could not actually save it', async () => {
    const code = await (async () => { await page.goto(base + '#/about'); return page.evaluate(async () => (await import('./js/lib/backup.js')).makeBackup({ progress: { completed: [1], quiz: { 1: 3 } }, decks: [{ id: 'd_x1', name: 'X', leaderId: null, entries: [] }] })); })();
    await page.click('text=Restore from a backup');
    await page.fill('#restore-box', code);
    await page.click('text=Check the code');
    await page.click('.restore-go');
    await page.locator('.restore-result .bad-text').waitFor({ timeout: 3000 });
  });
  await ctx.close();
}

// 9. Practice game (Phase 3)
{
  const { ctx, page } = await phone({ serviceWorkers: 'block' });
  await ctx.addInitScript(() => localStorage.setItem('deckhand:seenIntro', 'true'));
  const panel = page.locator('.g-panel');
  const waitMyTurn = async () => { for (let i = 0; i < 80; i++) { if (!(await panel.locator('.g-wait').count())) return; await page.waitForTimeout(250); } throw new Error('computer never finished'); };
  await step('start a practice game from the Learn tab (Easy, coach on, I go first)', async () => {
    await page.goto(base + '#/learn');
    await page.click('text=Play a practice game');
    await page.locator('.play-form').waitFor();
    await page.click('text=Me');
    await page.click('.start-game');
    await page.locator('.g-panel [data-act*="keep"]').waitFor();
    assert.match(await page.textContent('.g-coach'), /hand/i);
    await page.click('[data-act*="keep"]');
    await waitMyTurn();
  });
  await step('play a card, use a hint, end the turn; the computer plays its turn', async () => {
    const card = page.locator('.g-hand .gc.can').first();
    if (await card.count()) { await card.click(); await panel.locator('[data-act*="play"]').first().click(); }
    while (await panel.locator('.g-q').count()) { const b = panel.locator('.btn-primary:not([disabled]), [data-act]').first(); await b.click(); await page.waitForTimeout(120); }
    await page.click('.hint-btn');
    await page.locator('.g-coach.hint').waitFor();
    await page.click('[data-act*="endTurn"]');
    await page.waitForTimeout(300);
    for (let i = 0; i < 120 && (await panel.locator('.g-wait').count() || await panel.locator('.g-q').count()); i++) {
      if (await panel.locator('.g-q').count()) { await panel.locator('.btn-primary:not([disabled]), [data-act]').first().click(); }
      await page.waitForTimeout(250);
    }
    assert.ok(await page.locator('[data-act*="endTurn"]').count(), 'back to my turn');
  });
  await step('give DON!! to my Leader and attack', async () => {
    await page.locator('.g-zone.me .g-lead .gc').first().click();
    await panel.locator('[data-act*="giveDon"]').click();
    await page.locator('.g-zone.me .g-lead .gc').first().click();
    await panel.locator('[data-act*="attack"]').first().click();
    await page.locator('.g-log p').last().waitFor();
    assert.ok((await page.textContent('.g-log')).length > 0);
  });
  await step('leaving and coming back resumes the same game', async () => {
    for (let i = 0; i < 80 && (await panel.locator('.g-wait').count()); i++) await page.waitForTimeout(250);
    while (await panel.locator('.g-q').count()) { await panel.locator('.btn-primary:not([disabled]), [data-act]').first().click(); await page.waitForTimeout(150); }
    await page.goto(base + '#/play');
    await page.locator('text=Resume game').waitFor();
    await page.click('text=Resume game');
    await page.locator('.game').waitFor();
    assert.ok(await page.locator('.g-zone.me .gc').count() >= 1);
  });
  await step('Rematch then leaving during the computer\'s turn leaves no game running in the background', async () => {
    const before = errors.length;
    await page.goto(base + '#/play');
    await page.click('text=Computer');
    await page.click('.start-game');
    await page.locator('.game').waitFor();
    await page.evaluate(() => { Date.now = () => 1001; const p = document.querySelector('.g-panel'); p.insertAdjacentHTML('beforeend', '<button type="button" class="rematch">r</button>'); p.querySelector('.rematch').click(); });
    await page.waitForTimeout(150);
    await page.goto(base + '#/cards');
    await page.waitForTimeout(2500);
    assert.equal(errors.length, before, errors.slice(before).join(' | '));
    assert.equal(await page.locator('.game').count(), 0);
  });
  await ctx.close();
}

// 10. Computer version
{
  const { ctx, page } = await phone({ layout: null, viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  await step('first open asks computer or phone, suggesting computer on a wide screen', async () => {
    await page.goto(base);
    await page.locator('.layout-chooser').waitFor();
    assert.equal(await page.getAttribute('.lc-opt.suggested', 'data-layout'), 'desktop');
    await page.click('.lc-opt[data-layout="desktop"]');
    await page.locator('.layout-chooser').waitFor({ state: 'detached' });
    assert.equal(await page.getAttribute('html', 'data-layout'), 'desktop');
    const nav = await page.locator('.tabbar').boundingBox();
    assert.ok(nav.height > nav.width, 'navigation is a sidebar');
  });
  await step('the choice is remembered and the header switch flips versions', async () => {
    await page.reload();
    assert.equal(await page.locator('.layout-chooser').count(), 0);
    await page.click('#layout-toggle');
    assert.equal(await page.getAttribute('html', 'data-layout'), 'mobile');
    await page.click('#layout-toggle');
    assert.equal(await page.getAttribute('html', 'data-layout'), 'desktop');
  });
  await step('computer deck builder shows search and the deck side by side', async () => {
    await page.evaluate(() => localStorage.setItem('deckhand:seenIntro', 'true'));
    await page.goto(base + '#/build/from/1/0');
    await page.locator('.bb-side .dl-row').first().waitFor();
    assert.ok(await page.locator('.bb-add .add-tile').count() > 0);
    const before = await page.locator('.bb-side .stepper-n').first().textContent();
    await page.locator('.bb-side [data-minus]').first().click();
    assert.equal(Number(await page.locator('.bb-side .stepper-n').first().textContent()), Number(before) - 1);
  });
  await step('game keyboard shortcuts: 1 picks a button, E ends the turn', async () => {
    await page.goto(base + '#/play');
    await page.click('text=Me');
    await page.click('.start-game');
    await page.locator('[data-act*="keep"]').waitFor();
    await page.keyboard.press('1');
    await page.locator('[data-act*="endTurn"]').waitFor();
    await page.keyboard.press('e');
    await page.locator('.g-wait').waitFor({ timeout: 3000 });
  });
  await ctx.close();
}

await browser.close();
server.close();
for (const r of results) console.log(r.join('  '));
if (errors.length) console.log('Page errors:\n  ' + [...new Set(errors)].join('\n  '));
const failed = results.filter(r => r[0] === 'FAIL').length + (errors.length ? 1 : 0);
console.log(`\n${results.length - results.filter(r => r[0] === 'FAIL').length}/${results.length} steps passed${errors.length ? ', with page errors' : ''}`);
process.exit(failed ? 1 : 0);
