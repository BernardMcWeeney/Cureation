// Directus API utility functions
import type {
  DirectusAlbum,
  DirectusSong,
  DirectusSingle,
  Album,
  Track,
  Single,
  Song,
  SongWithAlbum,
  LyricPart
} from '../types/directus';

const DIRECTUS_URL = 'https://dash.cureation.net';
const API_BASE = `${DIRECTUS_URL}/items`;

// Generic fetch wrapper with error handling
async function fetchFromDirectus<T>(endpoint: string): Promise<T[]> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`);
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

// Slug generator
export function generateSlug(title: string): string {
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
    featured: album.featured || false
  };
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

// Format lyrics into structured parts
export function formatLyrics(lyrics: string | undefined): LyricPart[] | null {
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
    lyrics: formatLyrics(song.lyrics),
    listenLinks: song.listen_links || [],
    credits: song.credits,
    hasLyrics: !!song.lyrics
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
export function getSongOfTheDay(songs: SongWithAlbum[]): SongWithAlbum | null {
  const songsWithLyrics = songs.filter((s) => s.hasLyrics);
  if (songsWithLyrics.length === 0) return null;

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
  event_date: string;
  venue: string;
  city: string;
  country: string;
  state_province?: string;
  tour_name?: string;
  tour_leg?: string;
  slug?: string;
  notes?: string;
  featured?: boolean;
  cover_image?: string;
  songs?: SetlistSong[];
  status?: string;
}

interface SetlistSong {
  song_id: number;
  position: number;
  set_type: 'main' | 'encore' | 'encore2' | 'acoustic';
  notes?: string;
  is_cover?: boolean;
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
  tourLeg?: string;
  slug: string;
  notes?: string;
  featured: boolean;
  coverImage?: string;
  songs: SetlistSongDisplay[];
  songCount: number;
}

export interface SetlistSongDisplay {
  position: number;
  title: string;
  songSlug?: string;
  setType: 'main' | 'encore' | 'encore2' | 'acoustic';
  notes?: string;
  isCover: boolean;
  duration?: string;
}

// Fetch all setlists
export async function fetchSetlists(): Promise<DirectusSetlist[]> {
  return fetchFromDirectus<DirectusSetlist>('/setlists?filter[status][_eq]=published&sort=-event_date');
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

// Format a setlist
export function formatSetlist(setlist: DirectusSetlist, songsMap?: Map<number, DirectusSong>): Setlist {
  const eventDate = setlist.event_date || '';
  const year = eventDate ? new Date(eventDate).getFullYear() : 0;
  const location = setlist.state_province
    ? `${setlist.city}, ${setlist.state_province}, ${setlist.country}`
    : `${setlist.city}, ${setlist.country}`;

  const slug = setlist.slug || generateSetlistSlug(setlist.venue || '', setlist.city || '', eventDate);

  const songs: SetlistSongDisplay[] = (setlist.songs || []).map((song) => {
    const songData = songsMap?.get(song.song_id);
    return {
      position: song.position,
      title: songData?.title || `Song #${song.song_id}`,
      songSlug: songData?.title ? generateSlug(songData.title) : undefined,
      setType: song.set_type || 'main',
      notes: song.notes,
      isCover: song.is_cover || false,
      duration: songData?.duration
    };
  }).sort((a, b) => a.position - b.position);

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
    tourLeg: setlist.tour_leg,
    slug,
    notes: setlist.notes,
    featured: setlist.featured || false,
    coverImage: setlist.cover_image ? getAssetUrl(setlist.cover_image) : undefined,
    songs,
    songCount: songs.length
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
  const [setlists, songs] = await Promise.all([fetchSetlists(), fetchSongs()]);

  const songsMap = new Map<number, DirectusSong>();
  songs.forEach((song) => songsMap.set(song.id, song));

  return setlists.map((setlist) => formatSetlist(setlist, songsMap));
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
