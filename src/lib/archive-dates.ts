/** Date-only archive values stay date-only; never invent a month/day for year-only data. */
export function datePrecision(value?: string | null): 'year' | 'month' | 'day' | null {
  if (!value) return null;
  if (/^\d{4}$/.test(value)) return 'year';
  if (/^\d{4}-\d{2}$/.test(value)) return Number(value.slice(5, 7)) >= 1 && Number(value.slice(5, 7)) <= 12 ? 'month' : null;
  return /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value.slice(0, 10) ? 'day' : null;
}

export function tourStatus(start?: string | null, end?: string | null, today = new Date().toISOString().slice(0, 10)) {
  const startDay = datePrecision(start) === 'day' ? start!.slice(0, 10) : null;
  const endDay = datePrecision(end) === 'day' ? end!.slice(0, 10) : null;
  if (endDay && endDay < today) return 'completed';
  if (startDay && startDay > today) return 'upcoming';
  if (startDay && endDay && startDay <= today && endDay >= today) return 'current';
  return 'unknown';
}

/** RSS cannot express partial dates. Omit them rather than inventing a publication day. */
export function rssDate(value?: string | null): Date | undefined {
  return datePrecision(value) === 'day' ? new Date(value!) : undefined;
}
