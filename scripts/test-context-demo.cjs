const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { join } = require('node:path');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const baseURL = process.env.CONTEXT_BASE_URL || 'http://127.0.0.1:3100';
const storageKey = 'context-workflow-demo-v1';
const screenshotDir = process.env.CONTEXT_SCREENSHOT_DIR;

async function run() {
  const browser = await playwright[process.env.CONTEXT_BROWSER || 'chromium'].launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => {
      if (new URL(request.url()).origin !== new URL(baseURL).origin) errors.push(`Unexpected external request: ${request.url()}`);
    });
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    page.setDefaultTimeout(10000);
    await page.clock.install();
    const response = await page.goto(`${baseURL}/context`);
    assert.equal(response.status(), 200);
    assert.match(await page.title(), /Context/);
    assert.equal(new URL(page.url()).pathname, '/context');
    const state = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)).engine, storageKey);
    const step = async (id, expected) => assert.equal((await state())[id].step, expected);
    const next = () => page.getByRole('button', { name: 'Next', exact: true }).click();
    const close = () => page.getByRole('button', { name: 'Close details', exact: true }).click();
    const restart = () => page.getByRole('button', { name: 'Restart this scenario', exact: true }).click();
    const primary = () => page.locator('#play').click();
    const node = id => page.locator(`[data-node="${id}"]`).click();
    const screenshot = async name => {
      if (!screenshotDir) return;
      await mkdir(screenshotDir, { recursive: true });
      await page.screenshot({ path: join(screenshotDir, `${name}.png`) });
    };

    await restart();
    await node('tech-action');
    assert.match(await page.locator('#detail-body').innerText(), /has not been reached/);
    await close();
    await next();
    await node('retail-agent');
    assert.match(await page.locator('#detail-body').innerText(), /Sample call transcript/);
    await page.getByRole('button', { name: 'Review proposed resolution' }).click();
    assert.match(await page.locator('#detail-body').innerText(), /has not been reached/);
    await close();
    await restart();
    await primary();
    await page.clock.runFor(6600);
    await step('away', 3);
    assert.equal(await page.locator('#play').innerText(), 'Review 2 decisions');
    await page.clock.runFor(10000);
    await step('away', 3);
    assert.equal(await page.locator('#next').isHidden(), true);
    await screenshot('01-founder-approval-gate');
    await primary();
    await page.getByRole('button', { name: 'Approve replacement', exact: true }).click();
    assert.deepEqual((await state()).away.approvals, { retail: true, tech: false });
    assert.equal(await page.getByRole('button', { name: 'Continue demo →', exact: true }).count(), 0);
    await screenshot('02-independent-decisions');
    await page.getByRole('button', { name: 'Review pull request', exact: true }).click();
    await page.getByRole('button', { name: 'Approve fix' }).click();
    assert.equal(await page.locator('#pr-error').isVisible(), true);
    assert.equal((await state()).away.approvals.tech, false);
    await page.getByLabel('I reviewed the sample patch, checks and delivery tradeoff.').check();
    assert.equal(await page.locator('#pr-error').isHidden(), true);
    await screenshot('03-pr-review');
    await page.getByRole('button', { name: 'Approve fix' }).click();
    await step('away', 3);
    await page.getByRole('button', { name: 'Continue demo →', exact: true }).click();
    await step('away', 4);
    await page.clock.runFor(2200);
    await step('away', 5);
    await page.clock.runFor(10000);
    await step('away', 5);
    assert.deepEqual((await state()).away.confirmations, { retail: false, tech: false });
    await node('retail-decision');
    assert.match(await page.locator('#detail-body').innerText(), /Requested · confirmation pending/);
    await close();
    await page.getByRole('button', { name: 'Simulate confirmations', exact: true }).click();
    await step('away', 6);
    await screenshot('04-founder-confirmed');
    await page.reload();
    await step('away', 6);

    await page.getByRole('tab', { name: 'Issue lifecycle', exact: true }).click();
    await restart();
    await next();
    await node('life-context');
    assert.match(await page.locator('#detail-body').innerText(), /Chrome/);
    await close();
    await next();
    await node('life-triage');
    await page.getByLabel('Responsible owner').selectOption('Support · Dani Ross');
    await page.getByLabel('Priority', { exact: true }).selectOption('Urgent');
    await page.getByRole('button', { name: 'Save routing', exact: true }).click();
    await next();
    await node('life-investigate');
    assert.match(await page.locator('#detail-body').innerText(), /Candidate cause until reproduced/);
    await page.getByRole('button', { name: 'Inspect draft PR' }).click();
    assert.match(await page.locator('#detail-body').innerText(), /has not been reached/);
    await close();
    await next();
    await node('life-pullrequest');
    assert.match(await page.locator('#detail-body').innerText(), /Support · Dani Ross/);
    assert.equal(await page.getByRole('button', { name: 'Approve fix' }).count(), 0);
    await close();
    await next();
    await step('lifecycle', 5);
    await screenshot('05-lifecycle-review');
    await primary();
    await page.getByRole('button', { name: 'Approve fix' }).click();
    assert.equal((await state()).lifecycle.approvals.tech, false);
    await page.getByLabel('I reviewed the sample patch, checks and delivery tradeoff.').check();
    await page.getByRole('button', { name: 'Approve fix' }).click();
    await step('lifecycle', 5);
    assert.match(await page.locator('#phase-status').innerText(), /execution pending/);
    await primary();
    await step('lifecycle', 6);
    await page.clock.runFor(2200);
    await step('lifecycle', 7);
    await node('life-followup');
    assert.match(await page.locator('#detail-body').innerText(), /prefers email/);
    await page.getByRole('button', { name: 'Call script', exact: true }).click();
    assert.match(await page.locator('.quote').innerText(), /Is now a good time/);
    await screenshot('06-customer-followup');
    await close();
    await page.clock.runFor(10000);
    await step('lifecycle', 7);
    await page.getByRole('button', { name: 'Simulate customer reply', exact: true }).click();
    await step('lifecycle', 8);
    await screenshot('07-recovery-confirmed');

    await node('life-triage');
    await page.getByRole('button', { name: 'Save routing', exact: true }).click();
    await step('lifecycle', 8);
    await node('life-triage');
    await page.getByLabel('Priority', { exact: true }).selectOption('Normal');
    await page.getByRole('button', { name: 'Save routing', exact: true }).click();
    await step('lifecycle', 5);
    assert.deepEqual((await state()).lifecycle.approvals, { tech: false });
    assert.deepEqual((await state()).lifecycle.confirmations, { tech: false });
    await step('away', 6);
    await page.getByRole('tab', { name: 'Founder overview', exact: true }).click();
    await node('tech-action');
    assert.match(await page.locator('#detail-body').innerText(), /Platform · Lea Chen/);
    await close();
    await restart();
    await step('lifecycle', 5);
    await page.reload();
    await step('away', 0);
    await step('lifecycle', 5);

    await primary();
    await page.clock.runFor(2200);
    await node('retail-agent');
    await page.clock.runFor(10000);
    await step('away', 1);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#detail').isVisible(), false);
    assert.equal(await page.locator('[data-node="retail-agent"]').evaluate(element => element === document.activeElement), true);
    await primary();
    await page.getByRole('tab', { name: 'Issue lifecycle', exact: true }).click();
    await page.clock.runFor(10000);
    await step('away', 1);
    await page.getByRole('tab', { name: 'Founder overview', exact: true }).click();
    await primary();
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.hidden;
    });
    await page.clock.runFor(10000);
    await step('away', 1);
    await page.getByRole('tab', { name: 'Founder overview', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal((await state()).active, 'lifecycle');
    await page.keyboard.press('Home');
    assert.equal((await state()).active, 'away');
    await page.getByRole('button', { name: 'How to use this demo' }).click();
    assert.match(await page.locator('#detail-body').innerText(), /does not connect/);
    await close();

    for (const viewport of [{ width: 1180, height: 700 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(viewport);
      for (const scenario of ['Founder overview', 'Issue lifecycle']) {
        await page.getByRole('tab', { name: scenario, exact: true }).click();
        const boxes = await page.locator('.node, .playback-dock').evaluateAll(elements => elements.map(element => {
          const { x, y, right, bottom } = element.getBoundingClientRect();
          return { x, y, right, bottom };
        }));
        for (const box of boxes) {
          assert.ok(box.x >= 0 && box.y >= 0 && box.right <= viewport.width && box.bottom <= viewport.height, JSON.stringify({ viewport, box }));
        }
        await screenshot(`${viewport.width}-${scenario.replaceAll(' ', '-').toLowerCase()}`);
      }
    }
    for (const value of ['null', '{bad json', '[]', '{"engine":{"active":"missing","away":{"step":100}}}']) {
      await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: storageKey, value });
      await page.reload();
      await primary();
      await page.clock.runFor(2200);
      await step('away', value.includes('step') ? 3 : 1);
      assert.equal(await page.locator('#nodes button').count(), 8);
    }
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new Error('Storage disabled'); };
      Storage.prototype.setItem = () => { throw new Error('Storage disabled'); };
    });
    await page.reload();
    await next();
    assert.equal(await page.locator('#step-title').innerText(), 'Gathering context');
    assert.deepEqual(errors, []);
    console.log('Context browser checks passed: both flows, gates, routing, persistence, playback, keyboard, storage failures, and desktop layouts.');
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
