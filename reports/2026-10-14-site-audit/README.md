# Cureation improvement project — 14 October 2026

## Baseline and priorities

The repository uses Astro 7.3.8, @astrojs/cloudflare 14.3.4, Directus visual-editing 2.1.0 and Tailwind 4.3.3. Astro renders on demand on a Cloudflare Worker; explicit edge policies cache public HTML/data. That rendering strategy supports the existing visual editor and is retained. Existing uncommitted work is preserved. Production and database records are not changed by this project.

| Priority | Finding | Evidence | Root cause | Proposed solution | Reason | Expected impact |
|---|---|---|---|---|---|---|
| High | Concert search links use IDs rather than slugs | Search template links `/setlists/${s.id}`; detail lookup filters `slug` | Search projection omits slug | Return canonical slug links and test real search navigation | Prevent navigation dead ends | Working concert search |
| High | API failures can become zero counts, empty listings or false 404s | Count/review helpers catch errors and return 0/[]/null | Missing distinction between unavailable and absent records | Nullable counts and an uncached 503 for failed primary data | Preserve truthful content and crawler status | No fabricated zeros or false missing-record responses |
| High | Invalid ARIA on every tested page | Chromium/axe finds `aria-pressed` on `<html>` | Theme selector targets every `[data-colour-theme]` element | Restrict pressed-state updates to buttons | Valid accessible semantics | Remove reproduced critical axe violation |
| High | Wrong robots sitemap hostname | `public/robots.txt` uses cureation.net; configured site is cureation.com | Stale hostname | Canonical domain and sitemap validation | Crawl consistency | Correct discovery endpoint |
| Medium | Sources page issues 360 citation queries for 40 sources | 9 queries/source; live crawl measured 7,551 ms | Per-source ID downloads | Grouped aggregate counts, 9 queries total; unknown counts remain unknown | Backend load and delivery reliability | 97.5% fewer citation queries |
| Medium | Ended tour still described as current | Directus tour end_date=2026-08-30; homepage says “On tour now” on 2026-10-14 | Static time-sensitive labels | Date-derived status, preserving archive links | Accurate current/historical presentation | Truthful tour messaging |
| Medium | Sitemap duplicates and future hard limits | Live sitemap: 3,089 URLs, 3,088 unique; repository limits news to 200 and shows to 2,000 | Mixed static/dynamic URLs and capped full-index queries | Paged lightweight sitemap reads, de-duplication | Complete, maintainable discovery | One canonical URL per valid record |
| Medium | Sources use mouse-only inline row actions | `<tr onclick=window.open(...)>` without real source anchor | Clickable rows replace links | Standard anchors and accessible tables | Keyboard/crawler access; avoid interpolated inline JS | Navigable references |
| Medium | Core record templates lack entity structured data and repeat generic descriptions | Album/song/member/concert templates use layout defaults | No shared record SEO layer | Reusable factual metadata and JSON-LD with tests | Search and social context | Record-specific metadata |

## Reported issues not reproduced at baseline

A bounded live crawl checked 120 pages with no HTTP 404/500 failures, including all five linked wiki articles. Chromium desktop and mobile loaded the homepage, reviews, sources and wiki successfully with no JavaScript exceptions. Homepage figures were 14 studio records, 157 songs with slugs, 1,692 shows and 1,047 venues. Anonymous API reads returned 14 published reviews and 40 source records. These observations do not establish what happened during earlier outages or to every crawler.

## Testing limitations

The connected browser tool fails during bootstrap (`node:process` import is disallowed). Repository Playwright checks use installed Chrome successfully. Playwright Firefox cannot launch its temporary profile in this environment; that failure is recorded rather than treated as a website defect. Search Console and VM/database logs are not connected. No production deployment is authorized. Lighthouse is lab data, not real-user INP or CrUX.

Machine-readable baseline evidence: `live-crawl.json`, `live-browser.json`, `live-lighthouse-home.json`. Final implementation and verification results follow.


## Additional confirmed findings

