# Cureation

**Cureation** is a fan-built website dedicated to **The Cure** — one of the most iconic bands of our time. This is a community-driven platform to explore, document, and celebrate their music, legacy, and culture. From discographies and lyrics to tour setlists and curated blog posts, Cureation aims to be the definitive online fan archive for all things The Cure.

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