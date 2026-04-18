import type { APIRoute } from 'astro';
import { searchAll } from '../../lib/directus';

export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get('q')?.trim() || '';
  if (!q || q.length < 2) {
    return new Response(
      JSON.stringify({ albums: [], songs: [], setlists: [], venues: [] }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
  try {
    const data = await searchAll(q);
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30',
      },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message, albums: [], songs: [], setlists: [], venues: [] }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
