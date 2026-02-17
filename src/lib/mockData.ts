/**
 * Comprehensive Mock Data for Cureation
 * Used when Directus collections are not available or return empty data
 */

import type { NewsPost, Photo, SongWithAlbum, WikiMember, TimelineEvent } from '../types/directus';

// =============================================================================
// NEWS / ARTICLES MOCK DATA
// =============================================================================

export const mockNewsPosts: NewsPost[] = [
  {
    id: '1',
    title: "The Cure Announce 2025 World Tour: 'Songs of a Lost World' Continues",
    slug: 'cure-announce-2025-world-tour',
    excerpt: "Following the massive success of their latest album, The Cure have announced an extensive world tour spanning Europe, North America, and beyond.",
    content: '<p>The Cure have announced their most ambitious tour in decades...</p>',
    featuredImage: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&h=630&fit=crop',
    featured: true,
    category: 'news',
    tags: ['tour', 'live', '2025'],
    authorName: 'James Murphy',
    publishedDate: '2024-12-15',
    formattedDate: 'December 15, 2024',
    readingTime: 4
  },
  {
    id: '2',
    title: "Songs of a Lost World: A Deep Dive Into The Cure's Masterpiece",
    slug: 'songs-of-a-lost-world-deep-dive',
    excerpt: "An in-depth look at the themes, production, and emotional weight of The Cure's long-awaited album.",
    content: '<p>After 16 years of anticipation...</p>',
    featuredImage: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&h=630&fit=crop',
    featured: false,
    category: 'reviews',
    tags: ['album', 'review', 'songs of a lost world'],
    authorName: 'Sarah Collins',
    publishedDate: '2024-11-28',
    formattedDate: 'November 28, 2024',
    readingTime: 8,
    rating: 5
  },
  {
    id: '3',
    title: "Robert Smith on Creativity, Loss, and The Future of The Cure",
    slug: 'robert-smith-interview-2024',
    excerpt: "In this exclusive interview, Robert Smith opens up about the creative process behind the new album and what lies ahead.",
    content: '<p>Sitting in the dimly lit studio...</p>',
    featuredImage: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=1200&h=630&fit=crop',
    featured: false,
    category: 'interviews',
    tags: ['robert smith', 'interview', 'exclusive'],
    authorName: 'Michael Chen',
    publishedDate: '2024-11-20',
    formattedDate: 'November 20, 2024',
    readingTime: 12
  },
  {
    id: '4',
    title: "The Evolution of Robert Smith's Guitar Sound",
    slug: 'evolution-robert-smith-guitar-sound',
    excerpt: "From the angular post-punk of their early days to the lush atmospheric tones of Disintegration, tracing the sonic evolution.",
    content: '<p>The guitar sound of The Cure...</p>',
    featuredImage: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=1200&h=630&fit=crop',
    featured: false,
    category: 'editorials',
    tags: ['guitar', 'sound', 'gear'],
    authorName: 'David Richards',
    publishedDate: '2024-11-15',
    formattedDate: 'November 15, 2024',
    readingTime: 6
  },
  {
    id: '5',
    title: "Disintegration at 35: Why It Still Matters",
    slug: 'disintegration-at-35',
    excerpt: "A retrospective look at one of the most influential albums in alternative rock history.",
    content: '<p>When Disintegration was released in 1989...</p>',
    featuredImage: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=630&fit=crop',
    featured: false,
    category: 'reviews',
    tags: ['disintegration', 'anniversary', 'retrospective'],
    authorName: 'Emma Watson',
    publishedDate: '2024-11-10',
    formattedDate: 'November 10, 2024',
    readingTime: 10,
    rating: 5
  },
  {
    id: '6',
    title: "New Box Set Rumors: Complete B-Sides Collection Coming?",
    slug: 'box-set-rumors-b-sides',
    excerpt: "Sources close to the band suggest a comprehensive B-sides and rarities collection may be in the works.",
    content: '<p>Fans have been speculating...</p>',
    featuredImage: 'https://images.unsplash.com/photo-1461784180009-21121b2f204c?w=1200&h=630&fit=crop',
    featured: false,
    category: 'rumors',
    tags: ['box set', 'b-sides', 'rarities'],
    authorName: 'Tom Hardy',
    publishedDate: '2024-11-05',
    formattedDate: 'November 5, 2024',
    readingTime: 3
  }
];