| Priority | Finding | Evidence and root cause | Implemented solution | Outcome |
|---|---|---|---|---|
| High | Bookmark clicks cancel themselves | Live browser: false → false, saved count 0. Component wires at startup and again on `astro:page-load`. | Wire each button once; repaint existing buttons on navigation; expose saved state with `aria-pressed`. | Same journey now false → true, saved count 1; save, navigate, restore and remove pass on desktop/mobile. |
| High | Lyric search silently fails | Anonymous API returns HTTP 400 for `_nicontains` on the running instance; old code catches and drops results. | Remove that filter, de-duplicate lyric title matches locally, propagate search availability failures as generic 503 JSON. | Troxy search resolves to `/setlists/2024-11-01-troxy-london-6b50da2a`, HTTP 200. |
| High | Related publication/author queries request unavailable fields | Anonymous API rejects `news.date_created` and `author_slug`; main article exists but related/author queries fail. | Project the verified public fields, sort by `published_date`, retain the existing name-derived author URLs. | Publication and author routes return 200 with content; authors added to sitemap. |
| Medium | Video listing falsely appears empty | Anonymous API accepts `videos` but rejects sorting on `date_created`. | Sort using the existing public `date` field. | Listing returns 200 using real video records. |
| Medium | Comparison/statistics truncate concerts | Both query only 1,500 of the 1,692 stored shows. | Remove those caps using existing list helpers. | Browser comparison offers the full archive. |
| Medium | Review verdict labels fail contrast | Lighthouse reports 4.37:1 for two small accent labels, below 4.5:1. | Use the existing readable text colour for the small labels; retain accent score/design. | Faith review passes automated WCAG AA and scores 100 Lighthouse accessibility. |
| Medium | Review cover downloads 1,600px image on mobile | Lighthouse identifies 162,983-byte cover and missing LCP priority. | Responsive 480/760/1200px Directus transforms, sizes, high fetch priority; external URLs untouched. | Review lab LCP improves; image layout/artwork preserved. |
| Low | Modal initialization/focus and native transition handling | Duplicate initialization can close an already opened modal; mobile view-transition snapshot can reject when viewport changes. | Guard before resetting modal state, abort stale document listeners, trap Tab, restore focus; handle the optional animation-ready rejection without hiding DOM-update failures. | Mobile search, menu and navigation checks pass without JS exceptions. |

## Implementation map

- Reliability: `src/lib/directus.ts`, `src/lib/editing-context.ts`, `src/middleware.ts`, publication/author/video pages. Network failures, malformed/null list payloads and primary archive failures are distinct from genuine empty/missing records. Unavailable primary content returns 503, `Retry-After: 60`, and no-store. Real missing records retain 404. Counts preserve real zero and render unknown as “Unavailable”. Optional citation counts retain unknown states.
- Search and navigation: search API/overlay, Bookmark, MobileMenu, Nav, `dialog.ts`, `navigation.ts`, `archive-links.ts`. Inline JavaScript table-row navigation becomes a delegated enhancement alongside actual anchors. Standard links remain keyboard/crawler accessible. Search now uses concert slugs and searches venue/city/date text through Directus search.
- SEO: `seo.ts`, Layout, Crumbs, `sitemap.ts`, sitemap endpoint, robots and RSS. Shared record descriptions/canonicals/social tags and escaped JSON-LD; breadcrumbs plus factual album/song/member/venue/article/concert entities, WebSite/Organization and MusicGroup. No invented event times, street addresses, ratings or partial-date precision. Schema.org markup is not a claim of Google rich-result eligibility; JSON parses and template semantics are checked, external rich-result tools were not authenticated/run.
- Discovery: sitemap uses lightweight 500-row pagination, de-duplicates URL collisions, includes author pages and avoids previous news/concert caps. Preview and browser-local My Archive are noindex; valid archive records remain indexable. RSS omits unknown/partial publication dates instead of substituting today. All existing public routes are preserved.
- Freshness/performance: homepage tour labels follow the actual start/end dates. Completed 2026 tour links remain available as archive links. The original hero asset is preserved alongside three smaller responsive AVIF variants; custom CMS images still work. Sources now count citations with nine grouped aggregates rather than 360 per-source downloads.
- Prevention: 18 unit tests, Playwright desktop/mobile journeys and automated axe checks, reusable crawl/browser/read-only data audit scripts, and `.github/workflows/archive-checks.yml`. Pull requests run unit tests, Astro checks and build; manual workflow can also run local Worker/browser/crawl checks against public Directus. No new visitor tracking.

The site keeps its Astro/Cloudflare server rendering, themes, typography, comparison tools and Directus visual editing. `_headers` serves static asset headers; middleware supplies the frame/cache policy for server-rendered pages. No admin token is forwarded by website reads. Existing uncommitted work was preserved; no mixed commit or production deployment was made.

## Final verification

