# Cureation

**Cureation** is a fan-built website dedicated to **The Cure** – one of the most iconic bands of our time. This is a community-driven platform to explore, document, and celebrate their music, legacy, and culture. From discographies and lyrics to tour setlists and curated blog posts, Cureation aims to be the definitive online fan archive for all things The Cure.

---

## 🧰 Tech Stack

| Tool | Purpose |
|------|---------|
| [Astro v5.6](https://astro.build) | Static site generator with view transitions |
| [Tailwind CSS v4](https://tailwindcss.com) | Utility-first CSS for styling (no `tailwind.config.js` required) |
| [DaisyUI](https://daisyui.com) | Prebuilt, theme-aware UI components |
| [Directus](https://directus.io) | Headless CMS powering site content |
| API URL | `https://dash.cureation.net/items` |

---

## 🎨 Design & Styling

The site is built around a **glassmorphism** aesthetic using **Astro's View Transitions**, creating a soft, fluid experience between pages.

Key design considerations:
- **Album-focused theming**: Each album has a unique Tailwind color palette that can be dynamically switched via admin config.
- **Readability & Accessibility**: Careful attention to contrast, legibility, and screen-reader friendliness.
- **Responsive & Mobile-First**: Optimized for all screen sizes and devices.
- **Typography**: Uses `'Tangerine', cursive` for branding elements like the **logo** and **Welcome message**.

---

## 📚 Site Features & Pages

### 🎵 Discography
- Lists every Cure album.
- Click into any album to view full details: cover art, tracklist, release info, etc.

### 📰 Blog
- Curated news from trusted Cure-related sources.
- Original Cureation posts including editorials, reviews, and fan content.

### 🎤 Setlists
- Browse historical concert setlists.
- Expand each entry to reveal full performance details.

### 📃 Lyrics
- Complete list of The Cure's songs.
- Click a track to display full lyrics in a readable, themed layout.

### ℹ️ About Page
- Introduction to Cureation’s mission.
- Info about the tech stack, contributors, and future plans.

---

## 📐 Project Goals

- Deliver a **visually cohesive** and **performance-optimized** website for fans.
- Maintain a **consistent style** across all content types and layouts.
- Offer a **community-first** approach where fans can contribute or suggest updates.
- Build a foundation for future features such as user submissions, comments, and more dynamic content.

---

## 🛠️ Setup & Development

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/cureation.git
cd cureation
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run the Dev Server
```bash
npm run dev
```

### 4. Production Build
```bash
npm run build
```

> Make sure you have access to the correct environment variables for the Directus API.

---

## 🧪 Coming Soon

- Advanced search and filtering (e.g., by tour, year, song)
- Advanced Search
- Commenting system for fans
- Admin theming dashboard
- Fan art gallery & submission page
- Light/dark mode toggle
- Wiki
- Forum
- Stats
- Newsletter
- Shop

---

## 🤝 Contributing

We welcome contributions! Whether it’s correcting a typo, suggesting a new feature, or helping with UI components, feel free to open an issue or pull request.

---

## 📫 Contact & Credits

Built and maintained by fans, for fans.  
For questions or feedback, reach out at [hello@cureation.net](mailto:hello@cureation.net)  
Follow us on social: [Twitter/X](https://twitter.com/cureationx)

---

> *Cureation is a fan project and not affiliated with The Cure or their official representatives. All rights to music, lyrics, and art belong to their respective owners.*

---
## Directus visual editing

All pages render on demand through the Cloudflare adapter. The shared layout loads
`@directus/visual-editing` inside an iframe and reconnects after Astro navigation.
Configure Directus's Visual Editor URL as
`https://cureation.com/?visual-editing=true`. The query flag persists while navigating
inside the editor. Ordinary visitors receive no editing attributes.

Existing CMS content links to its original collection, item and fields. Detail
pages also expose an editor-only **Edit this record** control for fields that are
empty or not currently visible. Derived statistics remain calculated from source
records. The editor uses the signed-in Directus user's write permissions; preview
mode does not grant access to unpublished or restricted content.

Display copy, navigation labels and selected local image paths use the `site_copy`
collection. The checked-in seed preserves the original wording and inline markup.
Provision it with an admin token provided through your shell environment:

```sh
npm run directus:site-copy
```

The command requires `DIRECTUS_TOKEN`, optionally `DIRECTUS_URL`, and `curl`.
It creates missing records, preserves existing edits and grants public **read**
access only. Grant content editors read/update permission on `site_copy.text`.
Keep record IDs unchanged: templates reference these stable keys. The `location`
field identifies the source component. For image-path entries, supply a local path
or HTTPS image URL. Preserve existing `<em>`, `<br>` and icon markup when editing
HTML display-copy entries. Missing/unavailable copy falls back to the checked-in
wording.

`public/_headers` permits embedding static assets; `src/middleware.ts` applies the
same iframe policy to server responses. Workers Caching is enabled in `wrangler.toml`.
Only successful, anonymous HTML responses on the public route allowlist receive
`Cloudflare-CDN-Cache-Control: public, max-age=600`; browsers revalidate. API routes,
private/archive tools, redirects, errors, cookie/authorization-bearing requests and
responses setting cookies receive `private, no-store`. `Vary` isolates cookie,
authorization and iframe variants before the Worker executes. Every response gets
an explicit policy, so excluded routes cannot fall into a default cache TTL.

Directus reads happen in Astro on the Worker. They are anonymous: server-side
`DIRECTUS_TOKEN` and `PUBLIC_DIRECTUS_TOKEN` are deliberately not forwarded. Only
allowlisted public collections enter the separate data cache (10 minutes by default,
up to 30 minutes for daily selections). Its new namespace avoids old authenticated
cache entries. Credentials in query parameters, private responses, errors and preview
requests are never stored. A public page can remain stale across both the data and
HTML TTLs; editor previews bypass both layers and show saves immediately.

Keep the Visual Editor URL's `?visual-editing=true` flag. It partitions previews from
public cache keys and survives navigation/redirects. Previews return `private,
no-store` plus `Cloudflare-CDN-Cache-Control: no-store`. The flag does **not** grant
authentication: preview rendering uses public permissions and cannot read drafts or
private content. Adding unpublished previews in future requires a separate authenticated
read path before granting any broader access.

No Directus response-cache dependency is required. Keep the VM's current settings:
`CACHE_ENABLED=false`, `CACHE_STORE=redis`, `CACHE_AUTO_PURGE=false` and
`SYNCHRONIZATION_STORE=redis`. Website caching is handled by Cloudflare; Directus
Studio continues to use uncached API reads. Local image assets have a 30-day cache
policy; Astro's fingerprinted assets keep their immutable policy.

Validation:

```sh
npm run check
npm run test:visual-editing
npm run build
```

Builds no longer run Pagefind: the site's search overlay uses `/api/search.json`.


The October 2026 reliability/SEO work and its evidence are documented in
[the dated audit report](reports/2026-10-14-site-audit/README.md). Run `npm test` for
unit regressions and `npm run test:e2e` against a local Worker on port 4325 for
desktop/mobile journeys and automated accessibility checks. `npm run audit:crawl`,
`npm run audit:browser` and `npm run audit:data` generate fresh read-only reports in
`reports/latest/`; set `AUDIT_BASE_URL` to a local or staging origin for page checks.
No credentials are needed for public checks. Use a fresh local `--persist-to`
directory after rebuilding so cached HTML cannot reference replaced hashed assets.
