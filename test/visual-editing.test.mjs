import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'cureation-editing-test-'));
for (const name of ['editing-context', 'visual-editing', 'cache-policy', 'directus', 'copy-revisions']) {
  const source = (await fs.readFile(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8'))
    .replaceAll('import.meta.env', '({ DIRECTUS_TOKEN: "must-never-forward", PUBLIC_DIRECTUS_TOKEN: "must-never-forward" })')
    .replace(/from '\.\/(editing-context|visual-editing|cache-policy|copy-revisions)'/g, "from './$1.mjs'");
  await fs.writeFile(path.join(temp, `${name}.mjs`), ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText);
}
const middlewareSource = (await fs.readFile(new URL('../src/middleware.ts', import.meta.url), 'utf8'))
  .replace("import { defineMiddleware } from 'astro:middleware';", 'const defineMiddleware = (handler) => handler;')
  .replace(/from '\.\/lib\/(editing-context|directus|cache-policy)'/g, "from './$1.mjs'");
await fs.writeFile(path.join(temp, 'middleware.mjs'), ts.transpileModule(middlewareSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText);
const { onRequest } = await import(pathToFileURL(path.join(temp, 'middleware.mjs')));
const { editingContext } = await import(pathToFileURL(path.join(temp, 'editing-context.mjs')));
const { identify, editable, copyText, copyAttr, copySource, copyTuple } = await import(pathToFileURL(path.join(temp, 'visual-editing.mjs')));
const { fetchRaw, getAllSongPlayCounts, getRunningFigures, getSourceUsage, searchAll } = await import(pathToFileURL(path.join(temp, 'directus.mjs')));
const context = (preview, fn) => editingContext.run({ preview, copy: {} }, fn);

test('attributes are preview-only, use original fields, and survive normalization spreads', async () => {
  const row = identify({ id: 17, name: 'Venue', capacity: 500 }, 'venues');
  assert.equal(editable(row, 'name'), undefined);
  await context(true, async () => {
    assert.equal(editable({ ...row }, 'name'), 'collection:venues;item:17;fields:name;mode:drawer');
    assert.equal(editable(row, 'derived'), undefined);
    assert.equal(editable(row), 'collection:venues;item:17;mode:drawer');
    assert.equal(editable(null), undefined);
  });
});

test('nested relations use their own collection and computed song statistics are excluded', () => context(true, () => {
  const review = identify({ id: 2, album: { id: 9, title: 'Album' } }, 'reviews');
  assert.match(editable(review.album, 'title'), /^collection:discography;item:9;/);
  const song = identify({ id: 1, title: 'Song', times_played_live: 12 }, 'songs');
  assert.equal(editable(song, 'times_played_live'), undefined);
}));

test('copy edits preserve empty strings and local object/tuple identity', () => context(true, () => {
  editingContext.getStore().copy = { heading: '', label: 'Changed' };
  assert.equal(copyText('heading', 'Default'), '');
  assert.equal(copyText('missing', 'Default'), 'Default');
  assert.equal(copyAttr('heading'), 'collection:site_copy;item:heading;fields:text;mode:popover');
  assert.equal(editable({ ...copySource({ label: 'label' }), label: 'Changed' }, 'label'), copyAttr('label'));
  assert.equal(editable(copyTuple(['Heading', 'Body'], { 1: 'label' }), '1'), copyAttr('label'));
}));

test('concurrent preview and public requests cannot leak context', async () => {
  const row = identify({ id: 1, title: 'Title' }, 'news');
  const results = await Promise.all([
    context(true, async () => { await new Promise((resolve) => setTimeout(resolve, 10)); return editable(row, 'title'); }),
    context(false, async () => { await new Promise((resolve) => setTimeout(resolve, 5)); return editable(row, 'title'); }),
  ]);
  assert.match(results[0], /^collection:news;/);
  assert.equal(results[1], undefined);
});

test('preview reads bypass both cache reads and writes, and count promises are request-scoped', async () => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  const entries = new Map();
  let reads = 0, writes = 0, requests = 0;
  globalThis.caches = { default: {
    async match(request) { reads++; return entries.get(request.url)?.clone(); },
    async put(request, response) { writes++; entries.set(request.url, response.clone()); },
  } };
  globalThis.fetch = async (request) => {
    assert.equal(request.headers.get("Authorization"), null);
    requests++;
    return Response.json({ data: [{ id: 1, name: `Revision ${requests}`, song: 1, count: { id: requests } }] });
  };
  try {
    assert.equal((await context(false, () => fetchRaw('venues')))[0].name, 'Revision 1');
    assert.equal((await context(false, () => fetchRaw('venues')))[0].name, 'Revision 1');
    const before = { reads, writes };
    const fresh = await context(true, () => fetchRaw('venues'));
    assert.equal(fresh[0].name, 'Revision 2');
    assert.deepEqual({ reads, writes }, before);
    await context(true, async () => {
      const [first, second] = await Promise.all([getAllSongPlayCounts(), getAllSongPlayCounts()]);
      assert.equal(first, second);
    });
    const previous = requests;
    await context(true, () => getAllSongPlayCounts());
    assert.equal(requests, previous + 1);
  } finally { globalThis.fetch = originalFetch; globalThis.caches = originalCaches; }
});

test('middleware preserves CSP directives, removes frame conflicts, and retains preview through redirects', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ data: [] });
  try {
    const url = new URL('https://cureation.com/discography/ep?visual-editing=true');
    const response = await onRequest({ url, request: new Request(url) }, async () => new Response(null, {
      status: 302,
      headers: { Location: '/discography?type=ep', 'Content-Security-Policy': "script-src 'self'; frame-ancestors 'none'", 'X-Frame-Options': 'DENY', 'Cache-Control': 'public, max-age=300' },
    }));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), '/discography?type=ep&visual-editing=true');
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(response.headers.get('X-Frame-Options'), null);
    assert.equal(response.headers.get('Content-Security-Policy'), "script-src 'self'; frame-ancestors 'self' https://dash.cureation.net");
    const publicUrl = new URL('https://cureation.com/about');
    const publicResponse = await onRequest({ url: publicUrl, request: new Request(publicUrl) }, async () => new Response('Public page', { headers: { 'Cache-Control': 'public, max-age=300' } }));
    assert.equal(publicResponse.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(await publicResponse.text(), 'Public page');
  } finally { globalThis.fetch = originalFetch; }
});

