import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { listNews, listReviews } from '../../lib/directus';

export const prerender = false;

export async function GET(context: APIContext) {
  const [news, reviews] = await Promise.all([
    listNews(50).catch(() => []),
    listReviews(50).catch(() => []),
  ]);
  const items = [
    ...news
      .filter((n: any) => String(n.category || '').toLowerCase() !== 'wiki')
      .map((n: any) => ({
      title: n.title,
      link: `/publication/${n.slug}`,
      pubDate: new Date(n.published_date || n.date_created || Date.now()),
      description: n.excerpt || '',
      categories: [n.category].filter(Boolean),
      })),
    ...reviews.map((review) => ({
      title: review.title,
      link: `/reviews/${review.slug}`,
      pubDate: new Date(review.published_date || review.date_created || Date.now()),
      description: review.standfirst || review.verdict || '',
      categories: ['review', review.album.title],
    })),
  ].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime()).slice(0, 50);
  return rss({
    title: 'Cureation | Publication',
    description: 'Latest news, editorials, reviews and archive notes from Cureation.',
    site: context.site ?? new URL('https://cureation.net'),
    items,
    customData: `<language>en</language>`,
  });
}
