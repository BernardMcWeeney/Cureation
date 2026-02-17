// TypeScript interfaces for Directus CMS data

// =============================================================================
// ALBUM TYPES
// =============================================================================

export type AlbumEra = 'early' | 'pop' | 'classic' | 'experimental' | 'modern';
export type AlbumType = 'studio' | 'live' | 'compilation' | 'ep' | 'single';

export interface DirectusAlbum {
  id: number;
  title: string;
  slug?: string;
  release_date?: string;
  cover_art?: string;
  label?: string;
  producer?: string;
  description?: string;
  background_text?: string;
  critical_reception?: string;
  featured?: boolean;
  era?: AlbumEra;
  type?: AlbumType;
  spotify_id?: string;
  apple_music_id?: string;
  bandcamp_url?: string;
}

// =============================================================================
// SONG TYPES
// =============================================================================

export interface LyricAnnotation {
  line: number;
  text: string;
  author?: string;
  date_created?: string;
}

export interface SongVersion {
  type: 'album' | 'demo' | 'live' | 'acoustic' | 'remix';
  source: string;
  notes?: string;
  year?: number;
}

export interface DirectusSong {
  id: number;
  title: string;
  album: number;
  track_number?: number;
  duration?: string;
  lyrics?: string;
  listen_links?: ListenLink[];
  credits?: string;
  annotations?: LyricAnnotation[];
  versions?: SongVersion[];
  first_played?: string;
  last_played?: string;
  times_played?: number;
}

export interface DirectusSingle {
  id: number;
  title: string;
  album: number;
  release_date?: string;
  chart_position?: ChartPosition[];
}

export interface ListenLink {
  Platform: string;
  Link: string;
}

export interface ChartPosition {
  chart_position: number;
  country: string;
}

// Formatted/processed types for use in components

export interface Album {
  id: string;
  title: string;
  slug: string;
  year: string;
  coverImage: string;
  releaseDate: string;
  recordLabel: string;
  producer: string;
  description: string;
  background: string;
  reception: string;
  featured: boolean;
  tracks?: Track[];
  singles?: Single[];
}

export interface Track {
  number: number;
  title: string;
  slug: string;
  duration: string;
  listenLink?: string;
}

export interface Single {
  title: string;
  releaseDate: string;
  chartPositions: ChartPosition[];
}

export interface Song {
  id: number;
  title: string;
  trackNumber: number;
  duration: string;
  lyrics: LyricPart[] | null;
  listenLinks: ListenLink[];
  credits?: string;
  hasLyrics: boolean;
}

export interface LyricPart {
  type: 'section' | 'verse';
  content: string;
}

export interface SongWithAlbum extends Song {
  albumId: number;
  albumTitle: string;
  albumSlug: string;
  albumCover: string;
  year: string;
}

// =============================================================================
// WIKI / HISTORY TYPES
// =============================================================================

export type WikiArticleType = 'timeline_event' | 'member' | 'side_project' | 'article' | 'gear' | 'lore';

export interface DirectusWikiArticle {
  id: number | string;
  title: string;
  slug?: string;
  content: string;
  excerpt?: string;
  type: WikiArticleType;
  featured_image?: string;
  related_albums?: number[];
  related_members?: string[];
  tags?: string[];
  status?: 'draft' | 'published';
  date_published?: string;
  date_updated?: string;
  date_created?: string;
}

export interface WikiArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  type: WikiArticleType;
  featuredImage?: string;
  relatedAlbums: string[];
  relatedMembers: string[];
  tags: string[];
  publishedDate: string;
  formattedDate: string;
}

export interface DirectusWikiMember {
  id: number | string;
  name: string;
  slug?: string;
  bio?: string;
  photo?: string;
  birth_date?: string;
  instruments?: string[];
  tenure_start?: string;
  tenure_end?: string;
  is_current_member?: boolean;
  side_projects?: string[];
  status?: 'draft' | 'published';
}

export interface WikiMember {
  id: string;
  name: string;
  slug: string;
  bio: string;
  photo?: string;
  birthDate?: string;
  instruments: string[];
  tenureStart?: string;
  tenureEnd?: string;
  isCurrentMember: boolean;
  sideProjects: string[];
  tenure: string;
}

export type TimelineEventType = 'release' | 'tour' | 'member_change' | 'award' | 'milestone' | 'other';

export interface DirectusTimelineEvent {
  id: number | string;
  title: string;
  description?: string;
  event_date: string;
  event_type: TimelineEventType;
  related_album?: number;
  related_member?: string;
  image?: string;
  importance?: number;
}

export interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  formattedDate: string;
  year: number;
  type: TimelineEventType;
  relatedAlbum?: string;
  relatedMember?: string;
  image?: string;
  importance: number;
}

// =============================================================================
// PHOTO GALLERY TYPES
// =============================================================================

