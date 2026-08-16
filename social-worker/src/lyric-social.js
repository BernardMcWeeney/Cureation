const SECTION_LABEL_PATTERN = /^\[[^\]]+\]$/;

export function normalizeLyricSections(structuredLyrics, fallbackLyrics = '') {
  const structured = parseStructuredLyrics(structuredLyrics);
  const rawSections = Array.isArray(structured)
    ? structured
    : Array.isArray(structured?.sections)
      ? structured.sections
      : [];

  const sections = rawSections
    .map((section) => {
      const rawLines = Array.isArray(section?.lines) ? section.lines : [];
      return rawLines
        .map((line) => cleanLyricLine(line && typeof line === 'object' ? line.text : line))
        .filter(Boolean);
    })
    .filter((lines) => lines.length > 0);

  return sections.length > 0 ? sections : sectionsFromPlainText(fallbackLyrics);
}

export function selectLyricPassage(sections, seed, maxLines = 3) {
  const cleanSections = (Array.isArray(sections) ? sections : [])
    .map((section) => (Array.isArray(section) ? section.map(cleanLyricLine).filter(Boolean) : []))
    .filter((section) => section.length > 0);
  const indexedLines = cleanSections.flatMap((section, sectionIndex) =>
    section.map((line, lineIndex) => ({ line, lineIndex, sectionIndex }))
  );

  if (indexedLines.length === 0) return [];

  const safeSeed = Number.isFinite(Number(seed)) ? Math.trunc(Number(seed)) : 0;
  const selected = indexedLines[((safeSeed % indexedLines.length) + indexedLines.length) % indexedLines.length];
  const section = cleanSections[selected.sectionIndex];
  const count = Math.min(Math.max(1, Math.trunc(maxLines) || 1), section.length);
  const start = Math.min(Math.max(0, selected.lineIndex - 1), section.length - count);

  return section.slice(start, start + count);
}

export function buildLyricPostText(
  { lines, title, trackNumber = null, albumTitle = null },
  maxLength = 280
) {
  const cleanLines = (Array.isArray(lines) ? lines : [lines])
    .map(cleanLyricLine)
    .filter(Boolean)
    .slice(0, 3);
  const credit = buildLyricCredit({ title, trackNumber, albumTitle });

  for (let lineCount = cleanLines.length; lineCount > 0; lineCount -= 1) {
    const text = `“${cleanLines.slice(0, lineCount).join('\n')}”\n\n${credit}`;
    if (text.length <= maxLength) return text;
  }

  const wrapperLength = 4 + credit.length;
  const available = Math.max(1, maxLength - wrapperLength);
  const line = cleanLines[0] || 'Untitled';
  const fittedLine = line.length <= available
    ? line
    : `${line.slice(0, Math.max(1, available - 1)).trimEnd()}…`;

  return `“${fittedLine}”\n\n${credit}`.slice(0, maxLength);
}

export function ordinal(value) {
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number)) return '';

  const lastTwo = Math.abs(number) % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${number}th`;

  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[Math.abs(number) % 10] || 'th';
  return `${number}${suffix}`;
}

function buildLyricCredit({ title, trackNumber, albumTitle }) {
  const songTitle = String(title || 'Untitled').trim() || 'Untitled';
  const recordTitle = String(albumTitle || '').trim();
  const track = Number(trackNumber);
  const hasTrackNumber = Number.isInteger(track) && track > 0;

  if (recordTitle && hasTrackNumber) {
    return `${songTitle}, the ${ordinal(track)} track on ${recordTitle} by The Cure.`;
  }
  if (recordTitle) return `${songTitle}, from ${recordTitle} by The Cure.`;
  return `${songTitle} by The Cure.`;
}

function parseStructuredLyrics(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function sectionsFromPlainText(value) {
  const sections = [];
  let current = [];

  const flush = () => {
    if (current.length > 0) sections.push(current);
    current = [];
  };

  for (const rawLine of String(value || '').split(/\r?\n/)) {
    const line = cleanLyricLine(rawLine);
    if (!line) {
      flush();
      continue;
    }
    current.push(line);
  }
  flush();

  return sections;
}

function cleanLyricLine(value) {
  const line = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  return line && !SECTION_LABEL_PATTERN.test(line) ? line : '';
}
