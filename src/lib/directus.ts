// Directus API utility functions
// Includes mock data fallbacks for when Directus is unavailable

import {
  mockNewsPosts,
  mockPhotos,
  mockSongsWithAlbums,
  mockSetlists,
  mockMembers,
  mockTimelineEvents,
  getMockFeaturedNews,
  getMockPhotoOfTheDay,
  getMockSongOfTheDay,
  getMockLatestSetlist,
  getMockLatestReview
} from './mockData';

import type {
  DirectusAlbum,
  DirectusSong,
  DirectusSingle,
  Album,
  Track,
  Single,
  Song,
  SongWithAlbum,
  LyricPart,
  AlbumEra,
  AlbumType,
  // Wiki types
  DirectusWikiArticle,
  DirectusWikiMember,
  DirectusTimelineEvent,
  WikiArticle,
  WikiMember,
  TimelineEvent,
  // Member stint types
  DirectusMemberStint,
  MemberStint,
  // Photo types
  DirectusPhoto,
  Photo,
  // Forum types
  DirectusForumCategory,
  DirectusForumThread,
  DirectusForumPost,
  DirectusForumUser,
  ForumCategory,
  ForumThread,
  ForumPost,
  ForumUser,
  // Stats types
  SongStats,
  TourStats,
  OverallStats,
  // News types
  DirectusNews,
  NewsPost,
  NewsCategory,
  // Tour types
  DirectusTour,
  Tour,
  // New collection types
  DirectusSource,
  Source,
  DirectusVideo,
  Video,
  DirectusPoll,
  DirectusPollOption,
  Poll,
  PollOption,
  DirectusDidYouKnow,
  DidYouKnow,
  DirectusAlbumPersonnel,
  AlbumPersonnel,
  SiteStats,
  VideoType,
  SourceType,
  PollStatus,
} from '../types/directus';

const DIRECTUS_URL = 'https://dash.cureation.net';
const API_BASE = `${DIRECTUS_URL}/items`;
const DIRECTUS_TOKEN = import.meta.env.DIRECTUS_TOKEN || '';

