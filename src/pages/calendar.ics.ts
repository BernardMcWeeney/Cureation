import type { APIContext } from 'astro';
import { listSetlists } from '../lib/directus';

export const prerender = false;

const pad = (n: number) => String(n).padStart(2, '0');
const fmtDate = (d: string): string => {
  const dt = new Date(d);
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`;
};
const stamp = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
};
const esc = (s: string) => (s || '').replace(/[,;\\]/g, (m) => '\\' + m).replace(/\n/g, '\\n');

export async function GET(context: APIContext) {
  const all = await listSetlists({ limit: 500 }).catch(() => []);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = all.filter((s) => s.date && s.date >= today).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const site = (context.site?.toString() || 'https://cureation.net').replace(/\/$/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cureation//Tour dates//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:The Cure — tour dates (Cureation)',
    'X-WR-CALDESC:Upcoming Cure shows as tracked by Cureation.',
  ];
  for (const s of upcoming) {
    const d = fmtDate(s.date!);
    const end = fmtDate(new Date(new Date(s.date!).getTime() + 86400000).toISOString());
    const summary = `The Cure — ${s.venue || s.city || 'Show'}`;
    const loc = [s.venue, s.city, s.state_province, s.country].filter(Boolean).join(', ');
    lines.push(
      'BEGIN:VEVENT',
      `UID:cureation-setlist-${s.id}@cureation.net`,
      `DTSTAMP:${stamp()}`,
      `DTSTART;VALUE=DATE:${d}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${esc(summary)}`,
      `LOCATION:${esc(loc)}`,
      `URL:${site}/setlists/${s.slug}`,
      `DESCRIPTION:${esc(s.tour_name ? `${s.tour_name} · ` : '')}${esc(loc)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');

  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="cureation-tour-dates.ics"',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
