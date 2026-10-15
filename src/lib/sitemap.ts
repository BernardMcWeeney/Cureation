import { fetchRaw } from './directus';
import { canonicalUrl } from './seo';
import { datePrecision } from './archive-dates';
const staticPaths = ['/', '/about', '/discography', '/songs', '/lyrics', '/setlists', '/setlists/compare', '/tours', '/tours/map', '/tours/2026-european-summer-shows', '/venues', '/band', '/band/history', '/timeline', '/band/members', '/band/gear', '/publication', '/news', '/reviews', '/newsletter', '/wiki', '/stats', '/photos', '/videos', '/on-this-day', '/curiosities', '/community', '/sources'];
export async function sitemapEntries() {
  const entries = new Map(staticPaths.map((path) => [canonicalUrl(path), { loc: canonicalUrl(path) }]));
  const collections: Record<string, string> = { discography: 'discography', songs: 'songs', setlists: 'setlists', venues: 'venues', tours: 'tours', members: 'band/members', reviews: 'reviews', news: 'publication' };
  await Promise.all(Object.entries(collections).map(async ([collection, section]) => {
    for (let offset = 0; ; offset += 500) {
      const rows = await fetchRaw<any>(collection, { limit: 500, offset, fields: collection === 'news' ? 'id,slug,category,author_name' : 'id,slug', sort: 'id', ...(collection === 'reviews' ? { 'filter[status][_eq]': 'published' } : {}) });
      for (const row of rows) {
        if (collection === 'news' && row.author_name) {
          const authorSlug = String(row.author_name).toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');
          if (authorSlug) { const authorUrl = canonicalUrl(`/publication/author/${authorSlug}`); entries.set(authorUrl, { loc: authorUrl }); }
        }
        if (typeof row.slug !== 'string' || !row.slug.trim() || row.slug.includes('/')) continue;
        const route = collection === 'news' && String(row.category).toLowerCase() === 'wiki' ? 'wiki' : section;
        const loc = canonicalUrl(`/${route}/${encodeURIComponent(row.slug)}`);
        entries.set(loc, { loc });
      }
      if (rows.length < 500) break;
    }
  }));
  return [...entries.values()].sort((a, b) => a.loc.localeCompare(b.loc));
}
export function sitemapXml(entries: Array<{ loc: string; lastmod?: string }>) {
  const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map((entry) => `  <url><loc>${escape(entry.loc)}</loc>${entry.lastmod && datePrecision(entry.lastmod) === 'day' ? `<lastmod>${entry.lastmod.slice(0, 10)}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>`;
}
