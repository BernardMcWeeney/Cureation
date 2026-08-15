export const CUREATION_2026_TOUR_NAME = '2026 European Summer Shows';
export const CUREATION_2026_TOUR_SLUG = '2026-european-summer-shows';
export const GENERIC_2026_TOUR_SLUG = 'festival-summer-2026';
export const SUMMER_2026_START = '2026-06-05';
export const SUMMER_2026_END = '2026-08-30';

export function normalizePlaceName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function findUniqueNormalizedPlaceholder(candidates, city) {
  const normalizedCity = normalizePlaceName(city);
  const matches = candidates.filter(
    (candidate) => normalizePlaceName(candidate.city) === normalizedCity
  );

  return matches.length === 1 ? matches[0] : null;
}

export function relationId(value) {
  if (value && typeof value === 'object' && 'id' in value) {
    return value.id;
  }
  return value ?? null;
}

export function chooseTourAssignment(existing, setlistFmTourName, setlistFmTourId) {
  const existingTourId = relationId(existing?.tour);
  const existingTourName = existing?.tour_name?.trim();

  return {
    tourId: existingTourId ?? setlistFmTourId ?? null,
    tourName: existingTourName || setlistFmTourName?.trim() || null,
  };
}

export function cleanCompletedShowNotes(notes, songCount) {
  if (!notes || Number(songCount || 0) === 0) {
    return notes ?? null;
  }

  const cleaned = String(notes)
    .replace(/\s*Setlist pending\.?\s*$/i, '')
    .replace(/^Upcoming 2026\b/i, '2026')
    .trim();

  return cleaned || null;
}
