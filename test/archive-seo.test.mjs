import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'cureation-seo-test-'));
for (const name of ['archive-dates', 'seo', 'sitemap', 'assets']) {
  const source = (await fs.readFile(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8'))
    .replace(/from '\.\/(archive-dates|seo|directus)'/g, "from './$1.mjs'");
  await fs.writeFile(path.join(temp, `${name}.mjs`), ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText);
}
await fs.writeFile(path.join(temp, 'directus.mjs'), 'export const DIRECTUS_URL = "https://dash.cureation.net"; export const fetchRaw = (...args) => globalThis.sitemapFetch(...args);');
const { datePrecision, tourStatus, rssDate } = await import(pathToFileURL(path.join(temp, 'archive-dates.mjs')));
const { pageSeo, jsonLd, canonicalUrl } = await import(pathToFileURL(path.join(temp, 'seo.mjs')));
const { sitemapEntries, sitemapXml } = await import(pathToFileURL(path.join(temp, 'sitemap.mjs')));
const { asset, responsiveAsset } = await import(pathToFileURL(path.join(temp, 'assets.mjs')));

test('responsive cover images transform Directus URLs and preserve external URLs', () => {
  const src = asset('file-id', 'hero');
  assert.equal(new URL(responsiveAsset(src, 480)).searchParams.get('width'), '480');
  assert.equal(new URL(responsiveAsset(src, 480)).searchParams.get('format'), 'auto');
  assert.equal(responsiveAsset('https://example.com/cover.jpg', 480), undefined);
  assert.equal(asset('https://example.com/cover.jpg', 'hero'), 'https://example.com/cover.jpg');
});

test('archive dates retain precision and tour labels follow confirmed full dates', () => {
  assert.equal(datePrecision('1981'), 'year');
  assert.equal(rssDate('1981'), undefined);
  assert.equal(rssDate(null), undefined);
  assert.equal(rssDate('1981-04-14').toISOString(), '1981-04-14T00:00:00.000Z');
  assert.equal(datePrecision('1981-04'), 'month');
  assert.equal(datePrecision('1981-13'), null);
  assert.equal(datePrecision('1981-02-31'), null);
  assert.equal(tourStatus('2026-06-05', '2026-08-30', '2026-10-14'), 'completed');
  assert.equal(tourStatus('2026-06-05', '2026-08-30', '2026-08-30'), 'current');
  assert.equal(tourStatus('2027-06-05', '2027-08-30', '2026-10-14'), 'upcoming');
  assert.equal(tourStatus('2026', '2026', '2026-10-14'), 'unknown');
});

test('record metadata is factual, preserves date precision and cannot break out of JSON-LD', () => {
  const album = pageSeo('/discography/faith/', { title: 'Faith', release_date: '1981', description: '<p>Third studio album.</p>' });
  assert.equal(album.canonical, 'https://cureation.com/discography/faith');
  assert.equal(album.description, 'Third studio album.');
  assert.equal(album.entity['@type'], 'MusicAlbum');
  assert.equal(album.entity.datePublished, '1981');
  const partialShow = pageSeo('/setlists/example', { date: '1981', venue: 'Unknown room' });
  assert.equal(partialShow.entity, undefined);
  const show = pageSeo('/setlists/example', { date: '1981-04-14', venue: 'A room', city: 'London' });
  assert.equal(show.entity.startDate, '1981-04-14');
  assert.equal(show.entity.location.address.streetAddress, undefined);
  const hostile = { title: '</script><script>alert(1)</script>' };
  assert.ok(!jsonLd(hostile).includes('</script>'));
  assert.deepEqual(JSON.parse(jsonLd(hostile)), hostile);
  assert.notEqual(pageSeo('/songs', null).description, pageSeo('/venues', null).description);
});

test('sitemap pagination includes records beyond former caps, de-duplicates URLs and excludes invalid slugs', async () => {
  const offsets = [];
  globalThis.sitemapFetch = async (collection, params) => {
    if (collection === 'setlists') {
      offsets.push(params.offset);
      return params.offset < 2000 ? Array.from({ length: 500 }, (_, i) => ({ id: params.offset + i, slug: `show-${params.offset + i}` })) : [{ id: 2001, slug: 'last-show' }];
    }
    if (collection === 'songs') return [{ slug: 'bare' }, { slug: 'bare' }, { slug: null }, { slug: 'bad/path' }];
    if (collection === 'tours') return [{ slug: '2026-european-summer-shows' }];
    if (collection === 'news') return [{ slug: 'reference', category: 'wiki', author_name: 'Test Author' }];
    if (collection === 'reviews') assert.equal(params['filter[status][_eq]'], 'published');
    return [];
  };
  const entries = await sitemapEntries();
  assert.deepEqual(offsets, [0, 500, 1000, 1500, 2000]);
  assert.ok(entries.some((entry) => entry.loc.endsWith('/setlists/last-show')));
  assert.equal(entries.filter((entry) => entry.loc.endsWith('/songs/bare')).length, 1);
  assert.equal(entries.filter((entry) => entry.loc.endsWith('/tours/2026-european-summer-shows')).length, 1);
  assert.ok(entries.some((entry) => entry.loc.endsWith('/wiki/reference')));
  assert.ok(entries.some((entry) => entry.loc.endsWith('/publication/author/test-author')));
  assert.ok(!entries.some((entry) => entry.loc.includes('bad/path') || entry.loc.endsWith('/my-archive')));
  assert.equal(new Set(entries.map((entry) => entry.loc)).size, entries.length);
  assert.match(sitemapXml([{ loc: canonicalUrl('/songs/a?x=1&y=2'), lastmod: '1981' }]), /x=1&amp;y=2/);
  assert.ok(!sitemapXml([{ loc: canonicalUrl('/'), lastmod: '1981' }]).includes('lastmod'));
  delete globalThis.sitemapFetch;
});

test.after(async () => { await fs.rm(temp, { recursive: true, force: true }); });
