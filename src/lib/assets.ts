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
  const base = `${DIRECTUS_URL}/assets/${id}`;
  return preset ? `${base}?${INLINE[preset]}` : base;
}
