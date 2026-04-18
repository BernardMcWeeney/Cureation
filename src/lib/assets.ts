import { DIRECTUS_URL } from './directus';

export type Preset = 'card' | 'hero' | 'thumb' | 'og';

/** Build a Directus /assets URL with an optional named preset. */
export function asset(
  id: string | null | undefined,
  preset?: Preset,
  fallback: string = '/hero-image1.jpg'
): string {
  if (!id) return fallback;
  const base = `${DIRECTUS_URL}/assets/${id}`;
  return preset ? `${base}?key=${preset}` : base;
}
