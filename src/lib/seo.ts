import { datePrecision } from './archive-dates';

export const SITE_URL = 'https://cureation.com';
export const plainText = (value: unknown) => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const summary = (value: unknown) => { const text = plainText(value); return text.length > 160 ? text.slice(0, 157).replace(/\s+\S*$/, '') + '…' : text; };
export const canonicalUrl = (pathname: string) => new URL(pathname === '/' ? '/' : pathname.replace(/\/+$/, ''), SITE_URL).href;
export const jsonLd = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const indexDescriptions: Record<string, string> = {
  '/': 'Explore The Cure’s releases, songs, concerts, setlists, venues, members and history in Cureation, an independent fan archive.',
  '/discography': 'Explore The Cure’s discography: studio albums, singles, EPs, compilations, release dates, artwork, tracks and credits.',
  '/songs': 'Browse songs by The Cure with album links, writing credits, lyrics, musical details and live performance history.',
  '/lyrics': 'Find lyrics to songs by The Cure and explore the records, songwriting credits and live performances behind them.',
  '/venues': 'Explore venues played by The Cure, with locations, capacities, concert dates and linked setlists.',
  '/setlists': 'Find The Cure concert setlists by date, year, venue, city, country and tour, and explore songs performed at each show.',
  '/setlists/compare': 'Compare two Cure concerts side by side: setlists, shared songs and differences between performances.',
  '/tours': 'Explore The Cure’s tours, dates, venues, countries and linked concert setlists throughout the band’s history.',
  '/tours/map': 'Explore The Cure’s touring history on a map and follow links to concerts, venues and tour archives.',
  '/band': 'Explore The Cure’s members, lineups and history, with biographies, instruments, membership periods and concert connections.',
  '/band/history': 'Follow The Cure’s history through a timeline of records, members, tours and milestones.',
  '/band/members': 'Browse current and former members of The Cure, their biographies, instruments and membership periods.',
  '/band/gear': 'Explore instruments and equipment associated with The Cure’s members, with archive notes and related records.',
  '/news': 'Read Cureation’s news archive: announcements, performances, releases and updates about The Cure.',
  '/publication': 'Read Cureation’s features, interviews, essays and criticism about The Cure, their music and their history.',
  '/reviews': 'Read album reviews of The Cure’s studio records, with criticism, scores, standout tracks and linked discography entries.',
  '/wiki': 'Explore Cureation’s researched reference articles about The Cure, with links to records, songs, people and concerts.',
  '/sources': 'Explore the sources behind Cureation’s archive, including references, authors, reliability notes and citation counts.',
  '/photos': 'Browse photographs of The Cure across the archive, with dates, locations, photographer credits and related records.',
  '/videos': 'Explore The Cure’s video archive, including promos, live performances and interviews.',
  '/stats': 'Explore statistics from Cureation’s archive of The Cure, including songs, concerts and live performance totals.',
  '/on-this-day': 'Discover releases, concerts and milestones from The Cure’s history that happened on this date.',
  '/about': 'Learn about Cureation, an independent, non-commercial fan archive documenting The Cure and the sources behind their history.',
  '/newsletter': 'Browse Cureation newsletter issues and archive updates about The Cure.',
  '/community': 'Explore community features and polls for fans of The Cure on Cureation.',
  '/my-archive': 'Keep your favourite Cureation records, songs, concerts and articles together in My Archive, stored in your browser.',
};

export function pageSeo(pathname: string, record: any, description?: string) {
  const url = canonicalUrl(pathname);
  const section = pathname.split('/')[1];
  const date = (value: unknown) => typeof value === 'string' && datePrecision(value) ? value : undefined;
  const band = { '@type': 'MusicGroup', name: 'The Cure', '@id': `${SITE_URL}/band#the-cure`, url: `${SITE_URL}/band` };
  let entity: Record<string, any> | undefined;
  let fallback = indexDescriptions[pathname] || 'Explore The Cure’s music and history in Cureation’s independent archive.';
  if (pathname === '/band' && !record) entity = { '@context': 'https://schema.org', ...band };
  if (record) {
    const name = plainText(record.title || record.name || record.venue);
    const text = plainText(record.seo_description || record.standfirst || record.excerpt || record.description || record.song_meaning || record.bio || record.notes);
    fallback = text || `${name}: explore ${section === 'songs' ? 'album connections, credits, lyrics and live performance history' : section === 'venues' ? 'location details and concerts by The Cure' : 'related records and archive details about The Cure'} on Cureation.`;
    if (section === 'discography') entity = { '@type': 'MusicAlbum', name, byArtist: band, datePublished: date(record.release_date), numTracks: record.track_count || undefined, description: summary(fallback) };
    if (section === 'songs') entity = { '@type': 'MusicRecording', name, byArtist: band, description: summary(fallback) };
    if (section === 'band') entity = { '@type': 'Person', name, description: summary(fallback), birthDate: date(record.birth_date), deathDate: date(record.death_date), memberOf: band };
    if (section === 'venues') entity = { '@type': 'Place', name, description: summary(fallback), address: { '@type': 'PostalAddress', addressLocality: record.city || undefined, addressRegion: record.state_province || undefined, addressCountry: record.country || undefined } };
    if (['wiki', 'publication'].includes(section)) entity = { '@type': section === 'publication' && record.category === 'news' ? 'NewsArticle' : 'Article', headline: name, description: summary(fallback), datePublished: date(record.published_date || record.date_created), dateModified: date(record.date_updated), author: record.author_name ? { '@type': 'Person', name: record.author_name } : undefined, mainEntityOfPage: url };
    if (section === 'setlists' && datePrecision(record.date) === 'day' && record.venue) entity = { '@type': 'MusicEvent', name: `The Cure at ${record.venue}${record.city ? `, ${record.city}` : ''}`, startDate: record.date.slice(0, 10), performer: band, location: { '@type': 'Place', name: record.venue, address: { '@type': 'PostalAddress', addressLocality: record.city || undefined, addressCountry: record.country || undefined } }, description: summary(fallback) };
    if (entity) { entity['@context'] = 'https://schema.org'; entity.url = url; entity['@id'] = `${url}#record`; }
  }
  return { canonical: url, description: summary(description || fallback), entity };
}