// Generic fetch wrapper with error handling
async function fetchFromDirectus<T>(endpoint: string): Promise<T[]> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${DIRECTUS_TOKEN}`,
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error(`Directus fetch error for ${endpoint}:`, error);
    return [];
  }
}

// Asset URL helper
export function getAssetUrl(assetId: string | undefined): string {
  if (!assetId) return '/images/placeholder-album.jpg';
  return `${DIRECTUS_URL}/assets/${assetId}`;
}

// Parse a value that may be a JSON string array, an actual array, or a plain string
function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try { return JSON.parse(trimmed); } catch { return [trimmed]; }
    }
    return trimmed ? [trimmed] : [];
  }
  return [];
}

// Slug generator
export function generateSlug(title: string | null | undefined): string {
  if (!title) return 'unknown';
  return title
    .toLowerCase()
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, '-');
}

// Fetch all albums
export async function fetchAlbums(): Promise<DirectusAlbum[]> {
  return fetchFromDirectus<DirectusAlbum>('/discography');
}

// Fetch all songs
export async function fetchSongs(): Promise<DirectusSong[]> {
  return fetchFromDirectus<DirectusSong>('/songs');
}

// Fetch all singles
export async function fetchSingles(): Promise<DirectusSingle[]> {
  return fetchFromDirectus<DirectusSingle>('/singles');
}

// Format a raw album into the processed Album type
export function formatAlbum(album: DirectusAlbum): Album {
  const year = album.release_date
    ? new Date(album.release_date).getFullYear().toString()
    : '';

  return {
    id: album.id.toString(),
    title: album.title || 'Unknown Album',
    slug: album.slug || generateSlug(album.title || 'unknown'),
    year,
    coverImage: getAssetUrl(album.cover_art),
    releaseDate: album.release_date
      ? new Date(album.release_date).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        })
      : 'Unknown',
    recordLabel: album.label || 'Fiction',
    producer: album.producer || 'Unknown',
    description: album.description || 'No description available.',
    background: album.background_text || 'No background information available.',
    reception: album.critical_reception || 'No critical reception information available.',
    featured: album.featured || false,
    type: (album.type as AlbumType) || 'studio',
    parentAlbumId: album.parent_album,
    spotifyUrl: album.spotify_url,
    appleMusicUrl: album.apple_music_url,
    discCount: album.disc_count || 1,
    trackCount: album.track_count || 0,
    catalogNumber: album.catalog_number,
    genreTags: album.genre_tags || [],
    credits: album.credits,
  };
}

// Album type display labels
export const albumTypeLabels: Record<AlbumType, string> = {
  studio: 'Studio Album',
  live: 'Live Album',
  compilation: 'Compilation',
  ep: 'EP',
  single: 'Single',
  deluxe: 'Deluxe Edition',
  reissue: 'Reissue',
  boxset: 'Box Set',
  soundtrack: 'Soundtrack',
  remix: 'Remix Album',
};

// Fetch albums by type
export async function fetchAlbumsByType(type: AlbumType): Promise<DirectusAlbum[]> {
  return fetchFromDirectus<DirectusAlbum>(`/discography?filter[type][_eq]=${type}&sort=release_date`);
}

// Fetch albums grouped by type (for discography index)
export async function fetchAlbumsGroupedByType(): Promise<Record<string, Album[]>> {
  const albums = await fetchAlbums();
  const grouped: Record<string, Album[]> = {};

  for (const album of albums) {
    const type = (album.type as AlbumType) || 'studio';
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(formatAlbum(album));
  }

  // Sort each group by release date
  for (const type of Object.keys(grouped)) {
    grouped[type].sort((a, b) => {
      if (!a.year) return 1;
      if (!b.year) return -1;
      return parseInt(a.year) - parseInt(b.year);
    });
  }

  return grouped;
}

// Format a raw song into a Track type
export function formatTrack(song: DirectusSong): Track {
  return {
    number: song.track_number || 0,
    title: song.title || 'Unknown Track',
    slug: generateSlug(song.title || 'unknown'),
    duration: song.duration || '0:00',
    listenLink: song.listen_links?.[0]?.Link
  };
}

// Format lyrics into structured parts.
// Prefer lyrics_structured when available, and fall back to legacy text lyrics.
export function formatLyrics(
  lyrics: string | undefined,
  lyricsStructured?: Array<{
    label?: string;
    lines?: Array<{ text?: string }>;
  }>
): LyricPart[] | null {
  if (lyricsStructured && Array.isArray(lyricsStructured) && lyricsStructured.length > 0) {
    return lyricsStructured.map((section) => {
      const label = (section.label || '').trim();
      const lines = (section.lines || [])
        .map((line) => (line.text || '').trim())
        .filter(Boolean);

      const content = label
        ? [`[${label}]`, ...lines].join('\n')
        : lines.join('\n');

      return {
        type: label ? 'section' : 'verse',
        content,
      };
    }).filter((part) => part.content.trim().length > 0);
  }

  if (!lyrics) return null;

  return lyrics.split('\n\n').map((verse) => ({
    type: verse.match(/^\[(.*?)\]/) ? 'section' : 'verse',
    content: verse
  }));
}

// Format a raw song into the full Song type
export function formatSong(song: DirectusSong): Song {
  return {
    id: song.id,
    title: song.title,
    trackNumber: song.track_number || 0,
    duration: song.duration || '0:00',
    lyrics: formatLyrics(song.lyrics, song.lyrics_structured),
    listenLinks: song.listen_links || [],
    credits: song.credits,
    hasLyrics: !!song.lyrics,
    writer: song.writer,
    composer: song.composer,
    bpm: song.bpm,
    musicalKey: song.musical_key,
    firstPlayedLive: song.first_played_live,
    lastPlayedLive: song.last_played_live,
    timesPlayedLive: song.times_played_live,
    guitarTuning: song.guitar_tuning,
    isSingle: song.is_single,
    musicVideoUrl: song.music_video_url,
  };
}

// Format a single
export function formatSingle(single: DirectusSingle): Single {
  return {
    title: single.title || 'Unknown Single',
    releaseDate: single.release_date
      ? new Date(single.release_date).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        })
      : 'Unknown',
    chartPositions: single.chart_position || []
  };
}

// Get complete album data with tracks and singles
export async function getAlbumWithDetails(albumId: number): Promise<Album | null> {
  const [albums, songs, singles] = await Promise.all([
    fetchAlbums(),
    fetchSongs(),
    fetchSingles()
  ]);

  const album = albums.find((a) => a.id === albumId);
  if (!album) return null;

  const formattedAlbum = formatAlbum(album);

  // Add tracks
  formattedAlbum.tracks = songs
    .filter((s) => s.album === albumId && s.title)
    .map(formatTrack)
    .sort((a, b) => a.number - b.number);

  // Add singles
  formattedAlbum.singles = singles.filter((s) => s.album === albumId).map(formatSingle);

  return formattedAlbum;
}

// Get all songs with album info for lyrics pages
export async function getSongsWithAlbums(): Promise<SongWithAlbum[]> {
  const [albums, songs] = await Promise.all([fetchAlbums(), fetchSongs()]);

  // If no songs from Directus, return mock data
  if (songs.length === 0) {
    return mockSongsWithAlbums;
  }

  // Create album lookup
  const albumMap = new Map<number, DirectusAlbum>();
  albums.forEach((album) => albumMap.set(album.id, album));

  return songs
    .filter((song) => song.title)
    .map((song) => {
      const album = albumMap.get(song.album);
      const year = album?.release_date
        ? new Date(album.release_date).getFullYear().toString()
        : '';

      return {
        ...formatSong(song),
        albumId: song.album,
        albumTitle: album?.title || 'Unknown Album',
        albumSlug: album?.slug || generateSlug(album?.title || 'unknown'),
        albumCover: getAssetUrl(album?.cover_art),
        year
      };
    });
}

// Group songs by decade
export function groupSongsByDecade(
  songs: SongWithAlbum[]
): Record<string, SongWithAlbum[]> {
  return songs.reduce(
    (acc, song) => {
      if (!song.year) return acc;
      const decade = `${song.year.slice(0, 3)}0s`;
      if (!acc[decade]) acc[decade] = [];
      acc[decade].push(song);
      return acc;
    },
    {} as Record<string, SongWithAlbum[]>
  );
}

// Get a deterministic "song of the day" based on the current date
export function getSongOfTheDay(songs: SongWithAlbum[]): SongWithAlbum {
  const songsWithLyrics = songs.filter((s) => s.hasLyrics);
  if (songsWithLyrics.length === 0) {
    // Fallback to mock data
    return getMockSongOfTheDay();
  }

  // Use date as seed for deterministic selection
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const index = seed % songsWithLyrics.length;

  return songsWithLyrics[index];
}

// ============================================
// SETLISTS
// ============================================

interface DirectusSetlist {
  id: number | string;
  date: string;
  venue: string;
  city: string;
  country: string;
  state_province?: string;
  tour_name?: string;
  tour?: number;
  slug?: string;
  notes?: string;
  song_count?: number;
  venue_image?: string;
  source?: string;
}

interface SetlistSong {
  song_id?: number;
  position: number;
  set_type: string;
  notes?: string;
  is_cover?: boolean;
  song_title?: string;
}

export interface Setlist {
  id: string;
  date: string;
  formattedDate: string;
  year: number;
  venue: string;
  city: string;
  country: string;
  location: string;
  tourName?: string;
  slug: string;
  notes?: string;
  source?: string;
  featured: boolean;
  coverImage?: string;
  songs: SetlistSongDisplay[];
  songCount: number;
}

export interface SetlistSongDisplay {
  songId?: number;
  position: number;
  title: string;
  songSlug?: string;
  setType: string;
  notes?: string;
  isCover: boolean;
  duration?: string;
}

let setlistsWithSongsPromise: Promise<Setlist[]> | null = null;
let songStatsPromise: Promise<SongStats[]> | null = null;

// Fetch all setlists
export async function fetchSetlists(): Promise<DirectusSetlist[]> {
  return fetchFromDirectus<DirectusSetlist>('/setlists?sort=-date&limit=-1');
}

// Fetch the next upcoming concert (setlist with a future date)
export interface NextConcert {
  venue: string;
  city: string;
  country: string;
  date: string;
  tourName?: string;
}

export async function getNextConcert(): Promise<NextConcert | null> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const results = await fetchFromDirectus<DirectusSetlist>(
      `/setlists?filter[date][_gte]=${today}&sort=date&limit=1`
    );
    if (results.length === 0) return null;
    const s = results[0];
    return {
      venue: s.venue || 'TBA',
      city: s.city || '',
      country: s.country || '',
      date: s.date,
      tourName: s.tour_name || undefined,
    };
  } catch {
    return null;
  }
}

async function fetchAllSetlistSongs(): Promise<Map<string, SetlistSong[]>> {
  const rows = await fetchFromDirectus<any>(
    '/setlist_songs?fields=setlist,song,song_title,position,set_type,notes,is_cover&sort=setlist,position&limit=-1'
  );

  const songsBySetlist = new Map<string, SetlistSong[]>();

  rows.forEach((row: any) => {
    const setlistRaw = typeof row.setlist === 'object' && row.setlist
      ? row.setlist.id
      : row.setlist;
    if (setlistRaw === null || setlistRaw === undefined) return;

    const setlistId = setlistRaw.toString();
    const songEntry: SetlistSong = {
      song_id: row.song || undefined,
      song_title: row.song_title || undefined,
      position: row.position || 0,
      set_type: row.set_type || 'main',
      notes: row.notes || undefined,
      is_cover: row.is_cover || false,
    };

    const existing = songsBySetlist.get(setlistId) || [];
    existing.push(songEntry);
    songsBySetlist.set(setlistId, existing);
  });

  songsBySetlist.forEach((songs) => {
    songs.sort((a, b) => a.position - b.position);
  });

  return songsBySetlist;
}

// Format date for display
export function formatDate(dateString: string, options?: Intl.DateTimeFormatOptions): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  };
  return new Date(dateString).toLocaleDateString('en-US', options || defaultOptions);
}

function getTodayIsoDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function isUpcomingSetlistDate(date?: string): boolean {
  return Boolean(date && date > getTodayIsoDate());
}

export function filterPastSetlists<T extends { date?: string }>(setlists: T[]): T[] {
  const todayIso = getTodayIsoDate();
  return setlists.filter((setlist) => Boolean(setlist.date && setlist.date <= todayIso));
}

// Format a setlist
export function formatSetlist(setlist: DirectusSetlist, songsMap?: Map<number, DirectusSong>, setlistSongs?: SetlistSong[]): Setlist {
  const eventDate = setlist.date || '';
  const year = eventDate ? new Date(eventDate).getFullYear() : 0;
  const location = setlist.state_province
    ? `${setlist.city}, ${setlist.state_province}, ${setlist.country}`
    : `${setlist.city}, ${setlist.country}`;

  const slug = setlist.slug || generateSetlistSlug(setlist.venue || '', setlist.city || '', eventDate);

  // Use pre-fetched setlistSongs if provided
  const rawSongs: SetlistSong[] = setlistSongs || [];
  const songs: SetlistSongDisplay[] = rawSongs.map((song: any) => {
    const songData = song.song_id ? songsMap?.get(song.song_id) : undefined;
    const title = songData?.title || song.song_title || `Song #${song.position}`;
    return {
      songId: song.song_id,
      position: song.position,
      title,
      songSlug: title ? generateSlug(title) : undefined,
      setType: song.set_type || 'main',
      notes: song.notes,
      isCover: song.is_cover || false,
      duration: songData?.duration
    };
  }).sort((a, b) => a.position - b.position);

  const rawCoverImage = setlist.venue_image;
  const coverImage = rawCoverImage
    ? (rawCoverImage.startsWith('http') ? rawCoverImage : getAssetUrl(rawCoverImage))
    : undefined;

  return {
    id: setlist.id.toString(),
    date: eventDate,
    formattedDate: eventDate ? formatDate(eventDate) : 'Date TBA',
    year,
    venue: setlist.venue || 'Unknown Venue',
    city: setlist.city || 'Unknown City',
    country: setlist.country || '',
    location,
    tourName: setlist.tour_name,
    slug,
    notes: setlist.notes,
    source: setlist.source,
    featured: false,
    coverImage,
    songs,
    songCount: setlist.song_count || songs.length
  };
}