| Check | Result | Evidence |
|---|---|---|
| Unit/regression tests | 18 passed | `unit-tests.txt` |
| Astro type/check | 0 errors, 0 warnings; 5 existing hints | `typecheck.txt` |
| Production build | Passed | `build.txt` |
| Wrangler deployment dry run | Passed; upload/package only, no deployment | `deploy-dry-run.txt` |
| Desktop/mobile E2E | 23 passed, one intentional desktop skip of mobile-only test | `e2e-results.json` |
| Automated WCAG 2.2 AA | No violations on seven tested templates on desktop/mobile in E2E | `e2e-results.json` |
| Browser console/network | No exceptions or 5xx in final E2E; eight additional browser/page checks pass | `e2e-results.json`, `local-browser.json` |
| Internal link/metadata crawl | 120 pages; zero HTTP failures, metadata issues or canonical/JSON parse issues | `local-crawl.json` |
| XML sitemap | HTTP 200; 3,095 unique URLs on cureation.com | `local-crawl.json` |
| HTTP statuses and preview policy | Public content 200; missing review 404; preview no-store/noindex with editing attributes; public page has no editing attributes | `http-checks.json` |
| Failure injection | Primary failures become uncached 503; genuine missing stays 404; nullable counts and malformed API payloads tested | `unit-tests.txt` |
| Directus/data integrity | Eight public collections paginated, zero read failures, no dangling non-null relations detected in inspected projections | `data-integrity.json` |

The initial interrupted local run encountered stale cached HTML referring to assets from an older local build, plus upstream outages and large host-clock/timing interruptions. Final checks use a fresh local Wrangler persistence directory. Interrupted evidence is retained under `interrupted-*` and is not presented as a passing run. The final stable E2E suite completed in 34.5 seconds. Firefox profile launch remains an environment limitation; Chromium viewport and actual mobile-emulation checks both ran. Automated axe results do not certify every theme, content record, interaction or manual screen-reader journey.

## Before/after measurements

The pre-task source snapshot was rebuilt separately under `/tmp/cureation-controlled-baseline`, using the same dependency versions, original assets, local Cloudflare runtime and anonymous Directus. Before and after use Lighthouse 13.5.0 simulated mobile in headless Chrome on local ports 4326/4325. These are single lab runs; cache warmth and run variation affect timings. Production delivery, CrUX and INP remain unverified.

- **Homepage:** performance 82 → 93; accessibility 94 → 100; LCP 4.23s → 3.03s; CLS 0.0018 → 0.0028; TBT 0ms → 0ms. SEO 100 before and after.
- **Faith review:** performance 88 → 90; accessibility 89 → 100; LCP 3.87s → 3.53s; CLS 0.0000 → 0.0000; TBT 0ms → 0ms. SEO 100 before and after.

- **Hero payload:** 197,802 bytes originally; 27,387 at 800px, 50,653 at 1200px and 67,386 at original 1440px width (86.2% / 74.4% / 65.9% smaller). No change to image subject, credit or original file.
- **Sources citation requests:** 360 → 9 for 40 sources, a 97.5% reduction. Initial live page measured 7,551ms; first local implementation response measured 801ms; final warm local crawl measured 18ms. These host/cache conditions differ, so request-count reduction is the causal evidence rather than a claimed production latency percentage.
- Lighthouse LCP remains above the requested 2.5-second target on both measured templates. CLS meets 0.1. TBT is zero but does not establish real-user INP ≤200ms. Review cover and hero delivery improve; font/critical render-path work remains a measured follow-up.

Raw before/after results and methodology are in `controlled-before-*.json`, `local-lighthouse-*.json`, and `performance-summary.json`. `live-lighthouse-home.json` retains the original production baseline (78 performance, LCP 4.71s) and is not the controlled comparison. `pre-image-optimization-review.json` records the intermediate contrast/image findings.

## Data integrity and editorial decisions

The read-only public audit finds 45 releases, 850 song rows, 1,047 venues, 64 tours, 1,692 concerts, 24 news/wiki/editorial rows, 14 reviews and 40 sources. The homepage’s 14 records counts studio releases; its 157 songs counts rows with non-null slugs, matching the public songs listing. Those are different concepts from 850 stored song rows. One duplicate slug means 156 unique song URLs. This is documented, not silently “fixed” with an invented composition total.

- 693 song rows lack slugs. Determine whether they are incomplete records, alternate recordings/versions or entries intended to become public pages before generating any slugs.
- `bare` is shared by song IDs 128 and 934. A curator must determine the canonical entity and treatment of the other record; do not automatically merge records or rename the existing indexed URL.
- 165 similar-name groups are review candidates, not proven duplicates.
- Four songs lack album relations; one concert lacks a venue relation; 227 concerts lack tour relations. These can be legitimate or incomplete, and were not assigned speculative relationships.
- No dangling non-null song/review album, concert venue or concert tour relations were found among the public records inspected. Private/unpublished targets cannot be exhaustively assessed through anonymous access.
- Stored release/concert/tour dates in the inspected projections use full date strings. That format alone does not prove historical day-level certainty. Code now preserves year/month precision if supplied; archival date claims, correct album associations and citation sufficiency still require editorial/source review.
- Sources remain visible with their real references, authors and reliability notes; citations are derived from actual grouped relations. No sources, reviews, historical facts, news, media rights claims or credentials were invented or modified.

