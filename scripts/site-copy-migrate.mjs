/** Idempotent: creates missing public display-copy records without overwriting edits. */
import fs from 'node:fs';
import { spawn } from 'node:child_process';
const url = (process.env.DIRECTUS_URL || process.env.PUBLIC_DIRECTUS_URL || 'https://dash.cureation.net').replace(/\/$/, '');
const token = process.env.DIRECTUS_TOKEN;
if (!token) throw new Error('Set DIRECTUS_TOKEN to a Directus admin token in your shell.');
async function api(path, method = 'GET', body) {
  // Pass credentials and payload via stdin, not command-line arguments or files.
  const { status, result } = await new Promise((resolve, reject) => {
    const config = [
      `url = ${JSON.stringify(`${url}${path}`)}`,
      `request = ${JSON.stringify(method)}`,
      `header = ${JSON.stringify(`Authorization: Bearer ${token}`)}`,
      'header = "Content-Type: application/json"',
      ...(body === undefined ? [] : [`data = ${JSON.stringify(JSON.stringify(body))}`]),
    ].join('\n');
    const child = spawn('curl', ['--globoff', '--silent', '--show-error', '--max-time', '30', '--config', '-', '--write-out', '\n%{http_code}']);
    let output = '', errors = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { errors += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code) return reject(new Error(`Directus connection failed: ${errors}`));
      const split = output.lastIndexOf('\n');
      try { resolve({ status: Number(output.slice(split + 1)), result: output.slice(0, split) ? JSON.parse(output.slice(0, split)) : { data: null } }); }
      catch (error) { reject(error); }
    });
    child.stdin.end(config);
  });
  if (status < 200 || status >= 300) throw new Error(`${method} ${path}: ${status} ${JSON.stringify(result.errors)}`);
  return result.data;
}
const collections = await api('/collections');
if (!collections.some((item) => item.collection === 'site_copy')) {
  await api('/collections', 'POST', {
    collection: 'site_copy', schema: {},
    meta: { icon: 'edit_note', note: 'Website headings, introductions and display copy. IDs are stable source keys; do not rename them.', display_template: '{{location}} — {{id}}' },
    fields: [
      { field: 'id', type: 'string', schema: { is_primary_key: true, max_length: 255, is_nullable: false }, meta: { interface: 'input', readonly: true, hidden: true } },
      { field: 'location', type: 'string', schema: { max_length: 255 }, meta: { interface: 'input', readonly: true, width: 'full' } },
      { field: 'text', type: 'text', schema: { is_nullable: false }, meta: { interface: 'input-multiline', width: 'full', note: 'Display copy. Preserve inline HTML such as <em> and <br> where present.' } },
    ],
  });
}
const existing = new Set((await api('/items/site_copy?limit=-1&fields=id')).map((item) => item.id));
const seed = JSON.parse(fs.readFileSync(new URL('./site-copy.seed.json', import.meta.url), 'utf8'));
const missing = seed.filter((row) => !existing.has(row.id));
for (let i = 0; i < missing.length; i += 100) await api('/items/site_copy', 'POST', missing.slice(i, i + 100));
// Public users may read public display copy, never write it.
const accesses = await api('/access?filter[role][_null]=true&filter[user][_null]=true&fields=policy');
const publicPolicies = new Set(accesses.map((entry) => typeof entry.policy === 'object' ? entry.policy.id : entry.policy));
if (!publicPolicies.size) throw new Error('No public policy found. Grant public read access to site_copy manually.');
const permissions = await api('/permissions?filter[collection][_eq]=site_copy&limit=-1');
for (const policy of publicPolicies) {
  if (!permissions.some((permission) => permission.policy === policy && permission.action === 'read')) {
    await api('/permissions', 'POST', { policy, collection: 'site_copy', action: 'read', permissions: {}, fields: ['id', 'location', 'text'] });
  }
}
console.log(`site_copy ready: ${missing.length} records created; ${seed.length - missing.length} existing records preserved. Admins can edit immediately. Grant editors read/update access to site_copy.text in their policy.`);
