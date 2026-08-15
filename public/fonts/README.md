# Typography packages

Cureation's production fonts are installed through Fontsource and imported in
`src/styles/global.css`:

- Cormorant Garamond Variable — display and italic headlines
- EB Garamond Variable — editorial reading text
- Inter Variable — navigation and interface text
- JetBrains Mono Variable — dates, labels and archive metadata

The files are bundled with the site at build time, so typography no longer
depends on the visitor's operating-system fonts. The fallback stacks remain in
`src/styles/tokens.css` for resilience.
