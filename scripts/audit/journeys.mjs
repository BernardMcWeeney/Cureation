import path from 'node:path';
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const base = process.env.AUDIT_BASE_URL || 'https://cureation.com';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
const results = {};
try {
  await page.goto(base + '/discography/faith', { waitUntil: 'networkidle' });
  const bookmark = page.locator('[data-bookmark]').first();
  const before = await bookmark.getAttribute('data-saved');
  await bookmark.click();
  results.bookmark = { before, after: await bookmark.getAttribute('data-saved'), savedCount: await page.evaluate(() => JSON.parse(localStorage.getItem('cureation:bookmarks') || '[]').length) };
  await page.keyboard.press('Control+k');
  const search = page.locator('[data-search-input]');
  await search.fill('Troxy');
  await page.locator('.search__chip').first().waitFor({ timeout: 20000 });
  results.search = { href: await page.locator('.search__chip').first().getAttribute('href') };
  const linkResponse = await page.request.get(base + results.search.href);
  results.search.status = linkResponse.status();
} catch (error) { results.error = error.message; }
const output = process.env.AUDIT_OUTPUT || 'reports/latest/journeys.json';
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify(results, null, 2) + '\n');
await browser.close();
console.log(JSON.stringify(results));
