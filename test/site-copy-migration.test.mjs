import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
const exec = promisify(execFile);

test('migration creates public-readable copy, preserves editor changes, and never grants public write', async () => {
  const seed = JSON.parse(await fs.readFile(new URL('../scripts/site-copy.seed.json', import.meta.url)));
  let collections = [], rows = [], permissions = [], creation;
  const server = http.createServer(async (request, response) => {
    assert.equal(request.headers.authorization, 'Bearer migration-test-token');
    const url = new URL(request.url, 'http://localhost');
    let body = '';
    for await (const chunk of request) body += chunk;
    const payload = body ? JSON.parse(body) : undefined;
    let data;
    if (url.pathname === '/collections') {
      if (request.method === 'POST') { creation = payload; collections.push(payload); }
      data = collections;
    } else if (url.pathname === '/items/site_copy') {
      if (request.method === 'POST') rows.push(...payload);
      data = rows;
    } else if (url.pathname === '/access') data = [{ policy: 'public-test-policy' }];
    else if (url.pathname === '/permissions') {
      if (request.method === 'POST') permissions.push(payload);
      data = permissions;
    } else { response.writeHead(404); response.end(); return; }
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ data }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const run = () => exec(process.execPath, ['scripts/site-copy-migrate.mjs'], {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, DIRECTUS_URL: `http://127.0.0.1:${server.address().port}`, DIRECTUS_TOKEN: 'migration-test-token' },
    });
    await run();
    assert.equal(rows.length, seed.length);
    assert.equal(creation.collection, 'site_copy');
    assert.equal(creation.fields.find((field) => field.field === 'id').schema.is_primary_key, true);
    assert.deepEqual(permissions.map((permission) => permission.action), ['read']);
    const changed = 'An editor changed this';
    rows[0].text = changed;
    await run();
    assert.equal(rows.length, seed.length);
    assert.equal(rows[0].text, changed);
    assert.equal(collections.length, 1);
    assert.equal(permissions.length, 1);
    assert.equal(new Set(seed.map((row) => row.id)).size, seed.length);
    assert(seed.every((row) => /^[A-Za-z0-9_-]+$/.test(row.id)));
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
