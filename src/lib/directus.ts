/**
 * Cureation — typed Directus client.
 * Small, focused helpers per entity; field projection at call site.
 * Runtime cache via Cloudflare's `caches.default` when available.
 */

export const DIRECTUS_URL =
  (import.meta.env.PUBLIC_DIRECTUS_URL as string | undefined) ||
  'https://dash.cureation.net';

const TOKEN =
  (import.meta.env.DIRECTUS_TOKEN as string | undefined) ||
  (import.meta.env.PUBLIC_DIRECTUS_TOKEN as string | undefined) ||
  '6hBeZWg0nCly0dxueAwX1ysQf-JYsEhe';

type Params = Record<string, string | number | boolean | undefined>;

function qs(p: Params): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null) continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

async function directusFetch<T = any>(
  path: string,
  params: Params = {},
  { ttl = 60 }: { ttl?: number } = {}
): Promise<T> {
  const url = `${DIRECTUS_URL}${path}${qs(params)}`;
  const req = new Request(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/json',
    },
  });

  // Cloudflare edge cache
  const cache = (globalThis as any).caches?.default;
  if (cache) {
    const cached = await cache.match(req);
    if (cached) {
      const json = (await cached.json()) as { data: T };
      return json.data;
    }
  }

  const res = await fetch(req);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Directus ${path} ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { data: T };

  if (cache && ttl > 0) {
    const response = new Response(JSON.stringify(json), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${ttl}`,
      },
    });
    await cache.put(req, response);
  }

  return json.data;
}

/* =======================================================================
   Types
   ======================================================================= */

export type AlbumType =
  | 'studio'
  | 'live'
  | 'compilation'
  | 'deluxe'
  | 'boxset'
  | 'ep'
  | 'single'
  | 'reissue'
  | 'soundtrack'
  | 'remix';

export interface Era {
  id: string;
  slug: string;
  name: string;
  short_name?: string | null;
  description?: string | null;
  year_start?: number | null;
  year_end?: number | null;
  hue?: number | null;
  sort?: number | null;
}

export interface Album {
  id: number;
  title: string;
  slug: string | null;
  type: AlbumType;
  release_date: string | null;
  cover_art: string | null;
  label: string | null;
  producer: string | null;
  description: string | null;
  background_text: string | null;
  critical_reception: string | null;
  credits: string | null;
  featured: boolean;
  is_featured_issue: boolean;
  parent_album: number | null;
  disc_count: number | null;
  track_count: number | null;
  catalog_number: string | null;
  genre_tags: string[] | null;
  spotify_url: string | null;
  apple_music_url: string | null;
  bandcamp_url: string | null;
  amazon_url: string | null;
  official_store_url: string | null;
  era_id: string | null;
  era?: Era | null;
  songs?: Song[];
  singles?: Single[];
}

export interface Song {
  id: number;
  title: string;
  slug: string | null;
  album: number | null;
  track_number: number | null;
  duration: string | null;
  credits: string | null;
  writer: string | null;
  composer: string | null;
  lyrics: string | null;
  lyrics_structured: any;
  song_meaning: string | null;
  bpm: number | null;
  musical_key: string | null;
  guitar_tuning: string | null;
  is_single: boolean | null;
  music_video_url: string | null;
  first_played_live: string | null;
  last_played_live: string | null;
  times_played_live: number | null;
  /** Computed: setlist slug for the song's first live play. Populated by enrichSongsWithLivePlays. */
  first_played_setlist_slug?: string | null;
  /** Computed: setlist slug for the song's most recent live play. Populated by enrichSongsWithLivePlays. */
  last_played_setlist_slug?: string | null;
  listen_link: string | null;
  listen_links: any;
}

export interface Single {
  id: number;
  title: string;
  release_date: string | null;
  chart_position: any;
  album: number | null;
}

/* =======================================================================
   Helpers
   ======================================================================= */

const ALBUM_FIELDS = [
  'id', 'title', 'slug', 'type', 'release_date', 'cover_art',
  'label', 'producer', 'description', 'background_text', 'critical_reception',
  'credits', 'featured', 'is_featured_issue', 'parent_album',
  'disc_count', 'track_count', 'catalog_number', 'genre_tags',
  'spotify_url', 'apple_music_url', 'bandcamp_url', 'amazon_url', 'official_store_url',
  'era_id',
].join(',');

const SONG_FIELDS = [
  'id', 'title', 'slug', 'album', 'track_number', 'duration', 'credits',
  'writer', 'composer', 'lyrics', 'lyrics_structured', 'song_meaning',
  'bpm', 'musical_key', 'guitar_tuning', 'is_single', 'music_video_url',
  'first_played_live', 'last_played_live', 'times_played_live',
  'listen_link', 'listen_links',
].join(',');

/** List all albums (any type). */
export async function listAlbums(
  opts: { type?: AlbumType | AlbumType[]; limit?: number } = {}
): Promise<Album[]> {
  const params: Params = {
    limit: opts.limit ?? -1,
    fields: ALBUM_FIELDS,
    sort: '-release_date',
  };
  if (opts.type) {
    const t = Array.isArray(opts.type) ? opts.type.join(',') : opts.type;
    params['filter[type][_in]'] = t;
  }
  return await directusFetch<Album[]>('/items/discography', params);
}

/** List all eras, sorted. */
export async function listEras(): Promise<Era[]> {
  return await directusFetch<Era[]>('/items/eras', {
    limit: -1,
    fields: 'id,slug,name,short_name,description,year_start,year_end,hue,sort',
    sort: 'sort',
  });
}

/** Single album by slug, deep-fetches songs + singles + era. */
export async function getAlbumBySlug(slug: string): Promise<Album | null> {
  const data = await directusFetch<Album[]>('/items/discography', {
    limit: 1,
    'filter[slug][_eq]': slug,
    fields: ALBUM_FIELDS,
  });
  if (data?.[0]) return enrichAlbum(data[0]);
  return null;
}

async function enrichAlbum(album: Album): Promise<Album> {
  const [songs, singles, era] = await Promise.all([
    directusFetch<Song[]>('/items/songs', {
      'filter[album][_eq]': album.id,
      fields: SONG_FIELDS,
      sort: 'track_number',
      limit: -1,
    }).then(enrichSongsWithLivePlays),
    directusFetch<Single[]>('/items/singles', {
      'filter[album][_eq]': album.id,
      fields: 'id,title,release_date,chart_position,album',
      sort: 'release_date',
      limit: -1,
    }).catch(() => []),
    album.era_id
      ? directusFetch<Era[]>('/items/eras', {
          'filter[id][_eq]': album.era_id,
          fields: 'id,slug,name,short_name,year_start,year_end',
          limit: 1,
        }).then((r) => r?.[0] || null)
      : Promise.resolve(null),
  ]);
  return { ...album, songs, singles, era };
}

/** Featured issue album for home cover. Falls back to newest. */
export async function getFeaturedIssue(): Promise<Album | null> {
  const featured = await directusFetch<Album[]>('/items/discography', {
    limit: 1,
    'filter[is_featured_issue][_eq]': true,
    fields: ALBUM_FIELDS,
  });
  if (featured?.[0]) return featured[0];
  const newest = await directusFetch<Album[]>('/items/discography', {
    limit: 1,
    'filter[type][_eq]': 'studio',
    sort: '-release_date',
    fields: ALBUM_FIELDS,
  });
  return newest?.[0] || null;
}

/** Top N songs by live-play count. Stats are computed from setlist_songs. */
export async function topLivePlayedSongs(limit = 10): Promise<Song[]> {
  const songs = await directusFetch<Song[]>('/items/songs', {
    limit: -1,
    'filter[slug][_nnull]': true,
    fields: 'id,title,slug,album',
  });
  await enrichSongsWithLivePlays(songs);
  return songs
    .filter((s) => (s.times_played_live || 0) > 0)
    .sort((a, b) => (b.times_played_live || 0) - (a.times_played_live || 0))
    .slice(0, limit);
}

/** Raw counts for stat-hero. */
export async function getRunningFigures(): Promise<{
  albums: number;
  songs: number;
  setlists: number;
  venues: number;
  photos: number;
  members: number;
}> {
  async function count(coll: string, filter?: Params): Promise<number> {
    try {
      const data = await directusFetch<Array<{ count: { id: number } }>>(
        `/items/${coll}`,
        {
          'aggregate[count]': 'id',
          ...(filter || {}),
        }
      );
      return Number(data?.[0]?.count?.id) || 0;
    } catch {
      return 0;
    }
  }
  const [albums, songs, setlists, venues, photos, members] = await Promise.all([
    count('discography', { 'filter[type][_eq]': 'studio' }),
    count('songs', { 'filter[slug][_nnull]': true }),
    count('setlists'),
    count('venues'),
    count('photos'),
    count('members'),
  ]);
  return { albums, songs, setlists, venues, photos, members };
}

/** Latest N news entries. */
export async function listNews(limit = 3): Promise<any[]> {
  try {
    return await directusFetch<any[]>('/items/news', {
      limit,
      sort: '-published_date',
      fields:
        'id,title,slug,excerpt,published_date,category,reading_time,is_editorial,featured_image_file,featured_image',
    });
  } catch {
    return [];
  }
}

/** Latest N editorial pieces. */
export async function listEditorial(limit = 1): Promise<any[]> {
  try {
    return await directusFetch<any[]>('/items/news', {
      limit,
      'filter[is_editorial][_eq]': true,
      sort: '-published_date',
      fields: 'id,title,slug,excerpt,content,published_date,reading_time,author_name,category,tags',
    });
  } catch {
    return [];
  }
}

/** Editorial quotes / epigraphs. */
export async function listQuotes(limit = 4): Promise<any[]> {
  try {
    return await directusFetch<any[]>('/items/quotes', {
      limit,
      sort: 'id',
      fields: 'id,text,attribution,source,date,url,is_placeholder',
    });
  } catch {
    return [];
  }
}

/** Today's entries from the on-this-day cache. */
export async function getOnThisDay(date = new Date()): Promise<any[]> {
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  try {
    return await directusFetch<any[]>('/items/on_this_day_cache', {
      'filter[day_key][_eq]': `${mm}-${dd}`,
      sort: '-year',
      fields:
        'id,day_key,event_date,year,kind,title,subtitle,link_collection,link_slug,image',
      limit: 20,
    });
  } catch {
    return [];
  }
}

/** Generic cross-collection search for the ⌘K overlay. */
export async function searchAll(q: string): Promise<{
  albums: Array<{ id: number; title: string; slug: string; type: string; cover_art: string | null }>;
  songs: Array<{ id: number; title: string; slug: string; album: number | null; cover_art: string | null; album_title: string | null }>;
  lyrics: Array<{ id: number; title: string; slug: string; album: number | null; cover_art: string | null; album_title: string | null; snippet: string }>;
  setlists: Array<{ id: number; date: string | null; venue: string | null; venue_link: any }>;
  venues: Array<{ id: number; name: string; slug: string | null; city: string | null; country: string | null }>;
}> {
  const limit = 6;
  const [albums, songs, lyricsHits, setlists, venues] = await Promise.all([
    directusFetch<any[]>('/items/discography', {
      limit, 'filter[title][_icontains]': q,
      fields: 'id,title,slug,type,cover_art', sort: '-release_date',
    }).catch(() => []),
    directusFetch<any[]>('/items/songs', {
      limit, 'filter[title][_icontains]': q,
      'filter[slug][_nnull]': true,
      fields: 'id,title,slug,album,album.cover_art,album.title',
    }).catch(() => []),
    directusFetch<any[]>('/items/songs', {
      limit, 'filter[lyrics][_icontains]': q,
      'filter[slug][_nnull]': true,
      'filter[title][_nicontains]': q,
      fields: 'id,title,slug,album,lyrics,album.cover_art,album.title',
    }).catch(() => []),
    directusFetch<any[]>('/items/setlists', {
      limit, 'filter[venue][_icontains]': q,
      fields: 'id,date,venue,venue_link', sort: '-date',
    }).catch(() => []),
    directusFetch<any[]>('/items/venues', {
      limit, 'filter[name][_icontains]': q,
      fields: 'id,name,slug,city,country',
    }).catch(() => []),
  ]);

  const flattenSong = (s: any) => ({
    id: s.id,
    title: s.title,
    slug: s.slug,
    album: typeof s.album === 'object' ? s.album?.id ?? null : s.album,
    cover_art: s.album?.cover_art ?? null,
    album_title: s.album?.title ?? null,
  });

  const lyricsLine = (text: string, query: string): string => {
    const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const ql = query.toLowerCase();
    const hit = lines.find((l) => l.toLowerCase().includes(ql)) || '';
    return hit.length > 140 ? hit.slice(0, 137) + '…' : hit;
  };

  return {
    albums,
    songs: songs.map(flattenSong),
    lyrics: lyricsHits.map((s: any) => ({
      ...flattenSong(s),
      snippet: lyricsLine(s.lyrics, q),
    })).filter((x) => x.snippet),
    setlists,
    venues,
  };
}

/** Did-you-know / trivia entries attached to an album. */
export async function listAlbumTrivia(albumId: number): Promise<any[]> {
  try {
    return await directusFetch<any[]>('/items/did_you_know', {
      limit: -1,
      'filter[related_album][_eq]': albumId,
      fields: 'id,fact,category,source,source_detail,is_verified,is_featured',
      sort: '-is_featured,id',
    });
  } catch {
    return [];
  }
}

/** Chart positions for an album (from new chart_positions collection). */
export async function listAlbumCharts(albumId: number): Promise<any[]> {
  try {
    return await directusFetch<any[]>('/items/chart_positions', {
      limit: -1,
      'filter[album_id][_eq]': albumId,
      fields: 'id,territory,peak,weeks,year',
      sort: 'peak',
    });
  } catch {
    return [];
  }
}

/** Aggregate live performance count of every album track.
 *  Returns a map of song_id -> plays (already stored on songs.times_played_live). */
export function tracksLivePlays(songs: Song[]): Record<number, number> {
  const out: Record<number, number> = {};
  for (const s of songs) out[s.id] = s.times_played_live || 0;
  return out;
}

let _playCountsPromise: Promise<Map<number, number>> | null = null;

/** Map of song id -> live play count.
 *  Uses Directus's count + groupBy aggregate so the response is one row
 *  per song (~250) instead of one row per performance (~27k). Cached at
 *  the module level (per isolate) and at the Cloudflare edge. */
export async function getAllSongPlayCounts(): Promise<Map<number, number>> {
  if (_playCountsPromise) return _playCountsPromise;
  _playCountsPromise = (async () => {
    const rows = await directusFetch<Array<{ song: number | null; count: { id: number } }>>(
      '/items/setlist_songs',
      {
        'aggregate[count]': 'id',
        'groupBy[]': 'song',
        'filter[song][_nnull]': 'true',
        limit: -1,
      },
      { ttl: 600 }
    );
    const out = new Map<number, number>();
    for (const r of rows) {
      if (r.song != null) out.set(r.song, Number(r.count?.id) || 0);
    }
    return out;
  })();
  return _playCountsPromise;
}

async function enrichSongsWithLivePlays<T extends { id: number } & Partial<Pick<Song, 'times_played_live'>>>(songs: T[]): Promise<T[]> {
  const counts = await getAllSongPlayCounts().catch(() => new Map<number, number>());
  for (const s of songs) {
    s.times_played_live = counts.get(s.id) ?? 0;
  }
  return songs;
}

/** Populate first/last play date + setlist slug on a single song. Two tiny
 *  Directus queries (top-1 by setlist.date asc/desc) plus the cached count map. */
async function enrichSongWithLiveDetail(song: Song): Promise<void> {
  type Row = { setlist: { date: string | null; slug: string | null } | null };
  const baseFields = 'setlist.date,setlist.slug';
  const [counts, firstRows, lastRows] = await Promise.all([
    getAllSongPlayCounts().catch(() => new Map<number, number>()),
    directusFetch<Row[]>('/items/setlist_songs', {
      limit: 1,
      'filter[song][_eq]': song.id,
      fields: baseFields,
      sort: 'setlist.date',
    }, { ttl: 600 }).catch(() => [] as Row[]),
    directusFetch<Row[]>('/items/setlist_songs', {
      limit: 1,
      'filter[song][_eq]': song.id,
      fields: baseFields,
      sort: '-setlist.date',
    }, { ttl: 600 }).catch(() => [] as Row[]),
  ]);
  song.times_played_live = counts.get(song.id) ?? 0;
  song.first_played_live = firstRows[0]?.setlist?.date ?? null;
  song.first_played_setlist_slug = firstRows[0]?.setlist?.slug ?? null;
  song.last_played_live = lastRows[0]?.setlist?.date ?? null;
  song.last_played_setlist_slug = lastRows[0]?.setlist?.slug ?? null;
}

/** Fetch any single entity by its collection + slug or id. Used by nav prefetch. */
export async function fetchRaw<T = any>(
  collection: string,
  params: Params = {}
): Promise<T[]> {
  return await directusFetch<T[]>(`/items/${collection}`, params);
}

// ---------------------------------------------------------------------------
// Phase 2 — live archive helpers
// ---------------------------------------------------------------------------

export interface Setlist {
  id: number;
  slug: string;
  date: string | null;
  venue: string | null;
  venue_link: number | null;
  city: string | null;
  state_province: string | null;
  country: string | null;
  country_code: string | null;
  tour_name: string | null;
  tour: number | null;
  song_count: number | null;
  notes?: string | null;
  facts?: string | null;
  credits?: string | null;
  performing_musicians?: any;
  support_acts?: any;
  soundcheck?: any;
  stage_banter?: any;
  ticket_assets?: any;
  photo_assets?: any;
  video_links?: any;
  audio_links?: any;
  recordings?: any;
  additional_links?: any;
  venue_image?: string | null;
  hero_image?: string | null;
  cure_concerts_url?: string | null;
}

export interface Venue {
  id: number; name: string; slug: string;
  city: string | null; state_province: string | null; country: string | null;
  location: string | null; capacity: number | null; opened_year: number | null;
  venue_type: string | null; latitude: number | null; longitude: number | null;
  wikipedia_url: string | null; official_website: string | null;
  description: string | null; famous_moment: string | null;
  first_cure_show: string | null; latest_cure_show: string | null;
  cure_show_count: number | null;
  photo_file?: string | null;
}

export interface Tour {
  id: number; name: string; slug: string;
  start_date: string | null; end_date: string | null;
  description: string | null; associated_album: number | null;
  total_shows: number | null; image: string | null; image_file?: string | null;
  countries_visited: any; support_acts: any; lineup: any;
}

const SETLIST_LIST_FIELDS = 'id,slug,date,venue,venue_link,city,state_province,country,country_code,tour_name,tour,song_count';

export async function listSetlists(opts: {
  limit?: number;
  tour?: number;
  venue?: number;
  country?: string;
  year?: number;
  q?: string;
} = {}): Promise<Setlist[]> {
  const params: Params = {
    limit: opts.limit ?? 200,
    fields: SETLIST_LIST_FIELDS,
    sort: '-date',
  };
  if (opts.tour) params['filter[tour][_eq]'] = opts.tour;
  if (opts.venue) params['filter[venue_link][_eq]'] = opts.venue;
  if (opts.country) params['filter[country][_eq]'] = opts.country;
  if (opts.year) {
    params['filter[date][_between]'] = `${opts.year}-01-01,${opts.year}-12-31`;
  }
  if (opts.q) params['search'] = opts.q;
  return await directusFetch<Setlist[]>('/items/setlists', params);
}

export async function getSetlistBySlug(slug: string): Promise<Setlist | null> {
  const rows = await directusFetch<Setlist[]>('/items/setlists', {
    limit: 1,
    'filter[slug][_eq]': slug,
    fields: '*',
  });
  return rows?.[0] || null;
}

export async function getSetlistSongs(setlistId: number): Promise<any[]> {
  return await directusFetch<any[]>('/items/setlist_songs', {
    'filter[setlist][_eq]': setlistId,
    fields: 'id,position,set_type,notes,is_cover,cover_artist,is_debut,song_title,song.id,song.title,song.slug,song.album,song.duration',
    sort: 'position',
    limit: -1,
  });
}

export async function listTours(): Promise<Tour[]> {
  return await directusFetch<Tour[]>('/items/tours', {
    limit: -1,
    fields: 'id,name,slug,start_date,end_date,description,associated_album,total_shows,image,image_file,countries_visited,support_acts,lineup',
    sort: '-start_date',
  });
}

export async function getTourBySlug(slug: string): Promise<Tour | null> {
  const rows = await directusFetch<Tour[]>('/items/tours', {
    limit: 1,
    'filter[slug][_eq]': slug,
    fields: '*',
  });
  return rows?.[0] || null;
}

export async function listVenues(opts: { limit?: number } = {}): Promise<Venue[]> {
  return await directusFetch<Venue[]>('/items/venues', {
    limit: opts.limit ?? -1,
    fields: 'id,name,slug,city,state_province,country,capacity,opened_year,venue_type,latitude,longitude,cure_show_count,first_cure_show,latest_cure_show,photo_file',
    sort: '-cure_show_count',
  });
}

export async function getVenueBySlug(slug: string): Promise<Venue | null> {
  const rows = await directusFetch<Venue[]>('/items/venues', {
    limit: 1,
    'filter[slug][_eq]': slug,
    fields: '*',
  });
  return rows?.[0] || null;
}

export async function getVenueById(id: number): Promise<Venue | null> {
  const rows = await directusFetch<Venue[]>('/items/venues', {
    limit: 1,
    'filter[id][_eq]': id,
    fields: '*',
  });
  return rows?.[0] || null;
}

// ---------------------------------------------------------------------------
// Phase 3 — lyrics / songs / band helpers
// ---------------------------------------------------------------------------

export async function getSongBySlug(slug: string): Promise<Song | null> {
  const rows = await directusFetch<Song[]>('/items/songs', {
    limit: 1,
    'filter[slug][_eq]': slug,
    fields: '*',
  });
  const song = rows?.[0] || null;
  if (!song) return null;
  await enrichSongWithLiveDetail(song);
  return song;
}

export async function listSongs(opts: { limit?: number; album?: number; q?: string } = {}): Promise<Song[]> {
  const params: Params = {
    limit: opts.limit ?? -1,
    fields: 'id,title,slug,album,duration,track_number,is_single,music_video_url',
    sort: 'title',
    'filter[slug][_nnull]': true,
  };
  if (opts.album) params['filter[album][_eq]'] = opts.album;
  if (opts.q) params['search'] = opts.q;
  const songs = await directusFetch<Song[]>('/items/songs', params);
  return enrichSongsWithLivePlays(songs);
}

export interface Member {
  id: number; name: string; slug: string; bio: string | null;
  instruments: string[]; is_current_member: boolean;
  is_featured_member: boolean;
  gear_families?: GearFamily[];
  side_projects: any[]; birth_date: string | null; photo: string | null;
  death_date: string | null; death_place: string | null;
  photo_file?: string | null;
  source: number | { id?: number; name?: string | null; url?: string | null; type?: string | null; reliability?: number | null; is_official?: boolean | null } | null;
  source_url: string | null;
  aliases: string[];
  stints?: MemberStint[];
  photos?: MemberPhoto[];
}

export interface MemberStint {
  id: number;
  member: number | { id?: number; name?: string | null; slug?: string | null } | null;
  start_year: number | null;
  end_year: number | null;
  role: string | null;
  stint_number: number | null;
  notes: string | null;
}

export interface MemberPhoto {
  id: number;
  title: string | null;
  description: string | null;
  image_file: string | null;
  image_url: string | null;
  date_taken: string | null;
  formatted_date: string | null;
  photographer: string | null;
  location: string | null;
  tour: string | null;
}

export interface MemberShow {
  id: number;
  slug: string | null;
  date: string | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  country_code: string | null;
  tour_name: string | null;
  song_count: number | null;
}

export interface MemberLiveStats {
  tenureShowCount: number;
  lineupTaggedCount: number;
  countries: number;
  tours: number;
  avgSongCount: number | null;
  firstShow: MemberShow | null;
  lastShow: MemberShow | null;
  longestShow: MemberShow | null;
  recentShows: MemberShow[];
  yearlyCounts: Array<{ year: number; count: number }>;
  peakYears: Array<{ year: number; count: number }>;
}

export type GearFamily = 'guitar' | 'bass' | 'keyboard' | 'drums' | 'voice' | 'other';

export interface Gear {
  id: string;
  slug: string | null;
  name: string;
  kind: string | null;
  category: string | null;
  manufacturer: string | null;
  model: string | null;
  description: string | null;
  notes: string | null;
  era_range: string | null;
  image: string | null;
  owner: string | null;
  used_by: number | string | { id?: number; name?: string | null; slug?: string | null; instruments?: unknown } | null;
}

const MEMBER_BASE_FIELDS = 'id,name,slug,bio,instruments,is_current_member,photo,birth_date,death_date,death_place,aliases,side_projects,source,source.id,source.name,source.url,source.type,source.reliability,source.is_official,source_url';
const MEMBER_STINT_FIELDS = 'id,member,start_year,end_year,role,stint_number,notes';
const MEMBER_WITH_STINT_FIELDS = `${MEMBER_BASE_FIELDS},stints.id,stints.start_year,stints.end_year,stints.role,stints.stint_number,stints.notes`;
const MEMBER_PHOTO_FIELDS = 'id,title,description,image_file,image_url,date_taken,formatted_date,photographer,location,tour';
const MEMBER_DETAIL_FIELDS = `${MEMBER_WITH_STINT_FIELDS},photos.${MEMBER_PHOTO_FIELDS.split(',').join(',photos.')}`;

function normalizeList(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
      return parsed === null || parsed === undefined ? [] : [parsed];
    } catch {
      return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }

  return [value];
}

function normalizeStringList(value: unknown): string[] {
  return normalizeList(value)
    .map((item) => typeof item === 'string' ? item.trim() : String(item).trim())
    .filter(Boolean);
}

function normalizeBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function normalizeYear(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const year = Number(value);
  return Number.isFinite(year) ? year : null;
}

function compareStints(a: MemberStint, b: MemberStint): number {
  const aOrder = a.stint_number ?? Number.MAX_SAFE_INTEGER;
  const bOrder = b.stint_number ?? Number.MAX_SAFE_INTEGER;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return (a.start_year ?? 9999) - (b.start_year ?? 9999);
}

function normalizeStint(row: any, memberId?: number): MemberStint {
  return {
    id: Number(row.id),
    member: row.member ?? memberId ?? null,
    start_year: normalizeYear(row.start_year),
    end_year: normalizeYear(row.end_year),
    role: row.role || null,
    stint_number: normalizeYear(row.stint_number),
    notes: row.notes || null,
  };
}

function normalizePhoto(row: any): MemberPhoto {
  return {
    id: Number(row.id),
    title: row.title || null,
    description: row.description || null,
    image_file: row.image_file || null,
    image_url: row.image_url || null,
    date_taken: row.date_taken || null,
    formatted_date: row.formatted_date || null,
    photographer: row.photographer || null,
    location: row.location || null,
    tour: row.tour || null,
  };
}

function gearFamiliesFromText(value: unknown): GearFamily[] {
  const text = normalizeStringList(value).join(' ').toLowerCase();
  const families = new Set<GearFamily>();
  if (/\b(six[- ]string bass|bass guitar|bass)\b/.test(text)) families.add('bass');
  if (/\b(guitar|baritone|jazzmaster|schecter)\b/.test(text)) families.add('guitar');
  if (/\b(keyboard|keyboards|synth|synthesizer|piano|organ|oberheim|roland)\b/.test(text)) families.add('keyboard');
  if (/\b(drum|drums|percussion|kit)\b/.test(text)) families.add('drums');
  if (/\b(vocal|vocals|voice|singer)\b/.test(text)) families.add('voice');
  return Array.from(families);
}

export function memberGearFamilies(member: Pick<Member, 'instruments' | 'stints'>): GearFamily[] {
  const roleText = (member.stints ?? []).map((stint) => stint.role).filter(Boolean).join(', ');
  const families = new Set<GearFamily>([
    ...gearFamiliesFromText(member.instruments),
    ...gearFamiliesFromText(roleText),
  ]);
  return families.size ? Array.from(families) : ['other'];
}

function normalizeGear(row: any): Gear {
  const kind = row.kind ?? row.category ?? null;
  return {
    id: String(row.id),
    slug: row.slug ?? null,
    name: row.name || row.model || row.title || 'Untitled equipment',
    kind,
    category: row.category ?? row.kind ?? null,
    manufacturer: row.manufacturer ?? null,
    model: row.model ?? null,
    description: row.description ?? null,
    notes: row.notes ?? null,
    era_range: row.era_range ?? row.years ?? null,
    image: row.image ?? row.image_file ?? null,
    owner: row.owner ?? null,
    used_by: row.used_by ?? null,
  };
}

function comparePhotos(a: MemberPhoto, b: MemberPhoto): number {
  return String(b.date_taken || '').localeCompare(String(a.date_taken || ''));
}

function normalizeMember(row: any, stintsOverride?: MemberStint[]): Member {
  const stints = (stintsOverride ?? normalizeList(row.stints).map((stint) => normalizeStint(stint, row.id))).sort(compareStints);
  const photo = row.photo ?? row.photo_file ?? null;
  const photos = normalizeList(row.photos).map(normalizePhoto).filter((item) => item.image_file || item.image_url).sort(comparePhotos);
  const isCurrentMember = normalizeBoolean(row.is_current_member) || stints.some((stint) => stint.end_year === null);
  const instruments = normalizeStringList(row.instruments);

  return {
    ...row,
    instruments,
    aliases: normalizeStringList(row.aliases),
    side_projects: normalizeList(row.side_projects),
    photo,
    photo_file: photo,
    source: row.source ?? null,
    source_url: row.source_url ?? null,
    death_date: row.death_date ?? null,
    death_place: row.death_place ?? null,
    stints,
    photos,
    gear_families: memberGearFamilies({ instruments, stints }),
    is_featured_member: isCurrentMember,
    is_current_member: isCurrentMember,
  };
}

function compareMembers(a: Member, b: Member): number {
  if (a.is_current_member !== b.is_current_member) return a.is_current_member ? -1 : 1;
  const aStart = a.stints?.[0]?.start_year ?? 9999;
  const bStart = b.stints?.[0]?.start_year ?? 9999;
  if (aStart !== bStart) return aStart - bStart;
  return a.name.localeCompare(b.name);
}

function isMissingStintsFieldError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('field "stints"') || message.includes('field \\"stints\\"') || message.includes('access field');
}

async function listAllMemberStints(): Promise<MemberStint[]> {
  const rows = await directusFetch<any[]>('/items/member_stints', {
    limit: -1,
    fields: MEMBER_STINT_FIELDS,
    sort: 'member,stint_number,start_year',
  });
  return rows.map((row) => normalizeStint(row)).sort(compareStints);
}

function groupStintsByMember(stints: MemberStint[]): Map<number, MemberStint[]> {
  const groups = new Map<number, MemberStint[]>();
  for (const stint of stints) {
    const memberId = typeof stint.member === 'number' ? stint.member : stint.member?.id;
    if (!memberId) continue;
    const existing = groups.get(memberId) ?? [];
    existing.push(stint);
    groups.set(memberId, existing);
  }
  for (const group of groups.values()) group.sort(compareStints);
  return groups;
}

export function formatStintYears(stint: MemberStint): string {
  return `${stint.start_year ?? '—'}–${stint.end_year ?? 'Present'}`;
}

export function memberTenureLabel(member: Member): string {
  const stintYears = (member.stints ?? []).map(formatStintYears).filter(Boolean);
  if (stintYears.length > 0) return stintYears.join(', ');
  return 'Tenure to be filed';
}

export function memberCurrentStint(member: Member): MemberStint | null {
  const active = (member.stints ?? []).filter((stint) => stint.end_year === null);
  return active.length > 0 ? active[active.length - 1] : null;
}

export function memberRoleLabel(member: Member): string {
  const stints = member.stints ?? [];
  const lastStint = stints.length > 0 ? stints[stints.length - 1] : null;
  return memberCurrentStint(member)?.role || lastStint?.role || member.instruments?.[0] || '';
}

export function memberPhoto(member: Pick<Member, 'photo'> & { photo_file?: string | null }): string | null {
  return member.photo || member.photo_file || null;
}

export function memberLifespanLabel(member: Pick<Member, 'birth_date' | 'death_date'>): string {
  const born = member.birth_date?.slice(0, 4) || null;
  const died = member.death_date?.slice(0, 4) || null;
  if (born && died) return `${born}–${died}`;
  if (born) return `Born ${born}`;
  if (died) return `Died ${died}`;
  return 'Life dates to be filed';
}

export function memberFirstJoinYear(member: Pick<Member, 'stints'>): number | null {
  const years = (member.stints ?? []).map((stint) => stint.start_year).filter((year): year is number => year !== null);
  return years.length ? Math.min(...years) : null;
}

export function memberLastDepartureYear(member: Pick<Member, 'stints' | 'is_current_member'>): number | null {
  if (member.is_current_member) return null;
  const years = (member.stints ?? []).map((stint) => stint.end_year).filter((year): year is number => year !== null);
  return years.length ? Math.max(...years) : null;
}

export function memberActiveYears(member: Pick<Member, 'stints'>): number | null {
  const currentYear = new Date().getUTCFullYear();
  let total = 0;
  for (const stint of member.stints ?? []) {
    if (stint.start_year === null) continue;
    const end = stint.end_year ?? currentYear;
    if (end < stint.start_year) continue;
    total += end - stint.start_year + 1;
  }
  return total || null;
}

export function compareMembersByDeparture(a: Member, b: Member): number {
  const aLast = memberLastDepartureYear(a) ?? -Infinity;
  const bLast = memberLastDepartureYear(b) ?? -Infinity;
  if (aLast !== bLast) return bLast - aLast;
  const aFirst = memberFirstJoinYear(a) ?? Infinity;
  const bFirst = memberFirstJoinYear(b) ?? Infinity;
  if (aFirst !== bFirst) return aFirst - bFirst;
  return a.name.localeCompare(b.name);
}

export async function listMembers(): Promise<Member[]> {
  try {
    const rows = await directusFetch<any[]>('/items/members', {
      limit: -1,
      fields: MEMBER_WITH_STINT_FIELDS,
      'deep[stints][_sort]': 'stint_number,start_year',
      sort: 'name',
    });
    return rows.map((row) => normalizeMember(row)).sort(compareMembers);
  } catch (error) {
    if (!isMissingStintsFieldError(error)) throw error;
    const [rows, stints] = await Promise.all([
      directusFetch<any[]>('/items/members', {
        limit: -1,
        fields: MEMBER_BASE_FIELDS,
        sort: 'name',
      }),
      listAllMemberStints(),
    ]);
    const stintsByMember = groupStintsByMember(stints);
    return rows.map((row) => normalizeMember(row, stintsByMember.get(row.id) ?? [])).sort(compareMembers);
  }
}

export async function listGear(): Promise<Gear[]> {
  let rows: any[];
  try {
    rows = await directusFetch<any[]>('/items/gear', {
      limit: -1,
      fields: '*,used_by.id,used_by.name,used_by.slug,used_by.instruments',
      sort: 'kind,name',
    });
  } catch {
    rows = await directusFetch<any[]>('/items/gear', {
      limit: -1,
      fields: '*',
      sort: 'kind,name',
    });
  }
  return rows.map(normalizeGear);
}

export async function getMemberBySlug(slug: string): Promise<Member | null> {
  try {
    const rows = await directusFetch<any[]>('/items/members', {
      limit: 1,
      'filter[slug][_eq]': slug,
      fields: MEMBER_DETAIL_FIELDS,
      'deep[stints][_sort]': 'stint_number,start_year',
      'deep[photos][_sort]': '-date_taken',
      'deep[photos][_limit]': 12,
    });
    return rows?.[0] ? normalizeMember(rows[0]) : null;
  } catch (error) {
    if (!isMissingStintsFieldError(error)) throw error;
    const rows = await directusFetch<any[]>('/items/members', {
      limit: 1,
      'filter[slug][_eq]': slug,
      fields: MEMBER_BASE_FIELDS,
    });
    const member = rows?.[0] || null;
    if (!member) return null;
    const stints = await getMemberStints(member.id).catch(() => []);
    return normalizeMember(member, stints);
  }
}

export async function getMemberStints(memberId: number): Promise<MemberStint[]> {
  const rows = await directusFetch<any[]>('/items/member_stints', {
    limit: -1,
    'filter[member][_eq]': memberId,
    fields: MEMBER_STINT_FIELDS,
    sort: 'stint_number,start_year',
  });
  return rows.map((row) => normalizeStint(row, memberId)).sort(compareStints);
}

export async function listMemberPhotos(member: Pick<Member, 'id' | 'name' | 'photos'>, opts: { limit?: number } = {}): Promise<MemberPhoto[]> {
  const limit = opts.limit ?? 8;
  const seen = new Set<number>();
  const merged: MemberPhoto[] = [];
  const add = (rows: any[]) => {
    for (const row of rows) {
      const photo = normalizePhoto(row);
      if (!photo.id || seen.has(photo.id) || !(photo.image_file || photo.image_url)) continue;
      seen.add(photo.id);
      merged.push(photo);
    }
  };

  add(member.photos ?? []);

  try {
    const linked = await directusFetch<any[]>('/items/photos', {
      limit,
      fields: MEMBER_PHOTO_FIELDS,
      'filter[member][_eq]': member.id,
      sort: '-date_taken',
    });
    add(linked);
  } catch {
    // Older schemas may not have photos.member yet; fall back to search below.
  }

  if (member.name && merged.length < limit) {
    const searched = await directusFetch<any[]>('/items/photos', {
      limit,
      fields: MEMBER_PHOTO_FIELDS,
      search: member.name,
      sort: '-date_taken',
    }).catch(() => []);
    add(searched);
  }

  const stints = 'stints' in member && Array.isArray((member as any).stints) ? (member as any).stints as MemberStint[] : [];
  if (stints.length > 0 && merged.length < limit) {
    const windows = stints
      .filter((stint) => stint.start_year !== null)
      .map((stint) => ({
        start: `${stint.start_year}-01-01`,
        end: `${stint.end_year ?? new Date().getUTCFullYear()}-12-31`,
      }));
    const eraRows = await Promise.all(
      windows.map((window) => directusFetch<any[]>('/items/photos', {
        limit,
        fields: MEMBER_PHOTO_FIELDS,
        'filter[date_taken][_between]': `${window.start},${window.end}`,
        'filter[image_file][_nnull]': 'true',
        sort: '-date_taken',
      }).catch(() => []))
    );
    for (const rows of eraRows) add(rows);
  }

  return merged.sort(comparePhotos).slice(0, limit);
}

function toMemberShow(row: any): MemberShow {
  return {
    id: Number(row.id),
    slug: row.slug || null,
    date: row.date || null,
    venue: row.venue || null,
    city: row.city || null,
    country: row.country || null,
    country_code: row.country_code || null,
    tour_name: row.tour_name || null,
    song_count: row.song_count === null || row.song_count === undefined ? null : Number(row.song_count),
  };
}

function showYear(show: Pick<MemberShow, 'date'>): number | null {
  if (!show.date) return null;
  const year = Number(String(show.date).slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function showFallsWithinStints(show: Pick<MemberShow, 'date'>, stints: MemberStint[]): boolean {
  const year = showYear(show);
  if (year === null) return false;
  return stints.some((stint) => {
    if (stint.start_year === null) return false;
    const end = stint.end_year ?? 9999;
    return year >= stint.start_year && year <= end;
  });
}

function performerListContainsMember(value: unknown, member: Pick<Member, 'id' | 'name'>): boolean {
  const performers = normalizeList(value);
  const memberName = member.name.trim().toLowerCase();
  return performers.some((performer) => {
    if (!performer || typeof performer !== 'object') return false;
    const performerId = Number((performer as any).member_id ?? (performer as any).member);
    if (Number.isFinite(performerId) && performerId === member.id) return true;
    return String((performer as any).name || '').trim().toLowerCase() === memberName;
  });
}

export async function getMemberLiveStats(member: Pick<Member, 'id' | 'name' | 'stints'>): Promise<MemberLiveStats> {
  const empty: MemberLiveStats = {
    tenureShowCount: 0,
    lineupTaggedCount: 0,
    countries: 0,
    tours: 0,
    avgSongCount: null,
    firstShow: null,
    lastShow: null,
    longestShow: null,
    recentShows: [],
    yearlyCounts: [],
    peakYears: [],
  };
  const stints = member.stints ?? [];
  if (stints.length === 0) return empty;

  const rows = await directusFetch<any[]>('/items/setlists', {
    limit: -1,
    fields: `${SETLIST_LIST_FIELDS},performing_musicians`,
    'filter[date][_nnull]': 'true',
    sort: 'date',
  }, { ttl: 600 }).catch(() => []);

  const shows = rows.map(toMemberShow).filter((show) => showFallsWithinStints(show, stints));
  const lineupTaggedCount = rows.filter((row) => performerListContainsMember(row.performing_musicians, member)).length;
  const countries = new Set(shows.map((show) => show.country_code || show.country).filter(Boolean)).size;
  const tours = new Set(shows.map((show) => show.tour_name).filter(Boolean)).size;
  const songCounts = shows.map((show) => show.song_count).filter((count): count is number => count !== null && Number.isFinite(count));
  const avgSongCount = songCounts.length
    ? Math.round(songCounts.reduce((sum, count) => sum + count, 0) / songCounts.length)
    : null;
  const longestShow = shows.reduce<MemberShow | null>((best, show) => {
    if (!show.song_count) return best;
    if (!best?.song_count || show.song_count > best.song_count) return show;
    return best;
  }, null);
  const byYear = new Map<number, number>();
  for (const show of shows) {
    const year = showYear(show);
    if (year === null) continue;
    byYear.set(year, (byYear.get(year) ?? 0) + 1);
  }
  const yearlyCounts = Array.from(byYear.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);

  return {
    tenureShowCount: shows.length,
    lineupTaggedCount,
    countries,
    tours,
    avgSongCount,
    firstShow: shows[0] ?? null,
    lastShow: shows[shows.length - 1] ?? null,
    longestShow,
    recentShows: shows.slice(-5).reverse(),
    yearlyCounts,
    peakYears: yearlyCounts.slice().sort((a, b) => b.count - a.count).slice(0, 6),
  };
}

export async function listTimeline(opts: { limit?: number } = {}): Promise<any[]> {
  return await directusFetch<any[]>('/items/timeline', {
    limit: opts.limit ?? -1,
    fields: 'id,title,description,date,formatted_date,year,type,importance,related_album_id,related_member_id',
    sort: 'date',
  });
}

// ---------------------------------------------------------------------------
// Homepage widget helpers — album of month, song/lyric of day, photo of day,
// next concert countdown. Deterministic by current date where applicable.
// ---------------------------------------------------------------------------

function dayIndex(now = new Date()): number {
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const diff = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - start;
  return Math.floor(diff / 86400000);
}

function monthIndex(now = new Date()): number {
  return now.getUTCFullYear() * 12 + now.getUTCMonth();
}

/** Album of the month — prefers is_featured_issue, else deterministic from studio albums. */
export async function getAlbumOfMonth(): Promise<Album | null> {
  const featured = await getFeaturedIssue();
  if (featured) return featured;
  const studios = await listAlbums({ type: 'studio' });
  if (!studios.length) return null;
  return studios[monthIndex() % studios.length];
}

/** Song of the day — deterministic pick from songs with lyrics. */
export async function getSongOfDay(): Promise<Song | null> {
  const rows = await directusFetch<Song[]>('/items/songs', {
    limit: -1,
    fields: 'id,title,slug,album,lyrics,lyrics_structured',
    'filter[lyrics][_nnull]': 'true',
  });
  if (!rows.length) return null;
  const song = rows[dayIndex() % rows.length];
  await enrichSongsWithLivePlays([song]);
  return song;
}

/** Lyric of the day — picks a single memorable line from song of the day. */
export async function getLyricOfDay(): Promise<{ line: string; song: Song } | null> {
  const song = await getSongOfDay();
  if (!song) return null;
  const structured = (song as any).lyrics_structured;
  const lines: string[] = [];
  if (Array.isArray(structured)) {
    for (const section of structured) {
      const sl = section?.lines;
      if (Array.isArray(sl)) for (const ln of sl) if (ln?.text) lines.push(ln.text);
    }
  }
  if (!lines.length && (song as any).lyrics) {
    const flat = String((song as any).lyrics).split(/\n+/).map(s => s.trim()).filter(Boolean);
    lines.push(...flat);
  }
  if (!lines.length) return null;
  const line = lines[dayIndex() % lines.length];
  return { line, song };
}

/** Photo of the day — deterministic from photos with images. */
export async function getPhotoOfDay(): Promise<any | null> {
  const rows = await directusFetch<any[]>('/items/photos', {
    limit: -1,
    fields: 'id,title,description,image_file,image_url,date_taken,formatted_date,photographer,location,tour,album,album_slug',
  });
  const withImage = rows.filter(r => r.image_file || r.image_url);
  if (!withImage.length) return null;
  return withImage[dayIndex() % withImage.length];
}

/** Next upcoming concert from setlists (date in future). */
export async function getNextConcert(): Promise<Setlist | null> {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await directusFetch<Setlist[]>('/items/setlists', {
    limit: 1,
    fields: SETLIST_LIST_FIELDS + ',hero_image,venue_image',
    'filter[date][_gte]': today,
    sort: 'date',
  });
  return rows?.[0] || null;
}

/** Most recent past concert (fallback for countdown). */
export async function getLatestConcert(): Promise<Setlist | null> {
  const rows = await directusFetch<Setlist[]>('/items/setlists', {
    limit: 1,
    fields: SETLIST_LIST_FIELDS + ',hero_image,venue_image',
    sort: '-date',
  });
  return rows?.[0] || null;
}

/** Album covers for cover-wall widgets. */
export async function allAlbumCovers(): Promise<Pick<Album, 'id' | 'title' | 'slug' | 'cover_art' | 'release_date' | 'type'>[]> {
  return await directusFetch<any[]>('/items/discography', {
    limit: -1,
    fields: 'id,title,slug,cover_art,release_date,type',
    sort: 'release_date',
    'filter[cover_art][_nnull]': 'true',
  });
}