// =============================================================================
// PHOTOS MOCK DATA
// =============================================================================

export const mockPhotos: Photo[] = [
  {
    id: '1',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1600&h=900&fit=crop',
    title: 'The Cure Live at Wembley Stadium',
    description: 'A stunning moment captured during the encore of their legendary Wembley performance.',
    dateTaken: '2023-06-15',
    formattedDate: 'June 15, 2023',
    photographer: 'Andy Vella',
    location: 'Wembley Stadium, London',
    tags: ['live', 'promotional'],
    tour: 'Shows of a Lost World',
    isFeatured: true,
    isFanSubmitted: false
  },
  {
    id: '2',
    imageUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1600&h=900&fit=crop',
    title: 'Robert Smith - Portrait Session',
    description: 'Promotional photo shoot for the Songs of a Lost World album campaign.',
    dateTaken: '2024-09-10',
    formattedDate: 'September 10, 2024',
    photographer: 'Rankin',
    location: 'Studio, London',
    tags: ['promotional', 'studio'],
    isFeatured: true,
    isFanSubmitted: false
  },
  {
    id: '3',
    imageUrl: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=1600&h=900&fit=crop',
    title: 'Backstage at Madison Square Garden',
    description: 'A rare candid moment captured backstage before their sold-out MSG show.',
    dateTaken: '2023-07-20',
    formattedDate: 'July 20, 2023',
    photographer: 'Kevin Cummins',
    location: 'Madison Square Garden, NYC',
    tags: ['backstage', 'candid'],
    tour: 'Shows of a Lost World',
    isFeatured: false,
    isFanSubmitted: false
  },
  {
    id: '4',
    imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1600&h=900&fit=crop',
    title: 'Disintegration Tour 1989',
    description: 'Historic photo from the original Disintegration tour at the Sydney Entertainment Centre.',
    dateTaken: '1989-08-12',
    formattedDate: 'August 12, 1989',
    photographer: 'Tom Sheehan',
    location: 'Sydney, Australia',
    tags: ['live', 'candid'],
    tour: 'Prayer Tour',
    isFeatured: false,
    isFanSubmitted: false
  },
  {
    id: '5',
    imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1600&h=900&fit=crop',
    title: 'Studio Session - Wish Era',
    description: 'Recording sessions at Hookend Manor for the Wish album.',
    dateTaken: '1991-11-20',
    formattedDate: 'November 20, 1991',
    photographer: 'Chris Gabrin',
    location: 'Hookend Manor, UK',
    tags: ['studio', 'candid'],
    albumSlug: 'wish',
    isFeatured: false,
    isFanSubmitted: false
  }
];

// =============================================================================
// SONGS MOCK DATA (with album info)
// =============================================================================

