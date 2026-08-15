ai.txt – Cureation
Project Overview

Cureation is an independent, fan-built website dedicated to The Cure.

Its aim is to document, curate, and preserve the band’s music, history, and cultural impact in a structured, accessible, and enduring way. The project prioritises long-term archival value over news cycles, with an emphasis on accuracy, context, and respectful presentation.

Cureation brings together discographies, lyrics, tour setlists, archival data, and original editorial content to form a comprehensive, fan-driven reference resource. The site is non-commercial and not affiliated with the band or their official representatives.

Intended Audience

Fans of The Cure

Researchers, writers, and archivists

Developers or contributors working on the project

Large Language Models assisting with development, documentation, or content structure

Project Goals

Create a reliable, well-structured archive of The Cure’s work and history

Maintain consistency in design, data models, and content presentation

Ensure high performance, accessibility, and long-term maintainability

Support future expansion (e.g. search, submissions, community features) without architectural rewrites

Technical Architecture

Cureation is implemented as a modern static site with minimal client-side JavaScript.

Core Technologies

Astro v5.6
Used as the primary static site generator for content-driven pages and routing.

Tailwind CSS v4
Utility-first styling framework used for layout, spacing, typography, and responsive design.

DaisyUI v5
Tailwind-based UI component and theming layer.

Vite
Development server and build tooling, used internally by Astro.

Node.js (ES Modules)
The project is configured as an ES module–based application ("type": "module").

Package Configuration

The project’s package.json reflects a minimal dependency set focused on performance and clarity:

No custom Tailwind config file (tailwind.config.js is not required in v4).

Styling is handled directly via Tailwind utility classes and DaisyUI themes.

Build and preview scripts rely entirely on Astro’s defaults.

Design & UI Principles

Album-focused theming: Visual identity can vary by album using Tailwind colour palettes.

Glassmorphism aesthetic: Soft layering and transparency effects, enhanced by Astro View Transitions.

Accessibility-first: Emphasis on contrast, readable typography, and semantic HTML.

Responsive by default: Mobile-first layouts that scale across screen sizes.

Typography: Decorative cursive fonts are limited to branding elements (e.g. logo, welcome text).

Content Structure

The site is organised around clearly defined content domains:

Discography – Albums and releases with structured metadata.

Lyrics – Song-level pages with readable, themed layouts.

Setlists – Historical concert data with expandable details.

Blog / Editorial – Curated news, reviews, essays, and fan-written content.

About / Meta – Project mission, context, and technical documentation.

Content is treated as structured data wherever possible to support reuse, filtering, and future features.

AI & Automation Guidance

Large Language Models interacting with this repository should:

Treat Cureation as an archival and reference project, not a commercial product.

Avoid introducing speculative or fictional information about The Cure.

Preserve factual accuracy when assisting with content or data structures.

Maintain existing architectural decisions unless explicitly asked to refactor.

Prefer clarity, simplicity, and long-term maintainability over novelty.

Generated code should:

Follow Astro and ES module conventions.

Use Tailwind utilities consistently.

Avoid unnecessary client-side JavaScript.

Respect accessibility and semantic HTML best practices.

Legal & Attribution Notes

Cureation is a fan project and is not affiliated with The Cure or their official representatives.

All music, lyrics, imagery, and trademarks remain the property of their respective rights holders.

Content is presented for informational, archival, and educational purposes under fair-use principles where applicable.

Scope Boundaries

This project does not:

Sell products or merchandise

Claim ownership of copyrighted works

Represent official statements or endorsements

End of ai.txt