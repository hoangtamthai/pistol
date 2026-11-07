const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { join } = require('node:path');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const baseURL = process.env.CONTEXT_BASE_URL || 'http://127.0.0.1:3001';

async function run() {
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (/hydration|did not match/i.test(message.text())) errors.push(message.text()); });
    page.setDefaultTimeout(15000);
    let submissions = 0;
    await page.route('**/api/waitlist', async route => {
      submissions++;
      assert.deepEqual(route.request().postDataJSON(), { email: 'test@example.com' });
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'We couldn’t save your email. Please try again in a moment.' }) });
    });
    const response = await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    assert.equal(response.status(), 200);
    await page.getByRole('heading', { name: 'Every customer signal. A little more context.' }).waitFor();
    const landingPalette = await page.locator('main').evaluate(element => {
      const style = getComputedStyle(element);
      return ['--accent', '--accent-hover', '--accent-pale', '--paper', '--text', '--secondary', '--border'].map(name => style.getPropertyValue(name).trim());
    });
    const input = page.getByRole('textbox', { name: 'Your email' });
    await input.fill('not-an-email');
    await page.getByRole('button', { name: 'Join waitlist', exact: true }).click();
    assert.equal(submissions, 0);
    assert.equal(await input.evaluate(element => element.validity.valid), false);
    await input.fill('test@example.com');
    await page.getByRole('button', { name: 'Join waitlist', exact: true }).click();
    const formError = page.getByRole('form', { name: 'Join the waitlist' }).getByRole('alert');
    await formError.waitFor();
    assert.match(await formError.innerText(), /try again/);
    assert.equal(await input.inputValue(), 'test@example.com');

    await page.unroute('**/api/waitlist');
    let releaseResponse;
    let markStarted;
    const requestStarted = new Promise(resolve => { markStarted = resolve; });
    await page.route('**/api/waitlist', async route => {
      submissions++;
      await new Promise(resolve => { releaseResponse = resolve; markStarted(); });
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.getByRole('button', { name: 'Join waitlist', exact: true }).click();
    const pendingButton = page.getByRole('button', { name: 'Joining…' });
    await pendingButton.waitFor();
    assert.equal(await pendingButton.isDisabled(), true);
    await requestStarted;
    assert.equal(typeof releaseResponse, 'function');
    releaseResponse();
    await page.getByRole('status').waitFor();
    assert.match(await page.getByRole('status').innerText(), /You’re on the list/);
    assert.equal(submissions, 2);

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByRole('textbox', { name: 'Your email' }).fill('');
    await page.getByRole('textbox', { name: 'Your email' }).blur();
    for (const [width, height] of [[1440, 1000], [375, 812], [812, 375], [768, 1024]]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Overflow at ${width}px`);
      for (const link of await page.getByRole('link', { name: 'Open dashboard' }).all()) assert.equal(await link.getAttribute('href'), '/context');
      if (process.env.CONTEXT_SCREENSHOT_DIR && [1440, 375].includes(width)) {
        await mkdir(process.env.CONTEXT_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: join(process.env.CONTEXT_SCREENSHOT_DIR, `landing-${width}.png`), fullPage: true, animations: 'disabled', caret: 'initial' });
      }
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole('link', { name: 'Open dashboard' }).first().click();
    await page.getByRole('heading', { name: 'Your issue workspace', exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/context');
    const workspacePalette = await page.locator('html').evaluate(element => {
      const style = getComputedStyle(element);
      return ['--blue', '--blue-dark', '--blue-pale', '--bg', '--ink', '--muted', '--line'].map(name => style.getPropertyValue(name).trim());
    });
    assert.deepEqual(landingPalette, workspacePalette, 'Landing colors match the app palette');
    assert.deepEqual(errors, []);
    console.log('Landing: validation, error recovery, pending/success states, responsive layouts, matching blue palette, and dashboard navigation passed.');
  } finally { await browser.close(); }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