export const mockSongsWithAlbums: SongWithAlbum[] = [
  {
    id: 1,
    title: 'Pictures of You',
    trackNumber: 2,
    duration: '7:24',
    lyrics: [{ type: 'verse', content: "I've been looking so long at these pictures of you\nThat I almost believe that they're real" }],
    listenLinks: [{ Platform: 'Spotify', Link: '#' }],
    hasLyrics: true,
    albumId: 8,
    albumTitle: 'Disintegration',
    albumSlug: 'disintegration',
    albumCover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop',
    year: '1989'
  },
  {
    id: 2,
    title: 'Lovesong',
    trackNumber: 6,
    duration: '3:29',
    lyrics: [{ type: 'verse', content: "Whenever I'm alone with you\nYou make me feel like I am home again" }],
    listenLinks: [{ Platform: 'Spotify', Link: '#' }],
    hasLyrics: true,
    albumId: 8,
    albumTitle: 'Disintegration',
    albumSlug: 'disintegration',
    albumCover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop',
    year: '1989'
  },
  {
    id: 3,
    title: 'Friday I\'m in Love',
    trackNumber: 5,
    duration: '3:35',
    lyrics: [{ type: 'verse', content: "I don't care if Monday's blue\nTuesday's grey and Wednesday too" }],
    listenLinks: [{ Platform: 'Spotify', Link: '#' }],
    hasLyrics: true,
    albumId: 9,
    albumTitle: 'Wish',
    albumSlug: 'wish',
    albumCover: 'https://images.unsplash.com/photo-1461784180009-21121b2f204c?w=400&h=400&fit=crop',
    year: '1992'
  },
  {
    id: 4,
    title: 'Just Like Heaven',
    trackNumber: 5,
    duration: '3:32',
    lyrics: [{ type: 'verse', content: "Show me, show me, show me how you do that trick\nThe one that makes me scream" }],
    listenLinks: [{ Platform: 'Spotify', Link: '#' }],
    hasLyrics: true,
    albumId: 7,
    albumTitle: 'Kiss Me, Kiss Me, Kiss Me',
    albumSlug: 'kiss-me',
    albumCover: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=400&fit=crop',
    year: '1987'
  },
  {
    id: 5,
    title: 'A Forest',
    trackNumber: 3,
    duration: '5:54',
    lyrics: [{ type: 'verse', content: "Come closer and see, see into the trees\nFind the girl while you can" }],
    listenLinks: [{ Platform: 'Spotify', Link: '#' }],
    hasLyrics: true,
    albumId: 2,
    albumTitle: 'Seventeen Seconds',
    albumSlug: 'seventeen-seconds',
    albumCover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop',
    year: '1980'
  },
  {
    id: 6,
    title: 'Boys Don\'t Cry',
    trackNumber: 1,
    duration: '2:36',
    lyrics: [{ type: 'verse', content: "I would say I'm sorry if I thought that it would change your mind" }],
    listenLinks: [{ Platform: 'Spotify', Link: '#' }],
    hasLyrics: true,
    albumId: 1,
    albumTitle: 'Three Imaginary Boys',
    albumSlug: 'three-imaginary-boys',
    albumCover: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=400&h=400&fit=crop',
    year: '1979'
  },
  {
    id: 7,
    title: 'Lullaby',
    trackNumber: 4,
    duration: '4:08',
    lyrics: [{ type: 'verse', content: "On candystripe legs the Spiderman comes\nSoftly through the shadow of the evening sun" }],
    listenLinks: [{ Platform: 'Spotify', Link: '#' }],
    hasLyrics: true,
    albumId: 8,
    albumTitle: 'Disintegration',
    albumSlug: 'disintegration',
    albumCover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop',
    year: '1989'
  },
  {
    id: 8,
    title: 'Close to Me',
    trackNumber: 9,
    duration: '3:47',
    lyrics: [{ type: 'verse', content: "I've waited hours for this\nI've made myself so sick" }],
    listenLinks: [{ Platform: 'Spotify', Link: '#' }],
    hasLyrics: true,
    albumId: 6,
    albumTitle: 'The Head on the Door',
    albumSlug: 'the-head-on-the-door',
    albumCover: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    year: '1985'
  }
];

// =============================================================================
// SETLISTS MOCK DATA
// =============================================================================

export interface MockSetlist {
  id: string;
  slug: string;
  venue: string;
  location: string;
  date: string;
  formattedDate: string;
  tour: string;
  songCount: number;
  songs: { title: string; info?: string }[];
  venueImage?: string;
}

export const mockSetlists: MockSetlist[] = [
  {
    id: '1',
    slug: 'cure-wembley-2023-06-15',
    venue: 'Wembley Stadium',
    location: 'London, UK',
    date: '2023-06-15',
    formattedDate: 'June 15, 2023',
    tour: 'Shows of a Lost World',
    songCount: 27,
    venueImage: 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800&h=600&fit=crop',
    songs: [
      { title: 'Alone' },
      { title: 'Pictures of You' },
      { title: 'Lovesong' },
      { title: 'And Nothing Is Forever', info: 'First time played' },
      { title: 'A Forest' }
    ]
  },
  {
    id: '2',
    slug: 'cure-msg-2023-07-20',
    venue: 'Madison Square Garden',
    location: 'New York, NY',
    date: '2023-07-20',
    formattedDate: 'July 20, 2023',
    tour: 'Shows of a Lost World',
    songCount: 29,
    venueImage: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&h=600&fit=crop',
    songs: [
      { title: 'Alone' },
      { title: 'A Night Like This' },
      { title: 'Push' },
      { title: 'Disintegration' },
      { title: 'Friday I\'m in Love' }
    ]
  },
  {
    id: '3',
    slug: 'cure-hollywood-bowl-2023',
    venue: 'Hollywood Bowl',
    location: 'Los Angeles, CA',
    date: '2023-05-23',
    formattedDate: 'May 23, 2023',
    tour: 'Shows of a Lost World',
    songCount: 26,
    songs: [
      { title: 'Plainsong' },
      { title: 'Pictures of You' },
      { title: 'High' },
      { title: 'Just Like Heaven' },
      { title: 'Close to Me' }
    ]
  }
];