## Remaining work, in priority order

1. **High:** After explicit deployment authorization, validate on a Cloudflare preview/staging URL, check visual editing inside the signed-in Directus iframe, then perform the production rollout. Coordinate old HTML/hashed-asset cache invalidation or asset retention; a stale local cached page demonstrated why this matters. Do not flush private/editor protection or widen public permissions.
2. **High:** Investigate intermittent Directus/VM timeouts with VM/container/reverse-proxy/Cloudflare logs. They occurred during this work and recovered after the user checked availability. Application failure handling is covered; the infrastructure cause was not established. The public `polls` query also returned 403; review intended community-feature availability without granting anonymous access automatically.
3. **Medium:** Curate missing/duplicate song slugs and incomplete relationships with source evidence. Keep existing URLs or prepare explicit redirects for any later approved rename/merge.
4. **Medium:** Improve remaining LCP/font delivery using repeat lab runs and production real-user data. Check additional detail templates and all colour themes/manual keyboard/screen-reader flows. Re-run Firefox/WebKit in a working environment. All-theme compliance and full-site WCAG certification are not claimed.
5. **Medium:** Run an exhaustive staging crawl (`AUDIT_FULL=1`, adequate `AUDIT_LIMIT`) and review orphan/duplicate routes. Current crawl is bounded to 120 pages; sitemap generation covers all fetched public rows, while metadata/response checks sample that sitemap.
6. **Medium:** Connect Search Console, inspect representative rendered URLs and sitemap indexing after deployment, and review historical editorial/tour statements against sources. Index-versus-browser differences and historic automated HTTP 500 reports were not reproduced during the healthy baseline.

Lightweight monitoring: retain existing structured `directus_read_failed` Worker logs and Cloudflare observability; watch 5xx rates and deployment failures; periodically run the read-only crawl and data audit; use Search Console for crawl/indexing changes and available Core Web Vitals. Do not infer real-user INP from Lighthouse TBT, or add personal-data tracking to satisfy a monitoring checklist.

## Re-running checks

Use a supported Node release (verification used Node 25.4.0; CI selects Node 24), install with `npm ci`, then:

```sh
npm test
npm run check
npm run build
npx wrangler dev --port 4325 --persist-to /tmp/cureation-review-state
```

In a second terminal:

```sh
npm run test:e2e
AUDIT_BASE_URL=http://localhost:4325 npm run audit:crawl
AUDIT_BASE_URL=http://localhost:4325 npm run audit:browser
npm run audit:data
```

On macOS the tests use installed Chrome; other systems use Playwright Chromium (`npx playwright install --with-deps chromium`). Optional `TEST_FIREFOX=1 npm run test:e2e` adds Firefox when installed and launchable. Audit defaults write `reports/latest/`, preserving this dated evidence; `AUDIT_OUTPUT` overrides the destination. `AUDIT_LIMIT` controls the bounded crawl; `AUDIT_FULL=1 AUDIT_LIMIT=5000` also seeds every sitemap URL. Crawl checks test pathname targets and representative templates, not every query-string/filter permutation. Browser/data checks require the public Directus service to be healthy; unit tests inject controlled failures and do not modify the CMS.

Before rebuilding a running local Worker, stop it and use a fresh persistence directory for the new build to avoid mixing cached HTML with replaced hashed assets. The supplied workflow is repository code and has not been run by GitHub Actions yet. No production changes, remote data writes, commits mixing prior work, external messages or new analytics tracking were made.

## Documentation consulted

- [Astro rendering modes](https://docs.astro.build/en/guides/on-demand-rendering/) and [Cloudflare adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/).
- [Directus query parameters](https://directus.com/docs/guides/connect/query-parameters) and [filter rules](https://directus.com/docs/guides/connect/filter-rules). The documented `_nicontains` operator was rejected by this running instance, so the implemented query follows the verified API behavior.
- [Cloudflare Workers Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) and [static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/).
- [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) and [Core Web Vitals](https://web.dev/articles/vitals).

Directus 12.5.0 was reported in the supplied setup. Anonymous `/server/info` returns 200 but does not expose a version, so that server version was not independently confirmed. Installed application package versions were verified from the repository.
