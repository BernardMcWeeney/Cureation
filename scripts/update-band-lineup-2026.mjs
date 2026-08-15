/**
 * Bring the member register and band timeline up to date for the 2026 live
 * lineup. The script is idempotent: existing members, stints and timeline
 * entries are patched rather than duplicated.
 *
 * Usage:
 *   DIRECTUS_TOKEN=... node scripts/update-band-lineup-2026.mjs
 */

import https from 'node:https';

const DIRECTUS_URL = (process.env.DIRECTUS_URL || 'https://dash.cureation.net').replace(/\/$/, '');
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;
let readSequence = 0;

if (!DIRECTUS_TOKEN) throw new Error('DIRECTUS_TOKEN is required');

async function api(path, init = {}) {
  const url = new URL(path, DIRECTUS_URL);
  const response = await new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: init.method || 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        'Cache-Control': 'no-cache, no-store',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    }, (incoming) => {
      let body = '';
      incoming.setEncoding('utf8');
      incoming.on('data', (chunk) => { body += chunk; });
      incoming.on('end', () => resolve({
        ok: incoming.statusCode >= 200 && incoming.statusCode < 300,
        status: incoming.statusCode,
        statusText: incoming.statusMessage,
        text: body,
      }));
    });
    request.on('error', reject);
    if (init.body) request.write(init.body);
    request.end();
  });

  const json = response.text ? JSON.parse(response.text) : null;
  if (!response.ok) {
    const detail = json?.errors?.map((error) => error.message).join('; ') || response.text || response.statusText;
    const error = new Error(`${init.method || 'GET'} ${path} failed (${response.status}): ${detail}`);
    error.status = response.status;
    throw error;
  }
  return json?.data ?? null;
}

function freshItemListPath(collection, fields) {
  // The dashboard sits behind an edge cache. A changing, valid upper-bound
  // filter prevents a just-created row being hidden by an earlier empty list.
  const idCeiling = 2_000_000_000 - (Date.now() % 1_000_000) - (++readSequence);
  const params = new URLSearchParams({
    limit: '-1',
    fields,
    'filter[id][_lt]': String(idCeiling),
  });
  return `/items/${collection}?${params}`;
}

async function exists(path) {
  try {
    await api(path);
    return true;
  } catch (error) {
    if (error.status === 403 || error.status === 404) return false;
    throw error;
  }
}

async function ensureMembershipType() {
  if (await exists('/fields/members/membership_type')) return;
  await api('/fields/members', {
    method: 'POST',
    body: JSON.stringify({
      field: 'membership_type',
      type: 'string',
      schema: { is_nullable: false, default_value: 'member', max_length: 32 },
      meta: {
        interface: 'select-dropdown',
        width: 'half',
        note: 'Distinguishes official members from active touring additions and guest substitutes.',
        options: {
          choices: [
            { text: 'Official member', value: 'member', color: '#D8B45C' },
            { text: 'Touring addition', value: 'touring', color: '#7C9AC8' },
            { text: 'Guest / substitute', value: 'guest', color: '#A2B5CD' },
          ],
        },
      },
    }),
  });
}

