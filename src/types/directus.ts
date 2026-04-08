// TypeScript interfaces for Directus CMS data

// =============================================================================
// ALBUM TYPES
// =============================================================================

export type AlbumEra = 'early' | 'pop' | 'classic' | 'experimental' | 'modern';
export type AlbumType = 'studio' | 'live' | 'compilation' | 'ep' | 'single' | 'deluxe' | 'reissue' | 'boxset' | 'soundtrack' | 'remix';

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
  parent_album?: number;
  spotify_url?: string;
  apple_music_url?: string;
  bandcamp_url?: string;
  amazon_url?: string;
  official_store_url?: string;
  disc_count?: number;
  track_count?: number;
  catalog_number?: string;
  genre_tags?: string[];
  credits?: string;
  source?: number;
  source_url?: string;
}

// =============================================================================
// SONG TYPES
// =============================================================================

export interface LyricStructuredLine {
  line_id: string;
  line_no: number;
  text: string;
}

export interface LyricStructuredSection {
  section_id: string;
  label: string;
  order: number;
  lines: LyricStructuredLine[];
}

export interface DirectusSong {
  id: number;
  title: string;
  slug?: string;
  album: number;
  track_number?: number;
  duration?: string;
  lyrics?: string;
  lyrics_structured?: LyricStructuredSection[];
  song_meaning?: string;
  listen_links?: ListenLink[];
  credits?: string;
  source?: number;
  source_url?: string;
  writer?: string;
  composer?: string;
  bpm?: number;
  musical_key?: string;
  first_played_live?: string;
  last_played_live?: string;
  times_played_live?: number;
  guitar_tuning?: string;
  is_single?: boolean;
  music_video_url?: string;
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
  type: AlbumType;
  parentAlbumId?: number;
  spotifyUrl?: string;
  appleMusicUrl?: string;
  bandcampUrl?: string;
  amazonUrl?: string;
  officialStoreUrl?: string;
  discCount: number;
  trackCount: number;
  catalogNumber?: string;
  genreTags: string[];
  credits?: string;
  tracks?: Track[];
  singles?: Single[];
  sourceName?: string;
  sourceUrl?: string;
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
  writer?: string;
  composer?: string;
  bpm?: number;
  musicalKey?: string;
  firstPlayedLive?: string;
  lastPlayedLive?: string;
  timesPlayedLive?: number;
  guitarTuning?: string;
  isSingle?: boolean;
  musicVideoUrl?: string;
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
  photo_file?: string;
  birth_date?: string;
  instruments?: string[];
  tenure_start?: string;
  tenure_end?: string;
  is_current_member?: boolean;
  side_projects?: string[];
  status?: 'draft' | 'published';
  source?: number;
  source_url?: string;
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

// =============================================================================
// MEMBER STINT TYPES (Band Timeline)
// =============================================================================

export interface DirectusMemberStint {
  id: number;
  member: number;
  start_year: number;
  end_year: number | null;
  role: string;
  stint_number: number;
  notes?: string;
}

export interface MemberStint {
  id: number;
  memberId: number;
  memberName: string;
  memberSlug: string;
  memberPhoto?: string;
  startYear: number;
  endYear: number | null;
  role: string;
  stintNumber: number;
  notes?: string;
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
  related_album_id?: number;
  related_member_id?: number;
  image?: string;
  importance?: number;
  source?: number;
  source_url?: string;
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

export type PhotoLicense = 'arr' | 'cc' | 'fair_use' | 'public_domain' | 'press' | 'fan';

export interface DirectusPhoto {
  id: number | string;
  image: string;
  image_file?: string;
  title?: string;
  description?: string;
  date_taken?: string;
  photographer?: string;
  source?: number;
  source_url?: string;
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
  license?: PhotoLicense;
  copyright_holder?: string;
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
  featured_image_file?: string;
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
  source?: number;
  source_url?: string;
  image_credit?: string;
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
  sourceUrl?: string;
  imageCredit?: string;
}

// =============================================================================
// SOURCES & ATTRIBUTION
// =============================================================================

export type SourceType = 'website' | 'book' | 'magazine' | 'interview' | 'documentary' | 'official' | 'fan' | 'archive' | 'api' | 'other';

export interface DirectusSource {
  id: number;
  name: string;
  type?: SourceType;
  url?: string;
  author?: string;
  description?: string;
  logo?: string;
  is_official?: boolean;
  reliability?: number; // 1-5
}

export interface Source {
  id: number;
  name: string;
  type: SourceType;
  url?: string;
  author?: string;
  description?: string;
  logoUrl?: string;
  isOfficial: boolean;
  reliability: number;
}

// =============================================================================
// VIDEO TYPES
// =============================================================================

export type VideoType = 'music_video' | 'live' | 'interview' | 'documentary' | 'tv' | 'fan' | 'bts' | 'lyric_video' | 'other';

export interface DirectusVideo {
  id: number;
  title: string;
  slug?: string;
  video_url: string;
  embed_id?: string;
  thumbnail?: string;
  type?: VideoType;
  description?: string;
  date?: string;
  duration?: string;
  song?: number;
  album?: number;
  setlist?: number;
  director?: string;
  is_featured?: boolean;
  view_count?: number;
  source?: number;
  source_url?: string;
}

export interface Video {
  id: number;
  title: string;
  slug: string;
  videoUrl: string;
  embedId?: string;
  thumbnailUrl?: string;
  type: VideoType;
  description?: string;
  date?: string;
  formattedDate?: string;
  duration?: string;
  songId?: number;
  albumId?: number;
  setlistId?: number;
  director?: string;
  isFeatured: boolean;
  viewCount?: number;
  sourceName?: string;
  sourceUrl?: string;
}

// =============================================================================
// POLL TYPES
// =============================================================================

export type PollType = 'single' | 'multiple' | 'ranking';
export type PollStatus = 'draft' | 'active' | 'closed' | 'featured';
export type PollCategory = 'albums' | 'songs' | 'tours' | 'members' | 'general' | 'versus';

export interface DirectusPoll {
  id: number;
  question: string;
  slug?: string;
  description?: string;
  type?: PollType;
  status?: PollStatus;
  start_date?: string;
  end_date?: string;
  total_votes?: number;
  category?: PollCategory;
}

export interface DirectusPollOption {
  id: number;
  poll: number;
  label: string;
  image?: string;
  vote_count?: number;
  sort_order?: number;
}

export interface Poll {
  id: number;
  question: string;
  slug: string;
  description?: string;
  type: PollType;
  status: PollStatus;
  startDate?: string;
  endDate?: string;
  totalVotes: number;
  category?: PollCategory;
  options: PollOption[];
}

export interface PollOption {
  id: number;
  label: string;
  imageUrl?: string;
  voteCount: number;
  percentage: number;
}

// =============================================================================
// DID YOU KNOW / TRIVIA
// =============================================================================

export type FactCategory = 'recording' | 'live' | 'members' | 'albums' | 'songs' | 'history' | 'pop_culture' | 'equipment';

export interface DirectusDidYouKnow {
  id: number;
  fact: string;
  category?: FactCategory;
  related_album?: number;
  related_song?: number;
  related_member?: number;
  source?: number;
  source_detail?: string;
  is_verified?: boolean;
  is_featured?: boolean;
}

export interface DidYouKnow {
  id: number;
  fact: string;
  category?: FactCategory;
  relatedAlbumTitle?: string;
  relatedSongTitle?: string;
  relatedMemberName?: string;
  sourceName?: string;
  sourceDetail?: string;
  isVerified: boolean;
}

// =============================================================================
// ALBUM PERSONNEL
// =============================================================================

export interface DirectusAlbumPersonnel {
  id: number;
  album: number;
  member?: number;
  musician_name?: string;
  role?: string;
  is_guest?: boolean;
}

export interface AlbumPersonnel {
  id: number;
  name: string;
  role: string;
  isGuest: boolean;
  memberSlug?: string;
}

// =============================================================================
// SITE STATS (Visitor Tracking)
// =============================================================================

export interface SiteStats {
  totalVisits: number;
  todayVisits: number;
  todayPeak: number;
  currentlyOnline: number;
}

// =============================================================================
// VENUE TYPES
// =============================================================================

export interface DirectusVenue {
  id: number;
  name: string;
  slug?: string;
  city?: string;
  state_province?: string;
  country?: string;
  country_code?: string;
  location?: string;
  capacity?: number;
  opened_year?: number;
  venue_type?: string;
  latitude?: number;
  longitude?: number;
  wikipedia_url?: string;
  official_website?: string;
  description?: string;
  famous_moment?: string;
  first_cure_show?: string;
  latest_cure_show?: string;
  cure_show_count?: number;
  source_notes?: string;
}

export interface Venue {
  id: number;
  name: string;
  slug: string;
  city: string;
  stateProvince?: string;
  country: string;
  countryCode?: string;
  location: string;
  capacity?: number;
  openedYear?: number;
  venueType?: string;
  latitude?: number;
  longitude?: number;
  wikipediaUrl?: string;
  officialWebsite?: string;
  description?: string;
  famousMoment?: string;
  firstCureShow?: string;
  latestCureShow?: string;
  cureShowCount?: number;
}

// =============================================================================
// TOUR TYPES
// =============================================================================

export interface DirectusTour {
  id: number;
  name: string;
  slug?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
  associated_album?: number;
  total_shows?: number;
  source?: string;
  image?: string;
  countries_visited?: string[];
  support_acts?: string[];
  lineup?: string[];
}

export interface Tour {
  id: number;
  name: string;
  slug: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  associatedAlbumId?: number;
  associatedAlbumTitle?: string;
  associatedAlbumSlug?: string;
  associatedAlbumCover?: string;
  totalShows: number;
  imageUrl?: string;
  countriesVisited: string[];
  supportActs: string[];
  lineup: string[];
  year: number;
}

// =============================================================================
// COUNTRY FLAG HELPER
// =============================================================================

export const countryCodeToFlag: Record<string, string> = {
  US: '🇺🇸', GB: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸',
  NL: '🇳🇱', BE: '🇧🇪', CH: '🇨🇭', AT: '🇦🇹', SE: '🇸🇪', NO: '🇳🇴',
  DK: '🇩🇰', FI: '🇫🇮', IE: '🇮🇪', PT: '🇵🇹', PL: '🇵🇱', CZ: '🇨🇿',
  HU: '🇭🇺', RO: '🇷🇴', BG: '🇧🇬', HR: '🇭🇷', RS: '🇷🇸', SI: '🇸🇮',
  GR: '🇬🇷', TR: '🇹🇷', RU: '🇷🇺', CA: '🇨🇦', MX: '🇲🇽', BR: '🇧🇷',
  AR: '🇦🇷', CL: '🇨🇱', CO: '🇨🇴', AU: '🇦🇺', NZ: '🇳🇿', JP: '🇯🇵',
  KR: '🇰🇷', CN: '🇨🇳', IN: '🇮🇳', SG: '🇸🇬', MY: '🇲🇾', TH: '🇹🇭',
  ID: '🇮🇩', PH: '🇵🇭', ZA: '🇿🇦', IL: '🇮🇱', LV: '🇱🇻', LT: '🇱🇹',
  EE: '🇪🇪', LU: '🇱🇺', IS: '🇮🇸', MT: '🇲🇹', SK: '🇸🇰', UA: '🇺🇦',
  PE: '🇵🇪', UY: '🇺🇾', PY: '🇵🇾', CR: '🇨🇷', PA: '🇵🇦', PR: '🇵🇷',
  TW: '🇹🇼', HK: '🇭🇰', AE: '🇦🇪', SA: '🇸🇦', MA: '🇲🇦', EG: '🇪🇬',
};
