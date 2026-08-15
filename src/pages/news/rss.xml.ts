import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { listNews } from '../../lib/directus';

export const prerender = false;

export async function GET(context: APIContext) {
  const news = await listNews(50).catch(() => []);
  const newsCategories = new Set(['news', 'rumor', 'rumors']);
  const items = news
    .filter((n: any) => newsCategories.has(String(n.category || '').toLowerCase()))
    .map((n: any) => ({
      title: n.title,
      link: `/publication/${n.slug}`,
      pubDate: new Date(n.published_date || n.date_created || Date.now()),
      description: n.excerpt || '',
      categories: [n.category].filter(Boolean),
    }))
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
    .slice(0, 50);
  return rss({
    title: 'Cureation | News',
    description: 'The latest verified Cure news, announcements, performances and releases from Cureation.',
    site: context.site ?? new URL('https://cureation.net'),
    items,
    customData: `<language>en</language>`,
  });
}