async function upsertMember(payload) {
  // This service account's Directus policy does not consistently apply `_eq`
  // filters, so index the small collection locally to keep reruns idempotent.
  const existing = await api(freshItemListPath('members', 'id,slug'));
  const current = existing.find((member) => member.slug === payload.slug);
  if (current) {
    await api(`/items/members/${current.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return current.id;
  }
  const created = await api('/items/members', { method: 'POST', body: JSON.stringify(payload) });
  return created.id;
}

async function upsertStint(member, payload) {
  const existing = await api(freshItemListPath('member_stints', 'id,member,stint_number'));
  const current = existing.find((stint) => Number(stint.member) === member && Number(stint.stint_number) === payload.stint_number);
  const body = JSON.stringify({ member, ...payload });
  if (current) {
    await api(`/items/member_stints/${current.id}`, { method: 'PATCH', body });
  } else {
    await api('/items/member_stints', { method: 'POST', body });
  }
}

async function upsertTimeline(payload) {
  const existing = await api(freshItemListPath('timeline', 'id,title'));
  const current = existing.find((entry) => entry.title === payload.title);
  if (current) {
    await api(`/items/timeline/${current.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  } else {
    await api('/items/timeline', { method: 'POST', body: JSON.stringify(payload) });
  }
}

function normalizePerformers(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function mergeShowLineup(show, expectedDate, performers) {
  const current = await api(`/items/setlists/${show}?fields=id,date,performing_musicians`);
  if (!current || current.id !== show || current.date !== expectedDate) {
    throw new Error(`Setlist validation failed for ${show} (${expectedDate})`);
  }
  const merged = normalizePerformers(current.performing_musicians);
  for (const performer of performers) {
    const existingIndex = merged.findIndex((item) =>
      Number(item?.member_id) === performer.member_id ||
      String(item?.name || '').trim().toLowerCase() === performer.name.toLowerCase()
    );
    if (existingIndex >= 0) merged[existingIndex] = { ...merged[existingIndex], ...performer };
    else merged.push(performer);
  }
  await api(`/items/setlists/${show}`, {
    method: 'PATCH',
    body: JSON.stringify({ performing_musicians: merged }),
  });
}

await ensureMembershipType();

const edenId = await upsertMember({
  name: 'Eden Gallup',
  slug: 'eden-gallup',
  bio: 'Multi-instrumentalist and long-serving member of The Cure’s road crew. After twice substituting for Simon Gallup on bass in 2019, Eden joined the 2026 touring lineup on additional guitar and keyboards. When Simon became ill before the Berlin Wuhlheide concerts in July 2026, Eden moved across to bass; Simon later returned, with Eden continuing in the six-player live lineup.',
  instruments: ['Guitar', 'Keyboards', 'Bass Guitar'],
  tenure_start: '2026',
  tenure_end: null,
  tenure: '2026–present',
  is_current_member: true,
  membership_type: 'touring',
  aliases: [],
  side_projects: [],
  source: 7,
  source_url: 'https://www.nme.com/news/music/the-cure-announce-simon-gallups-son-eden-filling-in-for-him-on-tour-as-hes-not-well-enough-to-play-3956446',
});

await upsertStint(edenId, {
  start_year: 2026,
  end_year: null,
  role: 'Guitar, Keyboards, substitute Bass',
  stint_number: 1,
  notes: 'Joined the Festival Summer 2026 live lineup; moved to bass for the Berlin Wuhlheide shows when Simon Gallup became ill.',
});

const mikeId = await upsertMember({
  name: 'Mike Lord',
  slug: 'mike-lord',
  bio: 'Keyboard technician and guest touring musician who performed with The Cure throughout the eight-show Latin American leg of the Shows of a Lost World tour in November and December 2023, temporarily filling in for Roger O’Donnell.',
  instruments: ['Keyboards'],
  tenure_start: '2023',
  tenure_end: '2023',
  tenure: '2023',
  is_current_member: false,
  membership_type: 'guest',
  aliases: [],
  side_projects: [],
  source: 4,
  source_url: 'https://www.thecure.com/bio/',
});

await upsertStint(mikeId, {
  start_year: 2023,
  end_year: 2023,
  role: 'Keyboards (touring substitute)',
  stint_number: 1,
  notes: 'Filled in for Roger O’Donnell for all eight Latin American Shows of a Lost World concerts in November and December 2023.',
});

const gabrielId = await upsertMember({
  name: 'Gabriel Cooper',
  slug: 'gabriel-cooper',
  bio: 'Saxophonist and the son of Cure drummer Jason Cooper. At 17, Gabriel joined The Cure as a guest during all three Festival de Nîmes concerts in July 2026, playing the saxophone part on “A Night Like This”.',
  instruments: ['Saxophone'],
  tenure_start: '2026',
  tenure_end: '2026',
  tenure: '2026',
  is_current_member: false,
  membership_type: 'guest',
  aliases: [],
  side_projects: [],
  source: 15,
  source_url: 'https://mail.cure-concerts.de/concerts/2026-07-24.php',
});

await upsertStint(gabrielId, {
  start_year: 2026,
  end_year: 2026,
  role: 'Saxophone (guest)',
  stint_number: 1,
  notes: 'Guest saxophone on “A Night Like This” at the three Festival de Nîmes concerts, July 24–26, 2026.',
});

const core2026 = [
  { name: 'Robert Smith', member_id: 1 },
  { name: 'Simon Gallup', member_id: 2 },
  { name: 'Jason Cooper', member_id: 4 },
  { name: 'Roger O’Donnell', member_id: 3 },
  { name: 'Reeves Gabrels', member_id: 5 },
  { name: 'Eden Gallup', member_id: edenId, role: 'touring musician', instruments: ['guitar', 'keyboards'] },
];
const nimesShows = [
  [2427, '2026-07-24'],
  [2428, '2026-07-25'],
  [2429, '2026-07-26'],
];
for (const [show, date] of nimesShows) {
  await mergeShowLineup(show, date, [
    ...core2026,
    {
      name: 'Gabriel Cooper', member_id: gabrielId, role: 'guest musician',
      instruments: ['saxophone'], songs: ['A Night Like This'],
      source: 'Cure Concerts',
      source_url: `https://mail.cure-concerts.de/concerts/${date}.php`,
      confidence: 'high',
    },
  ]);
}

const core2023WithoutRoger = [
  { name: 'Robert Smith', member_id: 1 },
  { name: 'Simon Gallup', member_id: 2 },
  { name: 'Jason Cooper', member_id: 4 },
  { name: 'Reeves Gabrels', member_id: 5 },
  { name: 'Perry Bamonte', member_id: 22 },
  { name: 'Mike Lord', member_id: mikeId, role: 'touring substitute', instruments: ['keyboards'] },
];
const latinAmericaShows = [
  [759, '2023-11-19'], [758, '2023-11-22'], [757, '2023-11-25'], [756, '2023-11-27'],
  [755, '2023-11-30'], [754, '2023-12-03'], [753, '2023-12-07'], [752, '2023-12-10'],
];
for (const [show, date] of latinAmericaShows) {
  await mergeShowLineup(show, date, core2023WithoutRoger);
}

const timelineEntries = [
  {
    title: 'Perry Bamonte dies, aged 65',
    description: 'The Cure confirm the death of their friend and bandmate Perry Bamonte after a short illness. His final appearance was the Songs of a Lost World launch concert at Troxy in November 2024.',
    date: '2025-12-24', formatted_date: 'December 24, 2025', year: 2025,
    type: 'lineup', importance: 10, related_member: 'perry-bamonte', related_member_id: 22,
    source: 4, source_url: 'https://www.thecure.com/news/2025/12/perry-archangelo-bamonte-1960-2025/',
  },
  {
    title: 'Eden Gallup joins the 2026 live lineup',
    description: 'The Festival Summer opens at Primavera Sound with Eden Gallup expanding The Cure to six players on additional guitar and keyboards.',
    date: '2026-06-05', formatted_date: 'June 5, 2026', year: 2026,
    type: 'lineup', importance: 8, related_member: 'eden-gallup', related_member_id: edenId,
    source: 15, source_url: 'https://www.cure-concerts.de/main/cure_members.php',
  },
  {
    title: 'Robert Smith guests with Olivia Rodrigo at Primavera',
    description: 'During Olivia Rodrigo’s surprise Primavera Sound set, Robert Smith joins her to debut their collaboration “What’s Wrong With Me” live.',
    date: '2026-06-06', formatted_date: 'June 6, 2026', year: 2026,
    type: 'collaboration', importance: 7,
    source: 30, source_url: 'https://www.setlist.fm/news/06-26/olivia-rodrigo-live-debuts-duet-with-robert-smith-6bd6a232',
  },
  {
    title: 'Eden Gallup covers bass in Berlin',
    description: 'After Simon Gallup is taken ill shortly before the first Wuhlheide concert, Eden shifts from guitar and keyboards to bass to keep the three-night Berlin run onstage.',
    date: '2026-07-10', formatted_date: 'July 10, 2026', year: 2026,
    type: 'lineup', importance: 8, related_member: 'eden-gallup', related_member_id: edenId,
    source: 7, source_url: 'https://www.nme.com/news/music/the-cure-announce-simon-gallups-son-eden-filling-in-for-him-on-tour-as-hes-not-well-enough-to-play-3956446',
  },
  {
    title: 'Simon Gallup returns to the live lineup',
    description: 'Simon returns after his brief illness with Eden remaining among the touring ranks, restoring The Cure’s six-player 2026 stage lineup.',
    date: '2026-07-19', formatted_date: 'July 19, 2026', year: 2026,
    type: 'lineup', importance: 8, related_member: 'simon-gallup', related_member_id: 2,
    source: 7, source_url: 'https://www.nme.com/news/music/the-cure-and-dogstar-close-out-a-weekend-of-magic-and-mayhem-at-electric-castle-2026-3957905',
  },
  {
    title: 'Gabriel Cooper guests on saxophone in Nîmes',
    description: 'Jason Cooper’s 17-year-old son Gabriel joins The Cure for “A Night Like This”, playing saxophone at all three Festival de Nîmes concerts.',
    date: '2026-07-24', formatted_date: 'July 24, 2026', year: 2026,
    type: 'guest appearance', importance: 6, related_member: 'gabriel-cooper', related_member_id: gabrielId,
    source: 15, source_url: 'https://mail.cure-concerts.de/concerts/2026-07-24.php',
  },
];

for (const entry of timelineEntries) await upsertTimeline(entry);

const allMembers = await api(freshItemListPath('members', 'id,name,slug,is_current_member,membership_type,stints.start_year,stints.end_year,stints.role'));
const verification = allMembers.filter((member) => ['eden-gallup', 'mike-lord', 'gabriel-cooper'].includes(member.slug));
console.log(JSON.stringify({ updated: verification, timeline_entries: timelineEntries.length }, null, 2));
