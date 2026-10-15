import fs from 'node:fs/promises';
import path from 'node:path';
const base = new URL(process.env.AUDIT_BASE_URL || 'https://cureation.com');
const output = process.env.AUDIT_OUTPUT || 'reports/latest/crawl.json';
const limit = Number(process.env.AUDIT_LIMIT || 120);
const seeds = ['/', '/about', '/discography', '/songs', '/lyrics', '/setlists', '/setlists/compare', '/tours', '/tours/2026-european-summer-shows', '/venues', '/band', '/band/history', '/band/members', '/band/gear', '/publication', '/news', '/reviews', '/reviews/faith', '/wiki', '/sources', '/photos', '/videos', '/newsletter', '/stats', '/on-this-day', '/community', '/my-archive'];
const decode = (value) => value.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"');
const attr = (html, tag, name, value, target) => {
  const tags = html.match(new RegExp(`<${tag}\\b[^>]*>`, 'gi')) || [];
  const found = tags.find((t) => new RegExp(`${name}=["']${value}["']`, 'i').test(t));
  return found?.match(new RegExp(`${target}=["']([^"']*)["']`, 'i'))?.[1] || null;
};
async function get(url) {
  const start = performance.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(25000), redirect: 'follow' });
    return { response, html: await response.text(), ms: Math.round(performance.now() - start) };
  } catch (error) { return { error: error.message, ms: Math.round(performance.now() - start) }; }
}
const sitemap = await get(new URL('/sitemap.xml', base));
const sitemapUrls = [...(sitemap.html || '').matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => decode(m[1]));
const queue = [...seeds];
if (process.env.AUDIT_FULL === '1') queue.push(...sitemapUrls.map((loc) => new URL(loc).pathname));
const seen = new Set();
const pages = [];
const edges = [];
const sectionSamples = new Map();
for (const loc of sitemapUrls) {
  const url = new URL(loc);
  const section = url.pathname.split('/')[1];
  if ((sectionSamples.get(section) || 0) < 2) { queue.push(url.pathname); sectionSamples.set(section, (sectionSamples.get(section) || 0) + 1); }
}
while (queue.length && seen.size < limit) {
  const routes = [];
  while (queue.length && routes.length < 2) { const route = queue.shift(); if (!seen.has(route)) { seen.add(route); routes.push(route); } }
  await Promise.all(routes.map(async (route) => {
    const result = await get(new URL(route, base));
    if (result.error) { pages.push({ route, ...result }); return; }
    const { response, html, ms } = result;
    const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].map((m) => decode(m[1]));
    const internal = [];
    for (const href of links) {
      if (/^(mailto:|tel:|javascript:)/i.test(href)) continue;
      let url; try { url = new URL(href, response.url); } catch { continue; }
      if (url.origin !== base.origin && url.hostname !== 'cureation.com' && url.hostname !== 'www.cureation.com') continue;
      if (!/^https?:$/.test(url.protocol)) continue;
      edges.push({ from: route, to: url.pathname + url.search, fragment: url.hash });
      if (url.pathname.startsWith('/api/') || /\.(ics|xml|json|png|jpg|avif|webp|pdf)$/.test(url.pathname)) continue;
      internal.push(url.pathname);
    }
    // All linked wiki pages are checked; other long archives are sampled by the crawl limit.
    if (route === '/wiki') queue.unshift(...internal.filter((p) => p.startsWith('/wiki/')));
    else queue.push(...internal);
    const schemas = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => { try { return JSON.parse(m[1]); } catch { return { error: 'Invalid JSON-LD' }; } });
    pages.push({ route, status: response.status, finalUrl: response.url, ms, bytes: Buffer.byteLength(html), title: decode(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || ''), description: attr(html, 'meta', 'name', 'description', 'content'), canonical: attr(html, 'link', 'rel', 'canonical', 'href'), h1: (html.match(/<h1\b/gi) || []).length, noindex: /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html), schemas, internalLinks: internal.length });
  }));
}
const result = { base: base.href, time: new Date().toISOString(), scope: `Bounded crawl: ${pages.length} pages, ${limit} maximum; not an exhaustive crawl of every concert`, sitemap: { status: sitemap.response?.status, urls: sitemapUrls.length, uniqueUrls: new Set(sitemapUrls).size, urlsByOrigin: [...new Set(sitemapUrls.map((loc) => new URL(loc).origin))] }, pages, edges, uncheckedTargets: [...new Set(edges.map((e) => e.to.split('?')[0]))].filter((route) => !seen.has(route)), failures: pages.filter((p) => p.error || p.status >= 400), metadataIssues: pages.filter((p) => p.status === 200 && (!p.title || !p.description || !p.canonical || p.h1 !== 1)) };
await fs.mkdir(path.dirname(output), { recursive: true });
console.log(JSON.stringify({ output, pages: pages.length, failures: result.failures, metadataIssues: result.metadataIssues.map((p) => p.route), sitemap: result.sitemap }));
result.seoIssues = pages.filter((p) => p.status === 200 && (
  p.canonical !== new URL(new URL(p.finalUrl).pathname.replace(/\/+$/, '') || '/', 'https://cureation.com').href
  || p.schemas?.some((schema) => schema.error)
));
await fs.writeFile(output, JSON.stringify(result, null, 2) + '\n');
if (process.argv.includes('--strict') && (sitemap.response?.status !== 200 || !sitemapUrls.length || sitemapUrls.length !== new Set(sitemapUrls).size || result.failures.length || result.metadataIssues.length || result.seoIssues.length)) process.exitCode = 1;
