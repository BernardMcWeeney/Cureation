import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('timeline and navigation remain usable at mobile, tablet and desktop widths', async ({ page }) => {
  for (const width of [320, 390, 820, 1100, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/timeline');
    await expect(page.locator('main h1')).toHaveText('The Cure timeline');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
    await expect(page.locator('footer a[href="/publication/rss.xml"]')).toHaveCount(1);
    await expect(page.locator('header a[href$="rss.xml"], [data-menu] a[href$="rss.xml"]')).toHaveCount(0);
    if (width > 1200) {
      await expect(page.locator('.mega-nav__links > a[href="/timeline"]')).toBeVisible();
      await expect(page.locator('.mega-nav__links')).toHaveText(/Music.*Live.*Timeline.*Read/s);
      const toggle = page.locator('[data-mega-toggle="read"]');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('#mega-read a[href="/reviews"]')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(toggle).toBeFocused();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await page.locator('[data-mega-toggle="music"]').click();
      await expect(page.locator('#mega-music a')).toHaveText(['Discography', 'Albums', 'Songs', 'Singles', 'Compilations', 'Lyrics', 'EPs']);
      await expect(page.locator('#mega-music small')).toHaveCount(0);
      await page.keyboard.press('Escape');
    } else {
      await page.locator('[data-menu-open]').click();
      await expect(page.locator('[data-menu] a[href="/timeline"]')).toBeVisible();
      await page.locator('.menu__section > summary').filter({ hasText: 'Read' }).click();
      for (const label of ['News', 'Reviews', 'Wiki']) await expect(page.locator('[data-menu]').getByRole('link', { name: label, exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-menu]')).toBeHidden();
    }
    await expect(page.locator('body')).not.toContainText('Open the publication');
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(audit.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }))).toEqual([]);
  }
});

test('homepage text contrast passes for every colour theme in light and dark mode', async ({ page }) => {
  await page.goto('/');
  // Render deferred sections so each theme audit measures current colours.
  await page.addStyleTag({ content: '.section, .issue-section { content-visibility: visible !important; }' });
  for (const mode of ['dark', 'papers']) {
    for (const colour of ['bloodflowers', 'wish', 'disintegration', 'pornography', 'faith', 'head-on-the-door']) {
      await page.evaluate(({ mode, colour }) => {
        document.documentElement.dataset.theme = mode;
        document.documentElement.dataset.colourTheme = colour;
      }, { mode, colour });
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      const audit = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
      expect(audit.violations.map(({ nodes }) => nodes.map(({ target, failureSummary }) => ({ target, failureSummary }))), `${mode}: ${colour}`).toEqual([]);
    }
  }
});
