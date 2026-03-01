// =============================================================================
// Type Definitions
// =============================================================================
export interface Theme {
  id: string;
  name: string;
  year: number;
}

export interface NavigationItem {
  name: string;
  path: string;
  external?: boolean;
}

export interface NavigationConfig {
  main: NavigationItem[];
  footer: {
    explore: NavigationItem[];
    community: NavigationItem[];
    legal: NavigationItem[];
  };
}

export interface ContactEntry {
  label: string;
  email: string;
}

export interface SiteConfig {
  name: string;
  description: string;
  url: string;

  logo: {
    text: string;
    image: string;
  };

  social: {
    twitter: string | null;
    instagram: string | null;
    facebook: string | null;
    discord: string | null;
    github: string | null;
  };

  contact: {
    general: ContactEntry;
    data: ContactEntry;
    press: ContactEntry;
  };

  meta: {
    ogImage: string;
    twitterHandle: string;
    favicon: string;
  };

  api: {
    baseUrl: string;
    endpoints: {
      albums: string;
      songs: string;
      setlists: string;
      blogs: string;
    };
  };

  navigation: NavigationConfig;

  featured: {
    album: string;
    setlistCount: number;
    blogCount: number;
  };

  defaultTheme: string;
  enableThemeSwitcher: boolean;
  availableThemes: Theme[];
}

// =============================================================================
// Site Configuration Object
// =============================================================================
export const siteConfig: SiteConfig = {
  name: "Cureation",
  description: "A fan-built archive celebrating the music, history, and legacy of The Cure",
  url: "https://cureation.net",

  logo: {
    text: "Cureation",
    image: "logo.png",
  },

  social: {
    twitter: "https://twitter.com/cureationx",
    instagram: null,
    facebook: null,
    discord: null,
    github: null,
  },

  contact: {
    general: { label: "General", email: "hello@cureation.net" },
    data: { label: "Data", email: "data@cureation.net" },
    press: { label: "Press", email: "press@cureation.net" }
  },

  meta: {
    ogImage: "/images/og-image.jpg",
    twitterHandle: "@cureationx",
    favicon: "/favicon.svg",
  },

  api: {
    baseUrl: "https://dash.cureation.net/items",
    endpoints: {
      albums: "/albums",
      songs: "/songs",
      setlists: "/setlists",
      blogs: "/blogs",
    },
  },

  navigation: {
    main: [
      { name: "News", path: "/news" },
      { name: "Discography", path: "/discography" },
      { name: "Lyrics", path: "/lyrics" },
      { name: "Setlists", path: "/setlists" },
      { name: "Wiki", path: "/wiki" },
      { name: "Stats", path: "/stats" },
      { name: "Charts", path: "/charts" },
    ],
    footer: {
      explore: [
        { name: "Discography", path: "/discography" },
        { name: "Lyrics", path: "/lyrics" },
        { name: "Setlists", path: "/setlists" },
        { name: "News", path: "/news" },
        { name: "Gallery", path: "/gallery" },
        { name: "Statistics", path: "/stats" },
        { name: "On This Day", path: "/on-this-day" },
      ],
      community: [
        { name: "Forums", path: "/community" },
        { name: "Wiki & History", path: "/wiki" },
        { name: "About the Project", path: "/about" },
        { name: "Contribute", path: "/about#contribute" },
        {
          name: "Twitter",
          path: "https://twitter.com/cureationx",
          external: true,
        },
      ],
      legal: [
        { name: "Disclaimer", path: "/about/disclaimer" },
        { name: "Privacy Policy", path: "/about/privacy" },
        { name: "Terms of Use", path: "/about/terms" },
      ],
    },
  },

  featured: {
    album: "disintegration",
    setlistCount: 3,
    blogCount: 2,
  },

  defaultTheme: "disintegration",
  enableThemeSwitcher: true,
  availableThemes: [
    { id: "three-imaginary-boys", name: "Three Imaginary Boys", year: 1979 },
    { id: "seventeen-seconds", name: "Seventeen Seconds", year: 1980 },
    { id: "faith", name: "Faith", year: 1981 },
    { id: "pornography", name: "Pornography", year: 1982 },
    { id: "the-top", name: "The Top", year: 1984 },
    { id: "the-head-on-the-door", name: "The Head on the Door", year: 1985 },
    { id: "kiss-me", name: "Kiss Me, Kiss Me, Kiss Me", year: 1987 },
    { id: "disintegration", name: "Disintegration", year: 1989 },
    { id: "wish", name: "Wish", year: 1992 },
    { id: "wild-mood-swings", name: "Wild Mood Swings", year: 1996 },
    { id: "bloodflowers", name: "Bloodflowers", year: 2000 },
    { id: "the-cure", name: "The Cure", year: 2004 },
    { id: "4:13-dream", name: "4:13 Dream", year: 2008 }
  ]
};

/**
 * Retrieves the main navigation items from the configuration.
 *
 * @returns An array of main navigation items.
 */
export function getNavigation(): NavigationItem[] {
  return siteConfig.navigation.main;
}

/**
 * Retrieves the footer navigation configuration.
 *
 * @returns The footer navigation items.
 */
export function getFooterLinks() {
  return siteConfig.navigation.footer;
}

/**
 * Gets the available themes for the theme switcher.
 * 
 * @returns An array of available themes.
 */
export function getThemes(): Theme[] {
  return siteConfig.availableThemes;
}

// =============================================================================
// Export the Site Configuration Object
// =============================================================================
export default siteConfig;
