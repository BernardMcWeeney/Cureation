/** Only these existing, anonymous website routes may enter the HTML cache. */
const publicSections = new Set([
  'about', 'band', 'curiosities', 'discography', 'lyrics', 'news', 'newsletter',
  'on-this-day', 'photos', 'publication', 'reviews', 'setlists', 'songs', 'sources',
  'stats', 'tours', 'venues', 'videos', 'wiki',
]);
const sensitiveParameter = /^(?:.*token.*|authorization|api[_-]?key|secret|password|preview|draft|version)$/i;

export function hasSensitiveParameters(url: URL): boolean {
  return [...url.searchParams.keys()].some((key) => sensitiveParameter.test(key));
}

export function isEditingPreview(request: Request, url: URL): boolean {
  return url.searchParams.get('visual-editing') === 'true'
    || request.headers.get('sec-fetch-dest') === 'iframe';
}

export function bypassSharedCache(request: Request, url: URL): boolean {
  return isEditingPreview(request, url) || hasSensitiveParameters(url)
    || !['GET', 'HEAD'].includes(request.method)
    || request.headers.has('authorization') || request.headers.has('cookie');
}

export function applyPageCachePolicy(url: URL, response: Response, headers: Headers, bypass: boolean) {
  // Never rely on Workers Cache's default TTL for unspecified responses.
  const section = url.pathname.split('/').filter(Boolean)[0];
  const publicRoute = url.pathname === '/' || publicSections.has(section);
  const privateResponse = /(?:private|no-store|no-cache)/i.test(response.headers.get('Cache-Control') || '');
  const cacheable = !bypass && publicRoute && response.status === 200
    && response.headers.get('Content-Type')?.includes('text/html')
    && !headers.has('Set-Cookie') && !privateResponse
    && headers.get('Vary')?.trim() !== '*';
  headers.set('Cache-Control', cacheable ? 'public, max-age=0, must-revalidate' : 'private, no-store');
  headers.set('Cloudflare-CDN-Cache-Control', cacheable ? 'public, max-age=600' : 'no-store');
  headers.set('CDN-Cache-Control', cacheable ? 'public, max-age=600' : 'no-store');
  // These inputs affect bypass decisions before the middleware can execute on a hit.
  const vary = new Set((headers.get('Vary') || '').split(',').map((value) => value.trim()).filter(Boolean));
  for (const name of ['Cookie', 'Authorization', 'Sec-Fetch-Dest']) vary.add(name);
  headers.set('Vary', [...vary].join(', '));
}

/** Explicitly public Directus collections, still subject to Directus public permissions. */
export const publicCollections = new Set([
  'discography', 'songs', 'singles', 'eras', 'news', 'reviews', 'quotes',
  'on_this_day_cache', 'did_you_know', 'chart_positions', 'setlist_songs',
  'setlists', 'venues', 'tours', 'members', 'member_stints', 'photos', 'gear',
  'timeline', 'lyric_annotations', 'newsletter_issues', 'polls', 'poll_options',
  'cover_variants', 'sources', 'site_copy', 'videos',
]);