// =============================================================================
// ALBUMS MOCK DATA
// =============================================================================

export interface MockAlbum {
  id: string;
  title: string;
  slug: string;
  year: string;
  coverImage: string;
  description: string;
  tracks: { number: number; title: string; duration: string }[];
  featured: boolean;
}

export const mockAlbums: MockAlbum[] = [
  {
    id: '1',
    title: 'Disintegration',
    slug: 'disintegration',
    year: '1989',
    coverImage: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&h=600&fit=crop',
    description: "The Cure's masterpiece of atmospheric melancholy, featuring some of their most beloved songs.",
    tracks: [
      { number: 1, title: 'Plainsong', duration: '5:13' },
      { number: 2, title: 'Pictures of You', duration: '7:24' },
      { number: 3, title: 'Closedown', duration: '4:17' },
      { number: 4, title: 'Lovesong', duration: '3:29' },
      { number: 5, title: 'Lullaby', duration: '4:08' }
    ],
    featured: true
  },
  {
    id: '2',
    title: 'Wish',
    slug: 'wish',
    year: '1992',
    coverImage: 'https://images.unsplash.com/photo-1461784180009-21121b2f204c?w=600&h=600&fit=crop',
    description: "A pop-oriented album that saw massive commercial success, including the hit 'Friday I'm in Love'.",
    tracks: [
      { number: 1, title: 'Open', duration: '6:50' },
      { number: 2, title: 'High', duration: '3:33' },
      { number: 3, title: 'Apart', duration: '6:42' },
      { number: 4, title: 'From the Edge of the Deep Green Sea', duration: '7:43' },
      { number: 5, title: "Friday I'm in Love", duration: '3:35' }
    ],
    featured: true
  },
  {
    id: '3',
    title: 'Pornography',
    slug: 'pornography',
    year: '1982',
    coverImage: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=600&fit=crop',
    description: 'The darkest and most intense album in their catalog, a harrowing descent into despair.',
    tracks: [
      { number: 1, title: 'One Hundred Years', duration: '6:40' },
      { number: 2, title: 'A Short Term Effect', duration: '4:22' },
      { number: 3, title: 'The Hanging Garden', duration: '4:33' },
      { number: 4, title: 'Siamese Twins', duration: '5:29' },
      { number: 5, title: 'The Figurehead', duration: '6:16' }
    ],
    featured: false
  }
];

// =============================================================================
// WIKI / MEMBERS MOCK DATA
// =============================================================================

export const mockMembers: WikiMember[] = [
  {
    id: '1',
    name: 'Robert Smith',
    slug: 'robert-smith',
    bio: 'Lead vocalist, guitarist, and primary songwriter of The Cure since the band\'s formation in 1976.',
    photo: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop',
    instruments: ['Vocals', 'Guitar', 'Keyboards'],
    tenureStart: '1976',
    isCurrentMember: true,
    sideProjects: ['Siouxsie and the Banshees', 'The Glove'],
    tenure: '1976 - Present'
  },
  {
    id: '2',
    name: 'Simon Gallup',
    slug: 'simon-gallup',
    bio: 'Bassist and longest-serving member alongside Robert Smith, known for his melodic bass lines.',
    photo: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400&h=400&fit=crop',
    instruments: ['Bass Guitar'],
    tenureStart: '1979',
    isCurrentMember: true,
    sideProjects: ['Fools Dance', 'Lockjaw'],
    tenure: '1979 - Present'
  },
  {
    id: '3',
    name: 'Roger O\'Donnell',
    slug: 'roger-odonnell',
    bio: 'Keyboardist who has contributed to The Cure\'s lush atmospheric sound across multiple tenures.',
    photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop',
    instruments: ['Keyboards', 'Synthesizers'],
    tenureStart: '1987',
    isCurrentMember: true,
    sideProjects: ['Solo Artist'],
    tenure: '1987 - Present (with breaks)'
  }
];

