import path from 'node:path';
import { chromium, firefox } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
const base = process.env.AUDIT_BASE_URL || 'https://cureation.com';
const output = process.env.AUDIT_OUTPUT || 'reports/latest/browser.json';
await fs.mkdir(path.dirname(output), { recursive: true });
const results = [];
for (const engine of ['chromium', 'firefox']) {
  let browser;
  try { browser = await (engine === 'chromium' ? chromium.launch({ channel: 'chrome', headless: true }) : firefox.launch({ headless: true })); } catch (error) { results.push({ engine, limitation: error.message }); continue; }
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    for (const route of ['/', '/reviews', '/sources', '/wiki']) {
      const errors = [], failures = [];
      const onError = (error) => errors.push(error.message);
      const onResponse = (response) => { if (response.status() >= 400) failures.push({ url: response.url(), status: response.status() }); };
      page.on('pageerror', onError); page.on('response', onResponse);
      try {
        const response = await page.goto(base + route, { waitUntil: 'networkidle', timeout: 35000 });
        const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        results.push({ engine, mobile, route, status: response.status(), title: await page.title(), bodyText: (await page.locator('main').innerText()).slice(0, 12000), errors, failedRequests: failures, horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), violations: accessibility.violations.map(({ id, impact, description, helpUrl, nodes }) => ({ id, impact, description, helpUrl, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })) });
      } catch (error) { results.push({ engine, mobile, route, error: error.message, errors, failedRequests: failures }); }
      await fs.writeFile(output, JSON.stringify({ base, time: new Date().toISOString(), results }, null, 2) + '\n');
      page.off('pageerror', onError); page.off('response', onResponse);
    }
    await context.close();
  }
  await browser.close();
}
await fs.writeFile(output, JSON.stringify({ base, time: new Date().toISOString(), results }, null, 2) + '\n');
console.log(JSON.stringify(results.map(({ engine, mobile, route, status, error, violations, errors }) => ({ engine, mobile, route, status, error, errors, violations: violations?.map(({ id, nodes }) => ({ id, count: nodes.length })) }))));

if (process.argv.includes('--strict') && results.some((result) => result.route && (result.error || result.status >= 400 || result.errors?.length || result.failedRequests?.length || result.violations?.length))) process.exitCode = 1;