test('public HTML gets a ten-minute edge policy, while unsafe requests and responses never do', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ data: [] });
  const page = async (path, init = {}, responseInit = {}) => {
    const url = new URL(path, 'https://cureation.com');
    return onRequest({ url, request: new Request(url, init) }, async () => new Response('Page', {
      ...responseInit, headers: { 'Content-Type': 'text/html', ...responseInit.headers },
    }));
  };
  try {
    const publicPage = await page('/venues');
    assert.equal(publicPage.headers.get('Cache-Control'), 'public, max-age=0, must-revalidate');
    assert.equal(publicPage.headers.get('Cloudflare-CDN-Cache-Control'), 'public, max-age=600');
    assert.match(publicPage.headers.get('Vary'), /Cookie/);
    assert.match(publicPage.headers.get('Vary'), /Sec-Fetch-Dest/);
    const excluded = [
      ['/venues?visual-editing=true'], ['/venues?access_token=secret'], ['/venues?version=draft'],
      ['/venues', { headers: { Authorization: 'Bearer secret' } }],
      ['/venues', { headers: { Cookie: 'session=secret' } }],
      ['/venues', { headers: { 'Sec-Fetch-Dest': 'iframe' } }],
      ['/venues', { method: 'POST' }], ['/api/search.json?q=cure'], ['/my-archive'], ['/community'],
      ['/venues', {}, { status: 404 }], ['/venues', {}, { status: 500 }],
      ['/venues', {}, { headers: { 'Set-Cookie': 'session=secret' } }],
      ['/venues', {}, { headers: { 'Cache-Control': 'private, max-age=10' } }],
      ['/venues', {}, { headers: { Vary: '*' } }],
    ];
    for (const args of excluded) {
      const response = await page(...args);
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store', args[0]);
      assert.equal(response.headers.get('Cloudflare-CDN-Cache-Control'), 'no-store', args[0]);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test('only allowlisted, anonymous Directus data is cached; private results and bypass requests are excluded', async () => {
  const originalFetch = globalThis.fetch, originalCaches = globalThis.caches;
  let reads = 0, writes = 0, key;
  globalThis.caches = { default: {
    async match(request) { reads++; key = request.url; },
    async put(_request, response) { writes++; assert.equal(response.headers.get('Cache-Control'), 'public, max-age=600'); },
  } };
  globalThis.fetch = async (request) => {
    assert.equal(request.headers.get('Authorization'), null);
    return Response.json({ data: [] });
  };
  try {
    await context(false, () => fetchRaw('venues'));
    assert.equal(reads, 1); assert.equal(writes, 1);
    assert.match(key, /__cureation_public_v2/);
    await context(false, () => fetchRaw('venues', { access_token: 'secret' }));
    await context(false, () => fetchRaw('unapproved_collection'));
    await editingContext.run({ preview: false, bypassCache: true, copy: {} }, () => fetchRaw('venues'));
    assert.equal(reads, 1); assert.equal(writes, 1);
    globalThis.fetch = async () => Response.json({ data: [] }, { headers: { 'Cache-Control': 'private, no-store' } });
    await context(false, async () => {
      await fetchRaw('venues');
      assert.equal(editingContext.getStore().privateData, true);
    });
    assert.equal(writes, 1);
  } finally { globalThis.fetch = originalFetch; globalThis.caches = originalCaches; }
});

test('upstream failures return uncached 503s, including when a page catches the data error', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request) => new URL(request.url).pathname.endsWith('/site_copy')
    ? Response.json({ data: [] }) : new Response('Upstream unavailable', { status: 502 });
  try {
    for (const swallowed of [false, true]) {
      const url = new URL('https://cureation.com/reviews/faith');
      const response = await onRequest({ url, request: new Request(url) }, async () => {
        const rows = swallowed ? await fetchRaw('reviews').catch(() => []) : await fetchRaw('reviews');
        return new Response(JSON.stringify(rows), { status: 404 });
      });
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
      assert.equal(response.headers.get('Retry-After'), '60');
      assert.match(await response.text(), /temporarily unavailable/);
    }
    globalThis.fetch = async () => Response.json({ data: [] });
    const url = new URL('https://cureation.com/reviews/genuinely-missing');
    const missing = await onRequest({ url, request: new Request(url) }, async () => new Response('Missing', { status: 404 }));
    assert.equal(missing.status, 404);
  } finally { globalThis.fetch = originalFetch; }
});