// =============================================================================
// TIMELINE EVENTS MOCK DATA
// =============================================================================

export const mockTimelineEvents: TimelineEvent[] = [
  {
    id: '1',
    title: 'The Cure Formed',
    description: 'Robert Smith, Lol Tolhurst, and Michael Dempsey form Easy Cure in Crawley.',
    date: '1976-01-01',
    formattedDate: '1976',
    year: 1976,
    type: 'milestone',
    importance: 10
  },
  {
    id: '2',
    title: 'Three Imaginary Boys Released',
    description: 'The Cure release their debut album, marking the start of their legendary career.',
    date: '1979-05-08',
    formattedDate: 'May 8, 1979',
    year: 1979,
    type: 'release',
    relatedAlbum: 'three-imaginary-boys',
    importance: 9
  },
  {
    id: '3',
    title: 'Disintegration Released',
    description: 'The Cure release their masterpiece, Disintegration, to critical and commercial acclaim.',
    date: '1989-05-02',
    formattedDate: 'May 2, 1989',
    year: 1989,
    type: 'release',
    relatedAlbum: 'disintegration',
    importance: 10
  },
  {
    id: '4',
    title: 'Rock and Roll Hall of Fame Induction',
    description: 'The Cure are inducted into the Rock and Roll Hall of Fame.',
    date: '2019-03-29',
    formattedDate: 'March 29, 2019',
    year: 2019,
    type: 'award',
    importance: 9
  },
  {
    id: '5',
    title: 'Songs of a Lost World Released',
    description: 'After 16 years, The Cure release their 14th studio album to widespread acclaim.',
    date: '2024-11-01',
    formattedDate: 'November 1, 2024',
    year: 2024,
    type: 'release',
    importance: 10
  }
];

// =============================================================================
// ALBUM OF THE MONTH
// =============================================================================

export interface AlbumOfTheMonth {
  album: MockAlbum;
  editorialNote: string;
  pullQuote: string;
  videoEmbed?: string;
  relatedPhotos: Photo[];
}

export const mockAlbumOfTheMonth: AlbumOfTheMonth = {
  album: mockAlbums[0], // Disintegration
  editorialNote: "This month we celebrate one of the greatest albums in alternative rock history. Disintegration turns 35 and its atmospheric beauty remains as powerful as ever. From the opening synth wash of 'Plainsong' to the devastating finale, this is Robert Smith at his most vulnerable and triumphant.",
  pullQuote: "I wanted to make a record that I could listen to in 20 years and still feel the same way about.",
  videoEmbed: 'https://www.youtube.com/embed/x3ogHpxGxnU',
  relatedPhotos: mockPhotos.slice(0, 3)
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get a deterministic "of the day" selection based on date
 */
export function getDailySelection<T>(items: T[], seed?: Date): T | null {
  if (items.length === 0) return null;
  const date = seed || new Date();
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  );
  return items[dayOfYear % items.length];
}

/**
 * Get featured news post (first featured, or first post)
 */
export function getMockFeaturedNews(): NewsPost | null {
  const featured = mockNewsPosts.find(p => p.featured);
  return featured || mockNewsPosts[0] || null;
}

/**
 * Get photo of the day
 */
export function getMockPhotoOfTheDay(): Photo {
  const featured = mockPhotos.find(p => p.isFeatured);
  return featured || getDailySelection(mockPhotos) || mockPhotos[0];
}

/**
 * Get song of the day
 */
export function getMockSongOfTheDay(): SongWithAlbum {
  return getDailySelection(mockSongsWithAlbums) || mockSongsWithAlbums[0];
}

/**
 * Get latest setlist
 */
export function getMockLatestSetlist(): MockSetlist {
  return mockSetlists[0];
}

/**
 * Get latest review
 */
export function getMockLatestReview(): NewsPost | null {
  return mockNewsPosts.find(p => p.category === 'reviews') || null;
}
