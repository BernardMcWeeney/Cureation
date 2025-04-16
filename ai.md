PROJECT: Cureation  
TYPE: Community-driven fan website  
FOCUS: The Cure (band)  
DOMAIN: cureation.net  
AUDIENCE: Fans of The Cure, music historians, and community contributors

DESCRIPTION:  
Cureation is a modern, fan-built website dedicated to cataloging and celebrating the music, history, and legacy of the band *The Cure*. It is a single-source archive featuring discographies, lyrics, setlists, fan reviews, blog content, and curated updates from around the web. The site is themed per album and styled in a unique glassmorphism aesthetic. It is designed to be mobile-friendly, responsive, fast, accessible, and easy to manage via a headless CMS backend.

---

PRIMARY OBJECTIVES:
- Provide a beautifully designed, consistently themed fan resource for all things The Cure
- Act as an archive of their music, live performances, lyrics, and cultural impact
- Allow for easy expansion and content management via Directus CMS
- Encourage future community contributions, fan art, reviews, and setlist accuracy
- Prepare infrastructure for future additions like a wiki, forum, merch shop, and mailing list
- Maintain **lean, dry code** (Don’t Repeat Yourself) with a focus on **simplicity over complexity**
- Stay focused on the **mission and user experience** without over-engineering

---

TECH STACK:
- **Frontend:** Astro v5.6 (modern static site generator)
- **Styling:** Tailwind CSS v4 (no `tailwind.config.js`) + DaisyUI for UI components
- **CMS / Backend:** Directus (Headless CMS)  
  - API Base URL: `https://dash.cureation.net/items`
- **Fonts:** Uses `'Tangerine', cursive` for brand/logo and header accents
- **Themes:** Album-based dynamic theming using Tailwind themes — customizable via config
- **UX Effects:** Astro View Transitions for smooth page animations
- **Design Philosophy:** Glassmorphism UI with accessible contrast and responsive behavior
- **Config:** there is an universal config

---

DESIGN & DEVELOPMENT PRINCIPLES:
- Follow **lean and dry code** practices — prioritize reusable components, avoid bloat
- Keep everything **simple, clean, and intentional**
- Use **DaisyUI** as the foundation for UI consistency across pages
  - Extend or override DaisyUI components with Cureation-specific styles and flairs where needed
- Ensure **design consistency** — typography, spacing, and visual rhythm should feel unified
- **Glassmorphism** is core to the brand aesthetic (blurred backgrounds, transparency, soft glow)
- Focus on **smooth transitions and animations** to enhance rather than distract

---

CORE FEATURES & PAGES:

1. **Discography**
   - Displays all studio albums
   - Each album page contains title, year, tracklist, cover art, and metadata

2. **Blog**
   - News aggregation (from RSS or manual curation)
   - Original Cureation content (reviews, essays, retrospectives)

3. **Setlists**
   - Chronological list of concerts
   - Each expands to show full setlist and gig details

4. **Lyrics**
   - List of songs across all albums
   - Each expands to show full lyrics with styling tied to the album theme

5. **About Page**
   - Project mission, credits, technical overview

---

STYLE GUIDE & DESIGN DETAILS:

- **Glassmorphism:** Background blur, soft shadows, transparency effects
- **Typography:** Large headings with cursive font for branding, readable body text
- **Responsive:** Mobile-first layout with accessibility in mind (contrast, alt text, ARIA tags)
- **Performance:** Built for speed with static output from Astro and minimal JS
- **View Transitions:** Smooth, fluid transitions between pages using native Astro routing

---

ADMIN CONFIGURATION:
- Album color themes can be dynamically configured via Directus and applied site-wide
- Themes affect accent colors, backgrounds, button styles, and highlight elements
- Global config allows easy switching of font sizes, logo text, and homepage headline

---

FUTURE FEATURES (ROADMAP):
- Full-text search and advanced filtering (by album, song, year, tour)
- User comments and reactions
- Admin theming dashboard for managing color palettes and layouts
- Fan art gallery + submission flow
- Wiki for in-depth articles and band lore
- Forum/discussion boards for community
- Newsletter integration
- Shop page for merch, zines, etc.
- Stats dashboard (e.g., most-played live songs, tour stats)

---

CONTRIBUTING:
- Code contributions, feature ideas, and content suggestions are welcome
- Plans to open-source the repo with structured issues and contribution guidelines

---

IMPORTANT NOTES:
- Cureation is a **fan project** not affiliated with The Cure or their representatives
- All media (lyrics, album art, setlists) remain property of their respective owners

---

CONTACT:
- Email: hello@cureation.net  
- Social: https://twitter.com/cureationx
