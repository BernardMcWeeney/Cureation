import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`); });
  (page as any).archiveErrors = errors;
});
test.afterEach(async ({ page }) => {
  expect((page as any)?.archiveErrors || [], 'No JavaScript exceptions or HTTP 5xx responses').toEqual([]);
});

test('one click saves a record, survives navigation and can remove it', async ({ page }) => {
  expect((await page.goto('/discography/faith'))?.status()).toBe(200);
  const button = page.locator('[data-bookmark]').first();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/my-archive');
  await expect(page.locator('main a[href="/discography/faith"]').first()).toBeVisible();
  await page.locator('main a[href="/discography/faith"]').first().click();
  await expect(page.locator('[data-bookmark]').first()).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-bookmark]').first().click();
  await expect(page.locator('[data-bookmark]').first()).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cureation:bookmarks') || '[]').length)).toBe(0);
});

test('concert search links resolve and the modal supports keyboard focus', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  const root = page.locator('[data-search]');
  const input = page.locator('[data-search-input]');
  await expect(input).toBeFocused();
  await input.fill('Troxy');
  const result = page.locator('.search__chip').first();
  await expect(result).toBeVisible();
  const href = await result.getAttribute('href');
  expect(href).toMatch(/^\/setlists\/[^/]+$/);
  expect(href).not.toMatch(/^\/setlists\/\d+$/);
  await result.click();
  await expect(page).toHaveURL(new RegExp(href!));
  await expect(page.locator('main h1')).toContainText(/Troxy/i);
  await page.waitForFunction(() => (document.querySelector('[data-search]') as any)?.__wired === true);
  await page.keyboard.press('Control+k');
  await expect(input).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(root).toBeHidden();
});

test('venue filtering and pagination lead to a real venue record', async ({ page }) => {
  await page.goto('/venues');
  const cards = page.locator('[data-venue-card]:visible');
  const firstPage = await cards.first().getAttribute('href');
  const next = page.locator('[data-page-action="next"]');
  await next.click();
  await expect(cards.first()).not.toHaveAttribute('href', firstPage!);
  await page.locator('[data-filter-search]').fill('Troxy');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Troxy');
  await cards.first().click();
  await expect(page.locator('main h1')).toContainText('Troxy');
});

test('comparison includes the full show archive and compares two real shows', async ({ page }) => {
  await page.goto('/setlists/compare');
  const a = page.locator('select[name="a"]'), b = page.locator('select[name="b"]');
  expect(await a.locator('option').count()).toBeGreaterThan(1501);
  const slugs = await a.locator('option').evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value).filter(Boolean).slice(0, 2));
  await a.selectOption(slugs[0]);
  await b.selectOption(slugs[1]);
  await page.getByRole('button', { name: 'Compare →', exact: true }).click();
  await expect(page.locator('.compare-grid')).toBeVisible();
  await expect(page.locator('.compare-col')).toHaveCount(2);
  await expect(page.locator('main')).toContainText(/shared songs?/);
});

test('mobile menu traps focus and restores its opener', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile');
  await page.goto('/songs');
  const opener = page.locator('[data-menu-open]').first();
  await opener.click();
  const menu = page.locator('[data-menu]');
  await expect(menu).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  expect(await menu.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(opener).toBeFocused();
});

for (const route of ['/', '/reviews', '/reviews/faith', '/sources', '/wiki', '/discography/faith', '/setlists/compare']) {
  test(`${route} delivers indexable metadata and passes automated WCAG AA checks`, async ({ page }) => {
    expect((await page.goto(route))?.status()).toBe(200);
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://cureation.com${route === '/' ? '/' : route}`);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /\S.{30,}/);
    const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(schemas.length).toBeGreaterThan(0);
    for (const schema of schemas) expect(() => JSON.parse(schema)).not.toThrow();
    expect(await page.locator('html').getAttribute('aria-pressed')).toBeNull();
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(audit.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)).toBe(false);
  });
}
