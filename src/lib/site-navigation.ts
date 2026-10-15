/** Shared labels and links for desktop, tablet and mobile navigation. */
export const navigationSections = [
  { id: 'music', label: 'Music', match: ['/discography', '/songs', '/lyrics'], columns: [
    { title: 'Music', links: [
      { href: '/discography', label: 'Discography' },
      { href: '/discography?type=studio', label: 'Albums' },
      { href: '/songs', label: 'Songs' },
      { href: '/discography?type=single', label: 'Singles' },
      { href: '/discography?type=compilation', label: 'Compilations' },
    ] },
    { title: 'More music', links: [
      { href: '/lyrics', label: 'Lyrics' },
      { href: '/discography?type=ep', label: 'EPs' },
    ] },
  ] },
  { id: 'live', label: 'Live', match: ['/tours', '/setlists', '/venues', '/on-this-day'], columns: [
    { title: 'Tours', links: [
      { href: '/tours', label: 'Tours' },
      { href: '/tours/2026-european-summer-shows', label: '2026 Summer Shows' },
      { href: '/tours/map', label: 'Tour map' },
      { href: '/calendar.ics', label: 'Tour calendar' },
    ] },
    { title: 'Shows', links: [
      { href: '/setlists', label: 'Setlists' },
      { href: '/venues', label: 'Venues' },
      { href: '/setlists/compare', label: 'Compare shows' },
      { href: '/on-this-day', label: 'On this day' },
    ] },
  ] },
  { id: 'read', label: 'Read', match: ['/publication', '/news', '/reviews', '/wiki', '/newsletter', '/band', '/photos', '/videos', '/stats', '/curiosities', '/community', '/sources', '/about', '/my-archive'], columns: [
    { title: 'Read', links: [
      { href: '/news', label: 'News' },
      { href: '/reviews', label: 'Reviews' },
      { href: '/wiki', label: 'Wiki' },
      { href: '/publication', label: 'Articles' },
      { href: '/newsletter', label: 'Newsletter' },
    ] },
    { title: 'The band', links: [
      { href: '/band', label: 'The band' },
      { href: '/band/members', label: 'Members' },
      { href: '/band/history', label: 'History' },
      { href: '/band/gear', label: 'Equipment' },
      { href: '/curiosities', label: 'Trivia' },
    ] },
    { title: 'More', links: [
      { href: '/photos', label: 'Photos' },
      { href: '/videos', label: 'Videos' },
      { href: '/stats', label: 'Statistics' },
      { href: '/my-archive', label: 'Saved items' },
      { href: '/community', label: 'Community' },
      { href: '/sources', label: 'Sources' },
      { href: '/about', label: 'About' },
    ] },
  ] },
];

export function isNavigationLinkCurrent(href: string, pathname: string, search: string): boolean {
  const link = new URL(href, 'https://cureation.com');
  if (link.pathname !== pathname) return false;
  const current = new URLSearchParams(search);
  if (pathname === '/discography') return (link.searchParams.get('type') || 'all') === (current.get('type') || 'all');
  return true;
}
