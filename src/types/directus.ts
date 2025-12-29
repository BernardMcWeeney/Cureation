// TypeScript interfaces for Directus CMS data

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
