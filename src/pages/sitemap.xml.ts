import type { APIRoute } from 'astro';
import { sitemapEntries, sitemapXml } from '../lib/sitemap';
export const prerender = false;
export const GET: APIRoute = async () => new Response(sitemapXml(await sitemapEntries()), {
  headers: { 'Content-Type': 'application/xml; charset=utf-8' },
});
