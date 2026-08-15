import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { listNews, listReviews, listSetlists } from '../lib/directus';

export const prerender = false;

export async function GET(context: APIContext) {
  const [news, reviews, setlists] = await Promise.all([
    listNews(30).catch(() => []),
    listReviews(30).catch(() => []),
    listSetlists({ limit: 20 }).catch(() => []),
  ]);

  const newsItems = news.map((n: any) => ({
    title: n.title,
    link: String(n.category || '').toLowerCase() === 'wiki' ? `/wiki/${n.slug}` : `/publication/${n.slug}`,
    pubDate: new Date(n.published_date || n.date_created || Date.now()),
    description: n.excerpt || '',
    categories: [n.category].filter(Boolean),
  }));

  const setlistItems = setlists
    .filter((s) => s.date)
    .map((s: any) => ({
      title: `${s.venue || 'Setlist'} · ${s.date}`,
      link: `/setlists/${s.slug}`,
      pubDate: new Date(s.date),
      description: `${[s.city, s.country].filter(Boolean).join(', ')}: ${s.song_count || 0} songs${s.tour_name ? ` · ${s.tour_name}` : ''}`,
      categories: ['setlist', s.tour_name].filter(Boolean) as string[],
    }));

  const reviewItems = reviews.map((review) => ({
    title: review.title,
    link: `/reviews/${review.slug}`,
    pubDate: new Date(review.published_date || review.date_created || Date.now()),
    description: review.standfirst || review.verdict || '',
    categories: ['review', review.album.title],
  }));

  const items = [...newsItems, ...reviewItems, ...setlistItems].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime()).slice(0, 50);

  return rss({
    title: 'Cureation | An editorial archive of The Cure',
    description: 'Publication stories, setlists and archive additions from Cureation.',
    site: context.site ?? new URL('https://cureation.net'),
    items,
    customData: `<language>en</language>`,
  });
}
