import type { APIContext } from 'astro';
import { listSetlists, listTours } from '../lib/directus';

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
  const tours = await listTours().catch(() => []);
  const latestTour = tours.find((tour) => tour.id && tour.start_date) || tours[0] || null;
  const shows = latestTour
    ? await listSetlists({ tour: latestTour.id, limit: 500 }).catch(() => [])
    : await listSetlists({ limit: 500 }).catch(() => []);
  const tourDates = shows.filter((s) => s.date).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const calendarName = latestTour?.name
    ? `The Cure: ${latestTour.name} (Cureation)`
    : 'The Cure: tour dates (Cureation)';

  const site = (context.site?.toString() || 'https://cureation.net').replace(/\/$/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cureation//Tour dates//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(calendarName)}`,
    `X-WR-CALDESC:${esc(latestTour?.name ? `Latest tour dates for ${latestTour.name}, as tracked by Cureation.` : 'Latest Cure tour dates as tracked by Cureation.')}`,
    'X-PUBLISHED-TTL:PT1H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  ];
  for (const s of tourDates) {
    const d = fmtDate(s.date!);
    const end = fmtDate(new Date(new Date(s.date!).getTime() + 86400000).toISOString());
    const summary = `The Cure: ${s.venue || s.city || 'Show'}`;
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
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
