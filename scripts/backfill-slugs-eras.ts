/**
 * Backfill: slugs on discography + songs + singles, era_id on discography.
 * Idempotent — only writes where value is null.
 *
 * Run:  DIRECTUS_URL=... DIRECTUS_TOKEN=... npx tsx scripts/backfill-slugs-eras.ts
 */

const URL_BASE = (process.env.DIRECTUS_URL || 'https://dash.cureation.net').replace(/\/$/, '');
const TOKEN = process.env.DIRECTUS_TOKEN;
if (!TOKEN) throw new Error('DIRECTUS_TOKEN env var is required');

async function api(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${URL_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

function eraSlugForYear(year: number): string {
  if (year < 1981) return 'early';
  if (year < 1983) return 'dark';
  if (year < 1985) return 'pop';
  if (year < 1993) return 'imperial';
  if (year < 2024) return 'wilderness';
  return 'return';
}

async function ensureUnique(slug: string, seen: Set<string>): Promise<string> {
  let s = slug || 'untitled';
  let i = 2;
  while (seen.has(s)) {
    s = `${slug}-${i++}`;
  }
  seen.add(s);
  return s;
}

async function backfillCollection(
  collection: string,
  extraFields: string[] = []
): Promise<void> {
  const fields = ['id', 'title', 'slug', ...extraFields].join(',');
  const { data } = await api(`/items/${collection}?limit=-1&fields=${fields}`);
  const seen = new Set<string>(data.filter((r: any) => r.slug).map((r: any) => r.slug));
  const updates: Array<{ id: any; patch: any }> = [];
  for (const row of data) {
    if (row.slug) continue;
    if (!row.title) continue;
    const base = slugify(row.title);
    const s = await ensureUnique(base, seen);
    const patch: any = { slug: s };
    if (collection === 'discography' && !row.era_id && row.release_date) {
      const y = parseInt(row.release_date.slice(0, 4), 10);
      if (!isNaN(y)) patch.__era_slug = eraSlugForYear(y);
    }
    updates.push({ id: row.id, patch });
  }
  if (updates.length === 0) {
    console.log(`• ${collection}: nothing to backfill`);
    return;
  }
  console.log(`→ ${collection}: patching ${updates.length} rows`);

  // Resolve era slug → era_id for discography
  let erasBySlug: Record<string, string> = {};
  if (collection === 'discography') {
    const { data: eras } = await api('/items/eras?limit=-1&fields=id,slug');
    erasBySlug = Object.fromEntries(eras.map((e: any) => [e.slug, e.id]));
  }

  for (const u of updates) {
    const patch: any = { slug: u.patch.slug };
    if (u.patch.__era_slug && erasBySlug[u.patch.__era_slug]) {
      patch.era_id = erasBySlug[u.patch.__era_slug];
    }
    await api(`/items/${collection}/${u.id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }
  console.log(`✓ ${collection}: patched ${updates.length}`);
}

async function main() {
  await backfillCollection('discography', ['era_id', 'release_date']);
  await backfillCollection('songs');
  // singles don't have slug field — skip
  console.log('\n✔ backfill complete');
}

main().catch((e) => {
  console.error('\n✗ failed:', e.message);
  process.exit(1);
});