// Generate slug for setlist
export function generateSetlistSlug(venue: string, city: string, date: string): string {
  const dateSlug = date.split('T')[0];
  return `${venue}-${city}-${dateSlug}`
    .toLowerCase()
    .replace(/[^\w\s-]/gi, '')
    .replace(/\s+/g, '-');
}

// Get all setlists with song details
export async function getSetlistsWithSongs(): Promise<Setlist[]> {
  if (setlistsWithSongsPromise) {
    return setlistsWithSongsPromise;
  }

  setlistsWithSongsPromise = (async () => {
    const [setlists, songs, songsBySetlist] = await Promise.all([
      fetchSetlists(),
      fetchSongs(),
      fetchAllSetlistSongs()
    ]);

    const songsMap = new Map<number, DirectusSong>();
    songs.forEach((song) => songsMap.set(song.id, song));

    return setlists.map((setlist) => {
      const slSongs = songsBySetlist.get(setlist.id.toString()) || [];
      return formatSetlist(setlist, songsMap, slSongs);
    });
  })();

  try {
    return await setlistsWithSongsPromise;
  } catch (error) {
    setlistsWithSongsPromise = null;
    throw error;
  }
}

// ============================================
// BLOG
// ============================================

interface DirectusBlog {
  id: number | string;
  title: string;
  slug?: string;
  excerpt: string;
  content: string;
  featured_image?: string;
  featured?: boolean;
  category: string;
  tags?: string[];
  author_name?: string;
  author_avatar?: string;
  date_published?: string;
  reading_time?: number;
  status?: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featuredImage?: string;
  featured: boolean;
  category: string;
  tags: string[];
  authorName?: string;
  authorAvatar?: string;
  publishedDate: string;
  formattedDate: string;
  readingTime: number;
}

// Fetch all blog posts
export async function fetchBlogs(category?: string): Promise<DirectusBlog[]> {
  const filter = category
    ? `/blogs?filter[status][_eq]=published&filter[category][_eq]=${category}&sort=-date_published`
    : '/blogs?filter[status][_eq]=published&sort=-date_published';
  return fetchFromDirectus<DirectusBlog>(filter);
}

// Estimate reading time from content
export function estimateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content?.split(/\s+/).length || 0;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}

// Format a blog post
export function formatBlogPost(post: DirectusBlog): BlogPost {
  const publishedDate = post.date_published || new Date().toISOString();

  return {
    id: post.id.toString(),
    title: post.title || 'Untitled',
    slug: post.slug || generateSlug(post.title || 'untitled'),
    excerpt: post.excerpt || '',
    content: post.content || '',
    featuredImage: post.featured_image ? getAssetUrl(post.featured_image) : undefined,
    featured: post.featured || false,
    category: post.category || 'News',
    tags: post.tags || [],
    authorName: post.author_name,
    authorAvatar: post.author_avatar ? getAssetUrl(post.author_avatar) : undefined,
    publishedDate,
    formattedDate: formatDate(publishedDate),
    readingTime: post.reading_time || estimateReadingTime(post.content || post.excerpt || '')
  };
}

// Get all formatted blog posts
export async function getBlogPosts(category?: string): Promise<BlogPost[]> {
  const posts = await fetchBlogs(category);
  return posts.map(formatBlogPost);
}

