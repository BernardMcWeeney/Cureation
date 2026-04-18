# Self-hosted fonts

`src/styles/tokens.css` references these paths:

```
public/fonts/cormorant-garamond/{regular,italic}.woff2
public/fonts/eb-garamond/{regular,italic}.woff2
public/fonts/inter/regular.woff2
public/fonts/jetbrains-mono/regular.woff2
public/fonts/caveat/regular.woff2
```

## Quick install via fontsource (recommended)

```bash
npm i @fontsource-variable/cormorant-garamond \
      @fontsource-variable/eb-garamond \
      @fontsource-variable/inter \
      @fontsource-variable/jetbrains-mono \
      @fontsource/caveat
```

Then copy the relevant `.woff2` files from `node_modules/@fontsource*` into the paths above, or swap `tokens.css` `@font-face src` URLs to point at the fontsource package paths imported from `src/styles/global.css`.

## Alternative: manual download

Use Google Fonts Helper (https://gwfh.mranftl.com/fonts) to download subset (latin) WOFF2 for each family and rename according to the paths above.

Until these files exist the browser falls back to the serif/mono/sans declared in `tokens.css` — usable in dev, but install before shipping Phase 1.
