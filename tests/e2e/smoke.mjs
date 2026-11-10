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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...opts });
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
    await page.locator('.lesson-title').waitFor();
    await page.click('.lesson-next');
    await page.locator('.lesson-page').waitFor();
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