export type PhotoTag = 'live' | 'studio' | 'candid' | 'promotional' | 'fan' | 'press' | 'backstage';

export interface DirectusPhoto {
  id: number | string;
  image: string;
  title?: string;
  description?: string;
  date_taken?: string;
  photographer?: string;
  source?: string;
  location?: string;
  tags?: PhotoTag[];
  album?: number;
  tour?: string;
  event?: string;
  is_featured?: boolean;
  is_fan_submitted?: boolean;
  submitted_by?: string;
  status?: 'pending' | 'approved' | 'rejected';
  date_uploaded?: string;
}

export interface Photo {
  id: string;
  imageUrl: string;
  title: string;
  description: string;
  dateTaken?: string;
  formattedDate?: string;
  photographer?: string;
  source?: string;
  location?: string;
  tags: PhotoTag[];
  albumSlug?: string;
  tour?: string;
  event?: string;
  isFeatured: boolean;
  isFanSubmitted: boolean;
  submittedBy?: string;
}

// =============================================================================
// FORUMS / COMMUNITY TYPES
// =============================================================================

export interface DirectusForumCategory {
  id: number | string;
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  sort_order?: number;
  thread_count?: number;
  post_count?: number;
  last_post_id?: string;
}

export interface ForumCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon?: string;
  threadCount: number;
  postCount: number;
  lastPostId?: string;
}

export interface DirectusForumThread {
  id: number | string;
  title: string;
  slug?: string;
  category_id: string;
  author_id: string;
  content: string;
  is_pinned?: boolean;
  is_locked?: boolean;
  view_count?: number;
  reply_count?: number;
  last_reply_at?: string;
  last_reply_by?: string;
  date_created?: string;
  date_updated?: string;
}

export interface ForumThread {
  id: string;
  title: string;
  slug: string;
  categoryId: string;
  categoryName?: string;
  author: ForumUser;
  content: string;
  isPinned: boolean;
  isLocked: boolean;
  viewCount: number;
  replyCount: number;
  lastReplyAt?: string;
  lastReplyBy?: string;
  createdAt: string;
  formattedDate: string;
}

export interface DirectusForumPost {
  id: number | string;
  thread_id: string;
  author_id: string;
  content: string;
  is_solution?: boolean;
  reactions?: {
    like: number;
    love: number;
    insightful: number;
  };
  date_created?: string;
  date_updated?: string;
}

export interface ForumPost {
  id: string;
  threadId: string;
  author: ForumUser;
  content: string;
  isSolution: boolean;
  reactions: {
    like: number;
    love: number;
    insightful: number;
  };
  createdAt: string;
  formattedDate: string;
}

export interface DirectusForumUser {
  id: number | string;
  username: string;
  display_name?: string;
  email?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  join_date?: string;
  post_count?: number;
  reputation?: number;
  role?: 'member' | 'moderator' | 'admin';
  is_banned?: boolean;
  last_active?: string;
}

export interface ForumUser {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  location?: string;
  joinDate: string;
  postCount: number;
  reputation: number;
  role: 'member' | 'moderator' | 'admin';
  isBanned: boolean;
  lastActive?: string;
}

// =============================================================================
// STATS TYPES
// =============================================================================

export interface SongStats {
  songId: number;
  songTitle: string;
  songSlug: string;
  albumTitle: string;
  totalPlays: number;
  firstPlayed?: string;
  lastPlayed?: string;
  yearsPlayed: { year: number; count: number }[];
  toursPlayed: { tour: string; count: number }[];
}

export interface TourStats {
  name: string;
  year: number;
  totalShows: number;
  countries: string[];
  totalSongsPlayed: number;
  uniqueSongs: number;
  averageSongsPerShow: number;
}

export interface OverallStats {
  totalAlbums: number;
  totalSongs: number;
  totalShows: number;
  countriesVisited: number;
  yearsActive: number;
  averageSongsPerShow: number;
  mostPlayedSong: SongStats;
  rarestSong: SongStats;
}

// =============================================================================
// NEWS / ARTICLES TYPES (Enhanced Blog)
// =============================================================================

export type NewsCategory = 'news' | 'reviews' | 'interviews' | 'rumors' | 'editorials';

export interface DirectusNews {
  id: number | string;
  title: string;
  slug?: string;
  excerpt: string;
  content: string;
  featured_image?: string;
  featured?: boolean;
  category: NewsCategory;
  tags?: string[];
  author_name?: string;
  author_avatar?: string;
  date_published?: string;
  reading_time?: number;
  status?: string;
  rating?: number; // 1-5 for reviews
  is_featured?: boolean;
}

export interface NewsPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featuredImage?: string;
  featured: boolean;
  category: NewsCategory;
  tags: string[];
  authorName?: string;
  authorAvatar?: string;
  publishedDate: string;
  formattedDate: string;
  readingTime: number;
  rating?: number;
}
