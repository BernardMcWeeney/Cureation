import { defineMiddleware } from 'astro:middleware';
import { editingContext } from './lib/editing-context';
import { fetchRaw, DirectusRequestError } from './lib/directus';
import { applyPageCachePolicy, bypassSharedCache, isEditingPreview } from './lib/cache-policy';

export const onRequest = defineMiddleware(async (context, next) => {
  const preview = isEditingPreview(context.request, context.url);
  const bypassCache = bypassSharedCache(context.request, context.url);
  return editingContext.run({ preview, bypassCache, copy: {} }, async () => {
    // This collection contains public display copy only. Never elevate preview read permissions.
    try {
      const rows = await fetchRaw<{ id: string; text: string }>('site_copy', { limit: -1, fields: 'id,text' });
      editingContext.getStore()!.copy = Object.fromEntries(rows.map((row) => [row.id, row.text]));
    } catch (error) {
      console.warn('[site-copy] Using built-in copy; check site_copy collection/read permissions.');
    }
    let response: Response;
    try { response = await next(); }
    catch (error) {
      if (!(error instanceof DirectusRequestError)) throw error;
      response = archiveUnavailable();
    }
    const section = context.url.pathname.split('/')[1];
    const primary = ({ discography: 'discography', songs: 'songs', lyrics: 'songs', setlists: 'setlists', tours: 'tours', venues: 'venues', reviews: 'reviews', sources: 'sources', news: 'news', publication: 'news', wiki: 'news', photos: 'photos', videos: 'videos', newsletter: 'newsletter_issues', curiosities: 'did_you_know' } as Record<string, string>)[section] || (context.url.pathname.startsWith('/band/members') ? 'members' : undefined);
    if (primary && editingContext.getStore()?.dataFailures?.has(primary)) response = archiveUnavailable();
    const headers = new Headers(response.headers);
    const directives = (headers.get('Content-Security-Policy') || '').split(';')
      .map((value) => value.trim()).filter((value) => value && !/^frame-ancestors\b/i.test(value));
    directives.push("frame-ancestors 'self' https://dash.cureation.net");
    headers.set('Content-Security-Policy', directives.join('; '));
    headers.delete('X-Frame-Options');
    if (preview) {
      const location = headers.get('Location');
      if (location) {
        const destination = new URL(location, context.url);
        if (destination.origin === context.url.origin) {
          destination.searchParams.set('visual-editing', 'true');
          headers.set('Location', `${destination.pathname}${destination.search}${destination.hash}`);
        }
      }

    }
    applyPageCachePolicy(context.url, response, headers,
      bypassCache || editingContext.getStore()!.privateData === true);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  });
});

function archiveUnavailable() {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><title>Archive temporarily unavailable · Cureation</title></head><body><main><h1>The archive is temporarily unavailable</h1><p>We couldn't load this part of the archive. Please try again shortly.</p><p><a href="/">Return to Cureation</a> · <a href="/discography">Browse releases</a></p></main></body></html>`, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'Retry-After': '60' } });
}
