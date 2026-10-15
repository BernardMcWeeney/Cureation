import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('album details stay compact and share the song and review sidebar geometry', async ({ page }) => {
  test.setTimeout(120_000);
  let songPath = '';
  const rails: number[] = [];
  for (const route of ['/discography/disintegration', '/reviews/disintegration']) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(route);
    const grid = page.locator('.archive-columns').first();
    rails.push(await grid.evaluate((element) => element.lastElementChild!.getBoundingClientRect().width));
    if (route.startsWith('/discography')) {
      await expect(page.locator('[role="tablist"]')).toHaveCount(0);
      await expect(page.locator('#album-panel-tracks')).toBeVisible();
      await expect(page.locator('#album-panel-personnel')).toBeVisible();
      songPath = (await page.locator('#album-panel-tracks a[href^="/songs/"]').first().getAttribute('href'))!;
      await expect(page.locator('#album-story')).not.toHaveAttribute('open');
      await expect(page.locator('#album-panel-live')).not.toHaveAttribute('open');
      await page.locator('#album-story > summary').click();
      await expect(page.locator('#album-story')).toHaveAttribute('open', '');
      await page.locator('#album-story > summary').click();
      await page.goto('/discography/disintegration#album-panel-live');
      await expect(page.locator('#album-panel-live')).toHaveAttribute('open', '');
    }
  }
  await page.goto(songPath);
  rails.push(await page.locator('.archive-columns').evaluate((element) => element.lastElementChild!.getBoundingClientRect().width));
  expect(rails).toEqual([340, 340, 340]);
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ['/discography', '/discography/disintegration', '/songs/a-fragile-thing', songPath, '/reviews/disintegration', '/timeline']) {
      await page.goto(route);
      await page.addStyleTag({ content: '.section, .issue-section { content-visibility: visible !important; } *, *::before, *::after { transition: none !important; animation: none !important; }' });
      const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > innerWidth + 2).slice(0, 15).map((el) => `${el.tagName}.${el.className} ${Math.round(el.getBoundingClientRect().right)}`));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), `${width}: ${route} ${overflow.join(', ')}`).toBe(true);
      await expect(page.locator('main h1')).toHaveCount(1);
      if (route === '/songs/a-fragile-thing') {
        expect(await page.locator('.song-details dt').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
        expect(await page.locator('.song-details dd').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(18);
        if (width === 1440) await page.screenshot({ path: '/tmp/cureation-readable-song.png' });
      }
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(audit.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) })), `${width}: ${route}`).toEqual([]);
      await page.evaluate(() => { document.documentElement.dataset.theme = 'papers'; });
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      const lightAudit = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
      expect(lightAudit.violations.map(({ nodes }) => nodes.map(({ target, failureSummary }) => ({ target, failureSummary }))), `Light mode: ${width}: ${route}`).toEqual([]);
      await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
      if (width === 1440 && ['/discography/disintegration', '/timeline'].includes(route)) await page.screenshot({ path: `/tmp/cureation-${route.split('/').pop()}-desktop.png` });
    }
  }
});

test('timeline follows scrolling and connects album artwork to the record', async ({ page }) => {
  await page.goto('/timeline');
  const release = page.locator('[data-timeline-event]').filter({ has: page.locator('a.timeline-art[href="/discography/disintegration"]') }).first();
  await expect(release).toBeVisible();
  const year = await release.getAttribute('data-year');
  await release.evaluate((element) => element.scrollIntoView({ block: 'start' }));
  await expect(page.locator('[data-current-year]')).toHaveText(year!);
  await expect(release).toHaveClass(/is-current/);
  await expect(release.locator('img')).toHaveAttribute('alt', /Disintegration/);
  await expect(release.locator('img')).toHaveJSProperty('complete', true);
  await expect(release.locator('img')).not.toHaveJSProperty('naturalWidth', 0);
  await page.screenshot({ path: '/tmp/cureation-timeline-release.png' });
  await release.locator('a.timeline-art').click();
  await expect(page).toHaveURL(/\/discography\/disintegration$/);
});
