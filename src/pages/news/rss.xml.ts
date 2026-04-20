import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { listNews } from '../../lib/directus';

export async function GET(context: APIContext) {
  const news = await listNews(50).catch(() => []);
  return rss({
    title: 'Cureation — Dispatches',
    description: 'News, editorials and archive notes.',
    site: context.site ?? new URL('https://cureation.net'),
    items: news.map((n: any) => ({
      title: n.title,
      link: `/news/${n.slug}`,
      pubDate: new Date(n.published_date || n.date_created || Date.now()),
      description: n.excerpt || '',
      categories: [n.category].filter(Boolean),
    })),
    customData: `<language>en</language>`,
  });
}