test('unavailable counts remain unknown; valid zero counts remain zero', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('Unavailable', { status: 503 });
    const unavailable = await context(true, () => getRunningFigures());
    assert.ok(Object.values(unavailable).every((value) => value === null));
    globalThis.fetch = async () => Response.json({ data: [{ count: { id: '0' } }] });
    const empty = await context(true, () => getRunningFigures());
    assert.ok(Object.values(empty).every((value) => value === 0));
  } finally { globalThis.fetch = originalFetch; }
});

test('malformed and null API list payloads are unavailable rather than empty archives', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const payload of [null, {}, { data: null }, { data: {} }]) {
      globalThis.fetch = async () => Response.json(payload);
      await assert.rejects(context(true, () => fetchRaw('reviews')), { name: 'DirectusRequestError', status: 503 });
    }
  } finally { globalThis.fetch = originalFetch; }
});

test('sources use nine grouped count queries and preserve unknown citation categories', async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async (request) => {
    requests++;
    const url = new URL(request.url);
    assert.equal(url.searchParams.get('aggregate[count]'), 'id');
    if (url.pathname.endsWith('/photos')) return new Response('Unavailable', { status: 503 });
    const field = url.pathname.endsWith('/setlists') ? 'source_id' : 'source';
    assert.equal(url.searchParams.get('groupBy[]'), field);
    return Response.json({ data: [{ [field]: 3, count: { id: '7' } }] });
  };
  try {
    const counts = await context(true, () => getSourceUsage());
    assert.equal(requests, 9);
    assert.equal(counts.photos, null);
    assert.equal(counts.setlists.get(3), 7);
  } finally { globalThis.fetch = originalFetch; }
});

test('concert search returns canonical slugs and exposes upstream failures', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request) => {
    const url = new URL(request.url);
    assert.equal(url.searchParams.has('filter[title][_nicontains]'), false);
    if (!url.pathname.endsWith('/setlists')) return Response.json({ data: [] });
    assert.match(url.searchParams.get('fields'), /slug/);
    assert.equal(url.searchParams.get('search'), 'Troxy');
    return Response.json({ data: [{ id: 749, slug: '2024-11-01-london-troxy', venue: 'Troxy' }] });
  };
  try {
    const result = await context(true, () => searchAll('Troxy'));
    assert.equal(result.setlists[0].slug, '2024-11-01-london-troxy');
    globalThis.fetch = async () => new Response('Unavailable', { status: 503 });
    await assert.rejects(context(true, () => searchAll('Troxy')));
  } finally { globalThis.fetch = originalFetch; }
});

test.after(async () => { await fs.rm(temp, { recursive: true, force: true }); });


test('plain-language defaults replace old CMS wording and preserve custom edits', () => context(true, () => {
  const key = 'pages_index_2b8c11a3c748';
  editingContext.getStore().copy = { [key]: 'Open the publication' };
  assert.equal(copyText(key, 'Read articles'), 'Read articles');
  editingContext.getStore().copy[key] = 'Our latest stories';
  assert.equal(copyText(key, 'Read articles'), 'Our latest stories');
  editingContext.getStore().copy[key] = '';
  assert.equal(copyText(key, 'Read articles'), '');
}));
