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
  NewsCategory
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
  return fetchFromDirectus<DirectusSetlist>('/setlists?sort=-date');
}

// Fetch songs for a specific setlist from the setlist_songs junction collection
async function fetchSetlistSongs(setlistId: number | string): Promise<SetlistSong[]> {
  const rows = await fetchFromDirectus<any>(`/setlist_songs?filter[setlist][_eq]=${setlistId}&sort=position&limit=100`);
  return rows.map((r: any) => ({
    song_id: r.song || 0,
    position: r.position || 0,
    set_type: r.set_type || 'main',
    notes: r.notes,
    is_cover: false,
    // Carry the denormalised title for easy lookup
    _song_title: r.song_title,
  }));
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
export function formatSetlist(setlist: DirectusSetlist, songsMap?: Map<number, DirectusSong>, setlistSongs?: SetlistSong[]): Setlist {
  // Support both `date` (our schema) and `event_date` (legacy schema)
  const eventDate = (setlist as any).date || setlist.event_date || '';
  const year = eventDate ? new Date(eventDate).getFullYear() : 0;
  const location = setlist.state_province
    ? `${setlist.city}, ${setlist.state_province}, ${setlist.country}`
    : `${setlist.city}, ${setlist.country}`;

  const slug = setlist.slug || generateSetlistSlug(setlist.venue || '', setlist.city || '', eventDate);

  // Use pre-fetched setlistSongs if provided, otherwise fall back to embedded songs
  const rawSongs: SetlistSong[] = setlistSongs || setlist.songs || [];
  const songs: SetlistSongDisplay[] = rawSongs.map((song: any) => {
    const songData = song.song_id ? songsMap?.get(song.song_id) : undefined;
    const title = songData?.title || song._song_title || `Song #${song.song_id}`;
    return {
      position: song.position,
      title,
      songSlug: title ? generateSlug(title) : undefined,
      setType: song.set_type || 'main',
      notes: song.notes,
      isCover: song.is_cover || false,
      duration: songData?.duration
    };
  }).sort((a, b) => a.position - b.position);

  // Support both `venue_image` (our schema) and `cover_image` (legacy)
  const rawCoverImage = (setlist as any).venue_image || setlist.cover_image;
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
    tourLeg: setlist.tour_leg,
    slug,
    notes: setlist.notes,
    featured: setlist.featured || false,
    coverImage,
    songs,
    songCount: (setlist as any).song_count || songs.length
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

  // Fetch setlist_songs for the most recent setlists (limit to avoid hammering the API)
  const recentSetlists = setlists.slice(0, 10);
  const songsBySetlist = new Map<string, SetlistSong[]>();

  await Promise.all(
    recentSetlists.map(async (setlist) => {
      const slSongs = await fetchSetlistSongs(setlist.id);
      songsBySetlist.set(setlist.id.toString(), slSongs);
    })
  );

  return setlists.map((setlist) => {
    const slSongs = songsBySetlist.get(setlist.id.toString());
    return formatSetlist(setlist, songsMap, slSongs);
  });
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
    instruments: member.instruments || [],
    tenureStart: member.tenure_start,
    tenureEnd: member.tenure_end || undefined,
    isCurrentMember: member.is_current_member || false,
    sideProjects: member.side_projects || [],
    tenure: (member as any).tenure || tenure
  };
}

// Get all wiki members
export async function getWikiMembers(): Promise<WikiMember[]> {
  const members = await fetchWikiMembers();
  return members.map(formatWikiMember);
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
  const [setlists, songs] = await Promise.all([
    getSetlistsWithSongs(),
    fetchSongs()
  ]);

  const songStatsMap = new Map<number, {
    plays: number;
    firstPlayed?: string;
    lastPlayed?: string;
    years: Map<number, number>;
    tours: Map<string, number>;
  }>();

  // Process setlists to build stats
  setlists.forEach(setlist => {
    setlist.songs.forEach(song => {
      // We need to find the song ID from the title
      const matchedSong = songs.find(s =>
        generateSlug(s.title) === song.songSlug || s.title === song.title
      );
      if (!matchedSong) return;

      const existing = songStatsMap.get(matchedSong.id) || {
        plays: 0,
        years: new Map(),
        tours: new Map()
      };

      existing.plays++;

      if (!existing.firstPlayed || setlist.date < existing.firstPlayed) {
        existing.firstPlayed = setlist.date;
      }
      if (!existing.lastPlayed || setlist.date > existing.lastPlayed) {
        existing.lastPlayed = setlist.date;
      }

      existing.years.set(setlist.year, (existing.years.get(setlist.year) || 0) + 1);

      if (setlist.tourName) {
        existing.tours.set(setlist.tourName, (existing.tours.get(setlist.tourName) || 0) + 1);
      }

      songStatsMap.set(matchedSong.id, existing);
    });
  });

  // Get album info for songs
  const albums = await fetchAlbums();
  const albumMap = new Map<number, DirectusAlbum>();
  albums.forEach(album => albumMap.set(album.id, album));

  // Convert to array format
  const stats: SongStats[] = [];

  songs.forEach(song => {
    const songData = songStatsMap.get(song.id);
    const album = albumMap.get(song.album);

    stats.push({
      songId: song.id,
      songTitle: song.title,
      songSlug: generateSlug(song.title),
      albumTitle: album?.title || 'Unknown Album',
      totalPlays: songData?.plays || 0,
      firstPlayed: songData?.firstPlayed,
      lastPlayed: songData?.lastPlayed,
      yearsPlayed: songData
        ? Array.from(songData.years.entries()).map(([year, count]) => ({ year, count })).sort((a, b) => a.year - b.year)
        : [],
      toursPlayed: songData
        ? Array.from(songData.tours.entries()).map(([tour, count]) => ({ tour, count })).sort((a, b) => b.count - a.count)
        : []
    });
  });

  return stats.sort((a, b) => b.totalPlays - a.totalPlays);
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
  const setlists = await getSetlistsWithSongs();

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
      year: setlist.year,
      shows: 0,
      countries: new Set(),
      totalSongs: 0,
      uniqueSongs: new Set()
    };

    existing.shows++;
    existing.countries.add(setlist.country);
    existing.totalSongs += setlist.songCount;
    setlist.songs.forEach(song => existing.uniqueSongs.add(song.title));

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
  })).sort((a, b) => b.year - a.year);
}

// Get overall statistics
export async function getOverallStats(): Promise<OverallStats> {
  const [albums, songs, setlists, songStats] = await Promise.all([
    fetchAlbums(),
    fetchSongs(),
    getSetlistsWithSongs(),
    getSongStatistics()
  ]);

  const countries = new Set<string>();
  let totalSongsPlayed = 0;

  setlists.forEach(setlist => {
    countries.add(setlist.country);
    totalSongsPlayed += setlist.songCount;
  });

  const mostPlayed = songStats.find(s => s.totalPlays > 0) || songStats[0];
  const rarest = songStats.filter(s => s.totalPlays > 0).sort((a, b) => a.totalPlays - b.totalPlays)[0] || songStats[0];

  return {
    totalAlbums: albums.length,
    totalSongs: songs.length,
    totalShows: setlists.length,
    countriesVisited: countries.size,
    yearsActive: new Date().getFullYear() - 1976,
    averageSongsPerShow: setlists.length > 0 ? Math.round(totalSongsPlayed / setlists.length) : 0,
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
