// Theme configuration for Cureation
// Themes are applied automatically based on the page context (album, song, etc.)

export interface ThemeConfig {
  defaultTheme: string;
  albumThemeMap: Record<string, string>;
}

export const themeConfig: ThemeConfig = {
  defaultTheme: 'disintegration',
  albumThemeMap: {
    'three-imaginary-boys': 'three-imaginary-boys',
    'seventeen-seconds': 'seventeen-seconds',
    'faith': 'faith',
    'pornography': 'pornography',
    'the-top': 'the-top',
    'the-head-on-the-door': 'the-head-on-the-door',
    'kiss-me': 'kiss-me',
    'disintegration': 'disintegration',
    'wish': 'wish',
    'wild-mood-swings': 'wild-mood-swings',
    'bloodflowers': 'bloodflowers',
    'the-cure': 'the-cure',
    '4-13-dream': '4-13-dream',
    '413-dream': '4-13-dream',
  }
};

/**
 * Get the theme ID for a given album slug
 * Falls back to default theme if not found
 */
export function getThemeForAlbum(albumSlug: string): string {
  if (!albumSlug) return themeConfig.defaultTheme;

  // Normalize the slug
  const normalizedSlug = albumSlug.toLowerCase().trim();

  return themeConfig.albumThemeMap[normalizedSlug] || themeConfig.defaultTheme;
}

/**
 * Get the theme ID for a song based on its album
 */
export function getThemeForSong(albumSlug: string): string {
  return getThemeForAlbum(albumSlug);
}

/**
 * Get the default theme for pages without album context
 */
export function getDefaultTheme(): string {
  return themeConfig.defaultTheme;
}