// Get blog categories with counts
export async function getBlogCategories(): Promise<{ name: string; slug: string; count: number }[]> {
  const posts = await fetchBlogs();
  const categoryCounts: Record<string, number> = {};

  posts.forEach((post) => {
    const cat = (post.category || 'news').toLowerCase();
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  return Object.entries(categoryCounts)
    .map(([name, count]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      slug: name,
      count
    }))
    .sort((a, b) => b.count - a.count);
}

// ============================================
// NEWS (Enhanced Blog with categories)
// ============================================

// Fetch news posts
export async function fetchNews(category?: NewsCategory): Promise<DirectusNews[]> {
  const filter = category
    ? `/news?filter[category][_eq]=${category}&sort=-published_date`
    : '/news?sort=-published_date';
  return fetchFromDirectus<DirectusNews>(filter);
}

// Format a news post
export function formatNewsPost(post: DirectusNews): NewsPost {
  const publishedDate = (post as any).published_date || post.date_published || new Date().toISOString();

  return {
    id: post.id.toString(),
    title: post.title || 'Untitled',
    slug: post.slug || generateSlug(post.title || 'untitled'),
    excerpt: post.excerpt || '',
    content: post.content || '',
    featuredImage: post.featured_image ? getAssetUrl(post.featured_image) : undefined,
    featured: post.featured || post.is_featured || false,
    category: post.category || 'news',
    tags: post.tags || [],
    authorName: post.author_name,
    authorAvatar: post.author_avatar ? getAssetUrl(post.author_avatar) : undefined,
    publishedDate,
    formattedDate: formatDate(publishedDate),
    readingTime: post.reading_time || estimateReadingTime(post.content || post.excerpt || ''),
    rating: post.rating
  };
}

// Get all formatted news posts
export async function getNewsPosts(category?: NewsCategory): Promise<NewsPost[]> {
  const posts = await fetchNews(category);
  if (posts.length > 0) {
    return posts.map(formatNewsPost);
  }
  // Fallback to mock data
  if (category) {
    return mockNewsPosts.filter(p => p.category === category);
  }
  return mockNewsPosts;
}

// Get news categories with counts
export async function getNewsCategories(): Promise<{ name: string; slug: NewsCategory; count: number }[]> {
  const posts = await fetchNews();
  const categoryCounts: Record<string, number> = {};

  posts.forEach((post) => {
    const cat = (post.category || 'news').toLowerCase();
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  const categoryLabels: Record<string, string> = {
    news: 'News',
    reviews: 'Reviews',
    interviews: 'Interviews',
    rumors: 'Rumors',
    editorials: 'Editorials'
  };

  return Object.entries(categoryCounts)
    .map(([slug, count]) => ({
      name: categoryLabels[slug] || slug.charAt(0).toUpperCase() + slug.slice(1),
      slug: slug as NewsCategory,
      count
    }))
    .sort((a, b) => b.count - a.count);
}

// Get featured news post
export async function getFeaturedNews(): Promise<NewsPost | null> {
  const posts = await fetchNews();
  if (posts.length > 0) {
    const featured = posts.find(p => (p as any).featured || p.is_featured);
    return featured ? formatNewsPost(featured) : formatNewsPost(posts[0]);
  }
  // Fallback to mock data
  return getMockFeaturedNews();
}

// ============================================
// WIKI / HISTORY
// ============================================

// Fetch wiki articles
export async function fetchWikiArticles(type?: string): Promise<DirectusWikiArticle[]> {
  const filter = type
    ? `/wiki_articles?filter[status][_eq]=published&filter[type][_eq]=${type}&sort=-date_published`
    : '/wiki_articles?filter[status][_eq]=published&sort=-date_published';
  return fetchFromDirectus<DirectusWikiArticle>(filter);
}

// Format a wiki article
export function formatWikiArticle(article: DirectusWikiArticle): WikiArticle {
  const publishedDate = article.date_published || new Date().toISOString();

  return {
    id: article.id.toString(),
    title: article.title || 'Untitled',
    slug: article.slug || generateSlug(article.title || 'untitled'),
    content: article.content || '',
    excerpt: article.excerpt || article.content?.substring(0, 200) + '...' || '',
    type: article.type,
    featuredImage: article.featured_image ? getAssetUrl(article.featured_image) : undefined,
    relatedAlbums: (article.related_albums || []).map(String),
    relatedMembers: article.related_members || [],
    tags: article.tags || [],
    publishedDate,
    formattedDate: formatDate(publishedDate)
  };
}

// Get all wiki articles
export async function getWikiArticles(type?: string): Promise<WikiArticle[]> {
  const articles = await fetchWikiArticles(type);
  return articles.map(formatWikiArticle);
}

// Fetch wiki members
export async function fetchWikiMembers(): Promise<DirectusWikiMember[]> {
  return fetchFromDirectus<DirectusWikiMember>('/members?sort=tenure_start');
}

// Format a wiki member
export function formatWikiMember(member: DirectusWikiMember): WikiMember {
  const tenureStart = member.tenure_start ? new Date(member.tenure_start).getFullYear() : null;
  const tenureEnd = member.tenure_end ? new Date(member.tenure_end).getFullYear() : null;

  let tenure = '';
  if (tenureStart) {
    tenure = member.is_current_member
      ? `${tenureStart} - Present`
      : tenureEnd
        ? `${tenureStart} - ${tenureEnd}`
        : `${tenureStart}`;
  }

  // photo may be a plain URL (our schema) or a Directus file UUID (legacy)
  const photoRaw = member.photo as any;
  const photo = photoRaw
    ? (typeof photoRaw === 'string' && photoRaw.startsWith('http') ? photoRaw : getAssetUrl(photoRaw))
    : undefined;

  return {
    id: member.id.toString(),
    name: member.name || 'Unknown',
    slug: member.slug || generateSlug(member.name || 'unknown'),
    bio: member.bio || '',
    photo,
    birthDate: member.birth_date,
    instruments: parseJsonArray(member.instruments),
    tenureStart: member.tenure_start,
    tenureEnd: member.tenure_end || undefined,
    isCurrentMember: member.is_current_member || false,
    sideProjects: parseJsonArray(member.side_projects),
    tenure: (member as any).tenure || tenure
  };
}

// Get all wiki members
export async function getWikiMembers(): Promise<WikiMember[]> {
  const members = await fetchWikiMembers();
  return members.map(formatWikiMember);
}

// =============================================================================
// MEMBER STINTS (Band Timeline)
// =============================================================================

export async function getMemberStints(): Promise<MemberStint[]> {
  const [stints, members] = await Promise.all([
    fetchFromDirectus<DirectusMemberStint>('/member_stints?sort=start_year'),
    fetchWikiMembers(),
  ]);

  const memberMap = new Map(members.map(m => [typeof m.id === 'string' ? parseInt(m.id) : m.id, m]));

  return stints.map(s => {
    const member = memberMap.get(s.member);
    const formatted = member ? formatWikiMember(member) : null;
    return {
      id: s.id,
      memberId: s.member,
      memberName: formatted?.name || 'Unknown',
      memberSlug: formatted?.slug || 'unknown',
      memberPhoto: formatted?.photo,
      startYear: s.start_year,
      endYear: s.end_year,
      role: s.role,
      stintNumber: s.stint_number || 1,
      notes: s.notes || undefined,
    };
  });
}

// =============================================================================
// TOURS (Index page)
// =============================================================================

export async function getTours(): Promise<Tour[]> {
  const [tours, albums] = await Promise.all([
    fetchFromDirectus<DirectusTour>('/tours?sort=-start_date&limit=-1'),
    fetchAlbums(),
  ]);

  const albumMap = new Map(albums.map(a => [a.id, a]));

  return tours.map(t => {
    const album = t.associated_album ? albumMap.get(t.associated_album) : null;
    const startYear = t.start_date ? new Date(t.start_date).getFullYear() : 0;
    return {
      id: t.id,
      name: t.name,
      slug: t.slug || generateSlug(t.name),
      startDate: t.start_date,
      endDate: t.end_date,
      description: t.description,
      associatedAlbumId: t.associated_album,
      associatedAlbumTitle: album ? (album.title || undefined) : undefined,
      associatedAlbumSlug: album ? (album.slug || generateSlug(album.title)) : undefined,
      associatedAlbumCover: album?.cover_art ? `${DIRECTUS_URL}/assets/${album.cover_art}` : undefined,
      totalShows: t.total_shows || 0,
      imageUrl: t.image ? `${DIRECTUS_URL}/assets/${t.image}` : undefined,
      countriesVisited: parseJsonArray(t.countries_visited),
      supportActs: parseJsonArray(t.support_acts),
      lineup: parseJsonArray(t.lineup),
      year: startYear,
    };
  });
}

// =============================================================================
// SONG STATISTICS (for Curiosities page)
// =============================================================================

export async function getTopSongs(limit = 20): Promise<SongStats[]> {
  const stats = await getSongStatistics();
  return stats.slice(0, limit);
}

// Fetch timeline events
export async function fetchTimelineEvents(): Promise<DirectusTimelineEvent[]> {
  return fetchFromDirectus<DirectusTimelineEvent>('/timeline?sort=date');
}

// Format a timeline event
export function formatTimelineEvent(event: DirectusTimelineEvent): TimelineEvent {
  // Support both `date` (our schema) and `event_date` (legacy)
  const eventDate = (event as any).date || event.event_date || '';
  // Support stored `year` field or derive from date
  const year = (event as any).year || (eventDate ? new Date(eventDate).getFullYear() : 0);
  // Support `formatted_date` field or derive
  const formattedDate = (event as any).formatted_date ||
    (eventDate ? formatDate(eventDate) : 'Unknown Date');

  const imageRaw = event.image as any;
  const image = imageRaw
    ? (typeof imageRaw === 'string' && imageRaw.startsWith('http') ? imageRaw : getAssetUrl(imageRaw))
    : undefined;

  return {
    id: event.id.toString(),
    title: event.title || 'Untitled Event',
    description: event.description || '',
    date: eventDate,
    formattedDate,
    year,
    type: (event as any).type || event.event_type || 'other',
    relatedAlbum: (event as any).related_album?.toString() || event.related_album?.toString(),
    relatedMember: (event as any).related_member || event.related_member,
    image,
    importance: event.importance || 1
  };
}

// Get all timeline events
export async function getTimelineEvents(): Promise<TimelineEvent[]> {
  const events = await fetchTimelineEvents();
  return events.map(formatTimelineEvent);
}

// Group timeline events by decade
export function groupTimelineByDecade(events: TimelineEvent[]): Record<string, TimelineEvent[]> {
  return events.reduce((acc, event) => {
    if (!event.year) return acc;
    const decade = `${Math.floor(event.year / 10) * 10}s`;
    if (!acc[decade]) acc[decade] = [];
    acc[decade].push(event);
    return acc;
  }, {} as Record<string, TimelineEvent[]>);
}

// ============================================
// PHOTO GALLERY
// ============================================

// Fetch photos
export async function fetchPhotos(filters?: { tour?: string; album?: number; featured?: boolean }): Promise<DirectusPhoto[]> {
  let query = '/photos?sort=-date_taken';

  if (filters?.tour) {
    query += `&filter[tour][_eq]=${filters.tour}`;
  }
  if (filters?.album) {
    query += `&filter[album_slug][_eq]=${filters.album}`;
  }
  if (filters?.featured) {
    query += '&filter[is_featured][_eq]=true';
  }

  return fetchFromDirectus<DirectusPhoto>(query);
}

// Format a photo
export function formatPhoto(photo: DirectusPhoto, albumsMap?: Map<number, DirectusAlbum>): Photo {
  const album = photo.album ? albumsMap?.get(photo.album) : undefined;

  // Support plain URL (our schema: image_url) or Directus file UUID (legacy: image)
  const rawImage = (photo as any).image_url || photo.image;
  const imageUrl = rawImage
    ? (typeof rawImage === 'string' && rawImage.startsWith('http') ? rawImage : getAssetUrl(rawImage))
    : '';

  return {
    id: photo.id.toString(),
    imageUrl,
    title: photo.title || 'Untitled Photo',
    description: photo.description || '',
    dateTaken: photo.date_taken,
    formattedDate: photo.date_taken ? formatDate(photo.date_taken) : undefined,
    photographer: photo.photographer,
    source: photo.source,
    location: photo.location,
    tags: photo.tags || [],
    albumSlug: album?.slug,
    tour: photo.tour,
    event: photo.event,
    isFeatured: photo.is_featured || false,
    isFanSubmitted: photo.is_fan_submitted || false,
    submittedBy: photo.submitted_by
  };
}

// Get all photos with optional filters
export async function getPhotos(filters?: { tour?: string; album?: number; featured?: boolean }): Promise<Photo[]> {
  const [photos, albums] = await Promise.all([
    fetchPhotos(filters),
    fetchAlbums()
  ]);

  const albumsMap = new Map<number, DirectusAlbum>();
  albums.forEach(album => albumsMap.set(album.id, album));

  return photos.map(photo => formatPhoto(photo, albumsMap));
}

// Get featured photo (photo of the day)
export async function getPhotoOfTheDay(): Promise<Photo> {
  const photos = await fetchPhotos({ featured: true });
  if (photos.length === 0) {
    const allPhotos = await fetchPhotos();
    if (allPhotos.length === 0) {
      // Fallback to mock data
      return getMockPhotoOfTheDay();
    }

    // Use date as seed for deterministic selection
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const index = seed % allPhotos.length;
    return formatPhoto(allPhotos[index]);
  }

  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const index = seed % photos.length;
  return formatPhoto(photos[index]);
}

// Get unique tours from photos
export async function getPhotoTours(): Promise<string[]> {
  const photos = await fetchPhotos();
  const tours = new Set<string>();
  photos.forEach(photo => {
    if (photo.tour) tours.add(photo.tour);
  });
  return Array.from(tours).sort();
}

// ============================================
// FORUMS / COMMUNITY
// ============================================

// Fetch forum categories
export async function fetchForumCategories(): Promise<DirectusForumCategory[]> {
  return fetchFromDirectus<DirectusForumCategory>('/forum_categories?sort=sort_order');
}

// Format a forum category
export function formatForumCategory(category: DirectusForumCategory): ForumCategory {
  return {
    id: category.id.toString(),
    name: category.name || 'Unnamed Category',
    slug: category.slug || generateSlug(category.name || 'unnamed'),
    description: category.description || '',
    icon: category.icon,
    threadCount: category.thread_count || 0,
    postCount: category.post_count || 0,
    lastPostId: category.last_post_id
  };
}

// Get all forum categories
export async function getForumCategories(): Promise<ForumCategory[]> {
  const categories = await fetchForumCategories();
  return categories.map(formatForumCategory);
}

// Fetch forum threads
export async function fetchForumThreads(categoryId?: string): Promise<DirectusForumThread[]> {
  const filter = categoryId
    ? `/forum_threads?filter[category_id][_eq]=${categoryId}&sort=-is_pinned,-last_reply_at`
    : '/forum_threads?sort=-is_pinned,-last_reply_at';
  return fetchFromDirectus<DirectusForumThread>(filter);
}

// Fetch forum users for mapping
export async function fetchForumUsers(): Promise<DirectusForumUser[]> {
  return fetchFromDirectus<DirectusForumUser>('/forum_users');
}

// Format a forum user
export function formatForumUser(user: DirectusForumUser): ForumUser {
  return {
    id: user.id.toString(),
    username: user.username || 'anonymous',
    displayName: user.display_name || user.username || 'Anonymous',
    avatar: user.avatar ? getAssetUrl(user.avatar) : undefined,
    bio: user.bio,
    location: user.location,
    joinDate: user.join_date || new Date().toISOString(),
    postCount: user.post_count || 0,
    reputation: user.reputation || 0,
    role: user.role || 'member',
    isBanned: user.is_banned || false,
    lastActive: user.last_active
  };
}

// Format a forum thread
export function formatForumThread(
  thread: DirectusForumThread,
  usersMap?: Map<string, DirectusForumUser>,
  categoriesMap?: Map<string, DirectusForumCategory>
): ForumThread {
  const author = usersMap?.get(thread.author_id);
  const category = categoriesMap?.get(thread.category_id);
  const createdAt = thread.date_created || new Date().toISOString();

  return {
    id: thread.id.toString(),
    title: thread.title || 'Untitled Thread',
    slug: thread.slug || generateSlug(thread.title || 'untitled'),
    categoryId: thread.category_id,
    categoryName: category?.name,
    author: author ? formatForumUser(author) : {
      id: thread.author_id,
      username: 'unknown',
      displayName: 'Unknown User',
      joinDate: new Date().toISOString(),
      postCount: 0,
      reputation: 0,
      role: 'member',
      isBanned: false
    },
    content: thread.content || '',
    isPinned: thread.is_pinned || false,
    isLocked: thread.is_locked || false,
    viewCount: thread.view_count || 0,
    replyCount: thread.reply_count || 0,
    lastReplyAt: thread.last_reply_at,
    lastReplyBy: thread.last_reply_by,
    createdAt,
    formattedDate: formatDate(createdAt)
  };
}

// Get forum threads with user data
export async function getForumThreads(categoryId?: string): Promise<ForumThread[]> {
  const [threads, users, categories] = await Promise.all([
    fetchForumThreads(categoryId),
    fetchForumUsers(),
    fetchForumCategories()
  ]);

  const usersMap = new Map<string, DirectusForumUser>();
  users.forEach(user => usersMap.set(user.id.toString(), user));

  const categoriesMap = new Map<string, DirectusForumCategory>();
  categories.forEach(cat => categoriesMap.set(cat.id.toString(), cat));

  return threads.map(thread => formatForumThread(thread, usersMap, categoriesMap));
}

// Fetch posts for a thread
export async function fetchForumPosts(threadId: string): Promise<DirectusForumPost[]> {
  return fetchFromDirectus<DirectusForumPost>(`/forum_posts?filter[thread_id][_eq]=${threadId}&sort=date_created`);
}

// Format a forum post
export function formatForumPost(post: DirectusForumPost, usersMap?: Map<string, DirectusForumUser>): ForumPost {
  const author = usersMap?.get(post.author_id);
  const createdAt = post.date_created || new Date().toISOString();

  return {
    id: post.id.toString(),
    threadId: post.thread_id,
    author: author ? formatForumUser(author) : {
      id: post.author_id,
      username: 'unknown',
      displayName: 'Unknown User',
      joinDate: new Date().toISOString(),
      postCount: 0,
      reputation: 0,
      role: 'member',
      isBanned: false
    },
    content: post.content || '',
    isSolution: post.is_solution || false,
    reactions: post.reactions || { like: 0, love: 0, insightful: 0 },
    createdAt,
    formattedDate: formatDate(createdAt)
  };
}

// Get posts for a thread with user data
export async function getForumPosts(threadId: string): Promise<ForumPost[]> {
  const [posts, users] = await Promise.all([
    fetchForumPosts(threadId),
    fetchForumUsers()
  ]);

  const usersMap = new Map<string, DirectusForumUser>();
  users.forEach(user => usersMap.set(user.id.toString(), user));

  return posts.map(post => formatForumPost(post, usersMap));
}

// ============================================
// STATS & STATISTICS
// ============================================

// Calculate song statistics from setlists
export async function getSongStatistics(): Promise<SongStats[]> {
  if (songStatsPromise) {
    return songStatsPromise;
  }

  songStatsPromise = (async () => {
    const [setlists, songs, albums] = await Promise.all([
      getSetlistsWithSongs(),
      fetchSongs(),
      fetchAlbums()
    ]);

    const songIdBySlug = new Map<string, number>();
    songs.forEach((song) => {
      songIdBySlug.set(generateSlug(song.title), song.id);
    });

    const songStatsMap = new Map<number, {
      plays: number;
      firstPlayed?: string;
      lastPlayed?: string;
      years: Map<number, number>;
      tours: Map<string, number>;
    }>();

    setlists.forEach((setlist) => {
      setlist.songs.forEach((song) => {
        const fallbackSongId = song.songSlug ? songIdBySlug.get(song.songSlug) : songIdBySlug.get(generateSlug(song.title));
        const songId = song.songId || fallbackSongId;
        if (!songId) return;

        const existing = songStatsMap.get(songId) || {
          plays: 0,
          years: new Map<number, number>(),
          tours: new Map<string, number>()
        };

        existing.plays += 1;

        if (!existing.firstPlayed || setlist.date < existing.firstPlayed) {
          existing.firstPlayed = setlist.date;
        }
        if (!existing.lastPlayed || setlist.date > existing.lastPlayed) {
          existing.lastPlayed = setlist.date;
        }

        if (setlist.year > 0) {
          existing.years.set(setlist.year, (existing.years.get(setlist.year) || 0) + 1);
        }

        if (setlist.tourName) {
          existing.tours.set(setlist.tourName, (existing.tours.get(setlist.tourName) || 0) + 1);
        }

        songStatsMap.set(songId, existing);
      });
    });

    const albumMap = new Map<number, DirectusAlbum>();
    albums.forEach((album) => albumMap.set(album.id, album));

    const stats: SongStats[] = songs.map((song) => {
      const songData = songStatsMap.get(song.id);
      const album = albumMap.get(song.album);

      return {
        songId: song.id,
        songTitle: song.title,
        songSlug: generateSlug(song.title),
        albumTitle: album?.title || 'Unknown Album',
        totalPlays: songData?.plays || 0,
        firstPlayed: songData?.firstPlayed,
        lastPlayed: songData?.lastPlayed,
        yearsPlayed: songData
          ? Array.from(songData.years.entries())
              .map(([year, count]) => ({ year, count }))
              .sort((a, b) => a.year - b.year)
          : [],
        toursPlayed: songData
          ? Array.from(songData.tours.entries())
              .map(([tour, count]) => ({ tour, count }))
              .sort((a, b) => b.count - a.count)
          : []
      };
    });

    return stats.sort((a, b) => b.totalPlays - a.totalPlays);
  })();

  try {
    return await songStatsPromise;
  } catch (error) {
    songStatsPromise = null;
    throw error;
  }
}

// Get most played songs
export async function getMostPlayedSongs(limit: number = 10): Promise<SongStats[]> {
  const stats = await getSongStatistics();
  return stats.filter(s => s.totalPlays > 0).slice(0, limit);
}

// Get rarest songs (played at least once)
export async function getRarestSongs(limit: number = 10): Promise<SongStats[]> {
  const stats = await getSongStatistics();
  return stats
    .filter(s => s.totalPlays > 0)
    .sort((a, b) => a.totalPlays - b.totalPlays)
    .slice(0, limit);
}

// Get tour statistics
export async function getTourStatistics(): Promise<TourStats[]> {
  const setlists = filterPastSetlists(await getSetlistsWithSongs());

  const tourMap = new Map<string, {
    year: number;
    shows: number;
    countries: Set<string>;
    totalSongs: number;
    uniqueSongs: Set<string>;
  }>();

  setlists.forEach(setlist => {
    if (!setlist.tourName) return;

    const existing = tourMap.get(setlist.tourName) || {
      year: setlist.year || 0,
      shows: 0,
      countries: new Set(),
      totalSongs: 0,
      uniqueSongs: new Set()
    };

    existing.shows++;
    if (setlist.year > 0 && (existing.year === 0 || setlist.year < existing.year)) {
      existing.year = setlist.year;
    }
    if (setlist.country) {
      existing.countries.add(setlist.country);
    }
    existing.totalSongs += setlist.songCount || setlist.songs.length;
    setlist.songs.forEach(song => existing.uniqueSongs.add(song.title.toLowerCase().trim()));

    tourMap.set(setlist.tourName, existing);
  });

  return Array.from(tourMap.entries()).map(([name, data]) => ({
    name,
    year: data.year,
    totalShows: data.shows,
    countries: Array.from(data.countries),
    totalSongsPlayed: data.totalSongs,
    uniqueSongs: data.uniqueSongs.size,
    averageSongsPerShow: Math.round(data.totalSongs / data.shows)
  })).sort((a, b) => b.totalShows - a.totalShows);
}

// Get overall statistics
export async function getOverallStats(): Promise<OverallStats> {
  const [albums, songs, setlists, songStats] = await Promise.all([
    fetchAlbums(),
    fetchSongs(),
    getSetlistsWithSongs(),
    getSongStatistics()
  ]);

  const historicalSetlists = filterPastSetlists(setlists);

  const countries = new Set<string>();
  let totalSongsPlayed = 0;

  historicalSetlists.forEach(setlist => {
    if (setlist.country) {
      countries.add(setlist.country);
    }
    totalSongsPlayed += setlist.songCount || setlist.songs.length;
  });

  const fallbackSongStat: SongStats = {
    songId: 0,
    songTitle: 'N/A',
    songSlug: 'na',
    albumTitle: 'N/A',
    totalPlays: 0,
    yearsPlayed: [],
    toursPlayed: []
  };
  const mostPlayed = songStats.find(s => s.totalPlays > 0) || songStats[0] || fallbackSongStat;
  const rarest = songStats.filter(s => s.totalPlays > 0).sort((a, b) => a.totalPlays - b.totalPlays)[0] || songStats[0] || fallbackSongStat;

  return {
    totalAlbums: albums.length,
    totalSongs: songs.length,
    totalShows: historicalSetlists.length,
    countriesVisited: countries.size,
    yearsActive: new Date().getFullYear() - 1976 + 1,
    averageSongsPerShow: historicalSetlists.length > 0 ? Math.round(totalSongsPlayed / historicalSetlists.length) : 0,
    mostPlayedSong: mostPlayed,
    rarestSong: rarest
  };
}

// ============================================
// ALBUM HELPERS (Enhanced)
// ============================================

// Get album era based on release year
export function getAlbumEra(releaseDate?: string): AlbumEra {
  if (!releaseDate) return 'modern';
  const year = new Date(releaseDate).getFullYear();

  if (year <= 1982) return 'early';
  if (year <= 1987) return 'pop';
  if (year <= 1992) return 'classic';
  if (year <= 2000) return 'experimental';
  return 'modern';
}

// Get albums by era
export async function getAlbumsByEra(era: AlbumEra): Promise<Album[]> {
  const albums = await fetchAlbums();
  return albums
    .filter(album => {
      const albumEra = album.era || getAlbumEra(album.release_date);
      return albumEra === era;
    })
    .map(formatAlbum);
}

// Get albums by type
export async function getAlbumsByType(type: AlbumType): Promise<Album[]> {
  const albums = await fetchAlbums();
  return albums
    .filter(album => album.type === type)
    .map(formatAlbum);
}

// Era metadata
export const eraMetadata: Record<AlbumEra, { name: string; years: string; description: string }> = {
  early: {
    name: 'Early Years',
    years: '1978-1982',
    description: 'Post-punk origins and gothic beginnings'
  },
  pop: {
    name: 'Pop Era',
    years: '1983-1987',
    description: 'Chart success and new wave experimentation'
  },
  classic: {
    name: 'Classic Era',
    years: '1988-1992',
    description: 'Critical acclaim and commercial peak'
  },
  experimental: {
    name: 'Experimental',
    years: '1993-2000',
    description: 'Genre exploration and sonic evolution'
  },
  modern: {
    name: 'Modern Era',
    years: '2001-Present',
    description: 'Legacy and continued creativity'
  }
};

// =============================================================================
// SOURCES / ATTRIBUTION
// =============================================================================

export async function getSources(): Promise<Source[]> {
  const data = await fetchFromDirectus<DirectusSource>('/sources?sort=name');
  return data.map(formatSource);
}

export async function getSourceById(id: number): Promise<Source | null> {
  try {
    const response = await fetch(`${API_BASE}/sources/${id}`, {
      headers: { 'Authorization': `Bearer ${DIRECTUS_TOKEN}` },
    });
    if (!response.ok) return null;
    const json = await response.json();
    return formatSource(json.data);
  } catch {
    return null;
  }
}

function formatSource(s: DirectusSource): Source {
  return {
    id: s.id,
    name: s.name,
    type: (s.type as SourceType) || 'other',
    url: s.url || undefined,
    author: s.author || undefined,
    description: s.description || undefined,
    logoUrl: s.logo ? `${DIRECTUS_URL}/assets/${s.logo}` : undefined,
    isOfficial: s.is_official ?? false,
    reliability: s.reliability ?? 3,
  };
}

// =============================================================================
// VIDEOS
// =============================================================================

export async function getVideos(type?: VideoType): Promise<Video[]> {
  let endpoint = '/videos?sort=-date&limit=100';
  if (type) endpoint += `&filter[type][_eq]=${type}`;
  const data = await fetchFromDirectus<DirectusVideo>(endpoint);
  return data.map(formatVideo);
}

export async function getFeaturedVideos(): Promise<Video[]> {
  const data = await fetchFromDirectus<DirectusVideo>('/videos?filter[is_featured][_eq]=true&sort=-date&limit=10');
  return data.map(formatVideo);
}

export async function getVideosByAlbum(albumId: number): Promise<Video[]> {
  const data = await fetchFromDirectus<DirectusVideo>(`/videos?filter[album][_eq]=${albumId}&sort=-date`);
  return data.map(formatVideo);
}

function formatVideo(v: DirectusVideo): Video {
  return {
    id: v.id,
    title: v.title,
    slug: v.slug || v.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    videoUrl: v.video_url,
    embedId: v.embed_id || extractYouTubeId(v.video_url),
    thumbnailUrl: v.thumbnail ? `${DIRECTUS_URL}/assets/${v.thumbnail}` : v.embed_id ? `https://img.youtube.com/vi/${v.embed_id}/hqdefault.jpg` : undefined,
    type: (v.type as VideoType) || 'other',
    description: v.description || undefined,
    date: v.date || undefined,
    formattedDate: v.date ? new Date(v.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : undefined,
    duration: v.duration || undefined,
    songId: v.song || undefined,
    albumId: v.album || undefined,
    setlistId: v.setlist || undefined,
    director: v.director || undefined,
    isFeatured: v.is_featured ?? false,
    viewCount: v.view_count || undefined,
    sourceUrl: v.source_url || undefined,
  };
}

function extractYouTubeId(url: string): string | undefined {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([a-zA-Z0-9_-]{11})/);
  return match?.[1];
}

// =============================================================================
// POLLS
// =============================================================================

export async function getActivePolls(): Promise<Poll[]> {
  const data = await fetchFromDirectus<DirectusPoll>('/polls?filter[status][_in]=active,featured&sort=-start_date');
  const polls: Poll[] = [];
  for (const poll of data) {
    const options = await fetchFromDirectus<DirectusPollOption>(`/poll_options?filter[poll][_eq]=${poll.id}&sort=sort_order`);
    polls.push(formatPoll(poll, options));
  }
  return polls;
}

export async function getFeaturedPoll(): Promise<Poll | null> {
  const data = await fetchFromDirectus<DirectusPoll>('/polls?filter[status][_eq]=featured&limit=1');
  if (data.length === 0) {
    const active = await fetchFromDirectus<DirectusPoll>('/polls?filter[status][_eq]=active&sort=-start_date&limit=1');
    if (active.length === 0) return null;
    const options = await fetchFromDirectus<DirectusPollOption>(`/poll_options?filter[poll][_eq]=${active[0].id}&sort=sort_order`);
    return formatPoll(active[0], options);
  }
  const options = await fetchFromDirectus<DirectusPollOption>(`/poll_options?filter[poll][_eq]=${data[0].id}&sort=sort_order`);
  return formatPoll(data[0], options);
}

export async function votePoll(optionId: number): Promise<boolean> {
  try {
    // Increment vote count on the option
    const response = await fetch(`${API_BASE}/poll_options/${optionId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${DIRECTUS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ vote_count: { _inc: 1 } }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function formatPoll(p: DirectusPoll, options: DirectusPollOption[]): Poll {
  const totalVotes = options.reduce((sum, o) => sum + (o.vote_count || 0), 0);
  return {
    id: p.id,
    question: p.question,
    slug: p.slug || `poll-${p.id}`,
    description: p.description || undefined,
    type: (p.type as PollStatus) ? p.type! : 'single' as any,
    status: (p.status as PollStatus) || 'draft',
    startDate: p.start_date || undefined,
    endDate: p.end_date || undefined,
    totalVotes,
    category: p.category || undefined,
    options: options.map(o => ({
      id: o.id,
      label: o.label,
      imageUrl: o.image ? `${DIRECTUS_URL}/assets/${o.image}` : undefined,
      voteCount: o.vote_count || 0,
      percentage: totalVotes > 0 ? Math.round(((o.vote_count || 0) / totalVotes) * 100) : 0,
    })),
  };
}

// =============================================================================
// DID YOU KNOW / TRIVIA
// =============================================================================

export async function getDidYouKnowFacts(limit = 20): Promise<DidYouKnow[]> {
  const data = await fetchFromDirectus<DirectusDidYouKnow>(`/did_you_know?filter[is_verified][_eq]=true&sort=-is_featured&limit=${limit}`);
  return data.map(formatFact);
}

export async function getRandomFact(): Promise<DidYouKnow | null> {
  const data = await fetchFromDirectus<DirectusDidYouKnow>('/did_you_know?filter[is_verified][_eq]=true');
  if (data.length === 0) return null;
  const random = data[Math.floor(Math.random() * data.length)];
  return formatFact(random);
}

function formatFact(f: DirectusDidYouKnow): DidYouKnow {
  return {
    id: f.id,
    fact: f.fact,
    category: f.category || undefined,
    sourceDetail: f.source_detail || undefined,
    isVerified: f.is_verified ?? false,
  };
}

// =============================================================================
// ALBUM PERSONNEL
// =============================================================================

export async function getAlbumPersonnel(albumId: number): Promise<AlbumPersonnel[]> {
  const data = await fetchFromDirectus<DirectusAlbumPersonnel>(`/album_personnel?filter[album][_eq]=${albumId}&fields=*,member.name,member.slug`);
  return data.map(formatPersonnel);
}

function formatPersonnel(p: DirectusAlbumPersonnel): AlbumPersonnel {
  const member = typeof p.member === 'object' && p.member ? (p.member as unknown as { name: string; slug: string }) : null;
  return {
    id: p.id,
    name: member?.name || p.musician_name || 'Unknown',
    role: p.role || 'Musician',
    isGuest: p.is_guest ?? false,
    memberSlug: member?.slug || undefined,
  };
}

// =============================================================================
// SITE STATS (Visitor Tracking)
// =============================================================================

export async function getSiteStats(): Promise<SiteStats> {
  try {
    const response = await fetch(`${API_BASE}/site_stats`, {
      headers: { 'Authorization': `Bearer ${DIRECTUS_TOKEN}` },
    });
    if (!response.ok) throw new Error('Failed to fetch site stats');
    const json = await response.json();
    const d = json.data;
    return {
      totalVisits: d?.total_visits || 0,
      todayVisits: d?.today_visits || 0,
      todayPeak: d?.today_peak || 0,
      currentlyOnline: d?.currently_online || 0,
    };
  } catch {
    return { totalVisits: 0, todayVisits: 0, todayPeak: 0, currentlyOnline: 0 };
  }
}
