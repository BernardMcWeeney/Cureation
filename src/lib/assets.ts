import { DIRECTUS_URL } from './directus';

export type Preset = 'card' | 'hero' | 'thumb' | 'og';

const INLINE: Record<Preset, string> = {
  card: 'width=480&height=480&fit=cover&quality=75&format=auto',
  hero: 'width=1600&fit=inside&quality=85&format=auto',
  thumb: 'width=160&height=160&fit=cover&quality=70&format=auto',
  og: 'width=1200&height=630&fit=cover&quality=80&format=jpg',
};

/** Build a Directus /assets URL with an optional named preset (inline transform). */
export function asset(
  id: string | null | undefined,
  preset?: Preset,
  fallback: string = '/hero-image1.jpg'
): string {
  if (!id) return fallback;
  if (/^https?:\/\//i.test(id)) return id;
  const base = `${DIRECTUS_URL}/assets/${id}`;
  return preset ? `${base}?${INLINE[preset]}` : base;
}

/** Resize only our Directus assets; external image URLs retain their original semantics. */
export function responsiveAsset(src: string | null | undefined, width: number): string | undefined {
  if (!src) return undefined;
  try {
    const url = new URL(src);
    if (url.origin !== new URL(DIRECTUS_URL).origin || !url.pathname.startsWith('/assets/')) return undefined;
    url.searchParams.set('width', String(width));
    url.searchParams.set('quality', '75');
    return url.href;
  } catch { return undefined; }
}
