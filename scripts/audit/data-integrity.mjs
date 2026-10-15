import path from 'node:path';
import fs from 'node:fs/promises';
const base = process.env.DIRECTUS_URL || 'https://dash.cureation.net';
const records = {}, failures = [];
const fields = { discography: 'id,slug,title,type,release_date', songs: 'id,slug,title,album,times_played_live', venues: 'id,slug,name', tours: 'id,slug,name,start_date,end_date', setlists: 'id,slug,date,venue_link,tour,song_count', news: 'id,slug,title,category', reviews: 'id,slug,title,album,status', sources: 'id,name,url' };
for (const [collection, projection] of Object.entries(fields)) {
  records[collection] = [];
  try {
    for (let offset = 0; ; offset += 500) {
      const query = new URLSearchParams({ fields: projection, limit: '500', offset: String(offset), sort: 'id' });
      const response = await fetch(`${base}/items/${collection}?${query}`, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { data } = await response.json();
      records[collection].push(...data);
      if (data.length < 500) break;
    }
  } catch (error) { failures.push({ collection, error: error.message }); }
}
const findings = [];
for (const [collection, rows] of Object.entries(records)) {
  const slugs = new Map(), names = new Map();
  for (const row of rows) {
    if ('slug' in row && !row.slug) findings.push({ collection, id: row.id, issue: 'missing_slug' });
    if (row.slug) {
      if (row.slug.trim() !== row.slug || /[/?#\s]/.test(row.slug)) findings.push({ collection, id: row.id, issue: 'invalid_slug', slug: row.slug });
      slugs.set(row.slug, [...(slugs.get(row.slug) || []), row.id]);
    }
    const name = (row.title || row.name || '').trim().toLowerCase();
    if (name) names.set(name, [...(names.get(name) || []), row.id]);
    if (['songs', 'reviews'].includes(collection) && row.album && !records.discography.some((album) => album.id === (row.album?.id || row.album))) findings.push({ collection, id: row.id, issue: 'unavailable_album_relation', album: row.album });
    if (collection === 'setlists') for (const [field, target] of [['venue_link', 'venues'], ['tour', 'tours']]) {
      if (row[field] && !records[target].some((record) => record.id === (row[field]?.id || row[field]))) findings.push({ collection, id: row.id, issue: 'unavailable_relation', field, value: row[field] });
    }
  }
  for (const [slug, ids] of slugs) if (ids.length > 1) findings.push({ collection, issue: 'duplicate_slug', slug, ids });
  for (const [name, ids] of names) if (ids.length > 1) findings.push({ collection, issue: 'duplicate_name_candidate_not_confirmed', name, ids });
}
const counts = Object.fromEntries(Object.entries(records).map(([collection, rows]) => [collection, rows.length]));
const incompleteness = { songsWithoutAlbum: records.songs.filter((row) => !row.album).length, concertsWithoutVenueRelation: records.setlists.filter((row) => !row.venue_link).length, concertsWithoutTourRelation: records.setlists.filter((row) => !row.tour).length };
const datePrecision = Object.fromEntries(['discography', 'setlists', 'tours'].map((collection) => [collection, records[collection].reduce((counts, row) => { const value = row.release_date || row.date || row.start_date || ''; const precision = /^\d{4}$/.test(value) ? 'year' : /^\d{4}-\d{2}$/.test(value) ? 'month' : /^\d{4}-\d{2}-\d{2}/.test(value) ? 'day' : value ? 'unrecognized' : 'missing'; counts[precision] = (counts[precision] || 0) + 1; return counts; }, {})]));
const result = { incompleteness, datePrecision, time: new Date().toISOString(), access: 'Anonymous public API; no historical records modified', scope: 'Public rows and available relationships; similarity is a review candidate, not proof of duplication', counts, failures, findings };
const output = process.env.AUDIT_OUTPUT || 'reports/latest/data-integrity.json';
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ counts, failures, issueCounts: findings.reduce((counts, finding) => ({ ...counts, [finding.issue]: (counts[finding.issue] || 0) + 1 }), {}) }));
