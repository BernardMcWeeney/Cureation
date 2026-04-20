import type { APIRoute } from 'astro';
import { listAlbums, listNews, listSetlists, listVenues, listTours, listSongs, listMembers } from '../lib/directus';

export const prerender = false;

const STATIC = [
  '/', '/discography', '/discography/ep', '/discography/singles', '/discography/compilations',
  '/songs', '/lyrics', '/setlists', '/setlists/compare', '/tours', '/venues', '/venues/map',
  '/band', '/band/history', '/band/gear', '/band/quotes',
  '/news', '/newsletter', '/wiki', '/stats', '/photos', '/videos',
  '/on-this-day', '/curiosities', '/community', '/about', '/sources', '/colophon',
];

export const GET: APIRoute = async ({ site }) => {
  const origin = (site ?? new URL('https://cureation.net')).origin;

  const [albums, setlists, venues, tours, songs, members, news] = await Promise.all([
    listAlbums().catch(() => []),
    listSetlists({ limit: 2000 }).catch(() => []),
    listVenues().catch(() => []),
    listTours().catch(() => []),
    listSongs({ limit: 2000 }).catch(() => []),
    listMembers().catch(() => []),
    listNews(200).catch(() => []),
  ]);

  const urls: Array<{ loc: string; lastmod?: string }> = [];
  for (const p of STATIC) urls.push({ loc: origin + p });
  for (const a of albums) if (a.slug) urls.push({ loc: `${origin}/discography/${a.slug}`, lastmod: a.date_updated });
  for (const s of songs as any[]) if (s.slug) urls.push({ loc: `${origin}/songs/${s.slug}`, lastmod: s.date_updated });
  for (const s of setlists as any[]) if (s.slug) urls.push({ loc: `${origin}/setlists/${s.slug}`, lastmod: s.date_updated });
  for (const v of venues as any[]) if (v.slug) urls.push({ loc: `${origin}/venues/${v.slug}`, lastmod: v.date_updated });
  for (const t of tours as any[]) if (t.slug) urls.push({ loc: `${origin}/tours/${t.slug}`, lastmod: t.date_updated });
  for (const m of members as any[]) if (m.slug) urls.push({ loc: `${origin}/band/members/${m.slug}`, lastmod: m.date_updated });
  for (const n of news as any[]) if (n.slug) urls.push({ loc: `${origin}/news/${n.slug}`, lastmod: n.date_updated || n.published_date });

  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${esc(String(u.lastmod).slice(0, 10))}</lastmod>` : ''}</url>`).join('\n')}
</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
