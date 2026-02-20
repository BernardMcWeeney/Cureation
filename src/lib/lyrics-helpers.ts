// Helper functions for lyrics parsing, shared between pages

export function createSongSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, '-');
}

export interface LyricSection {
  label: string | null;
  lines: string[];
}

export function parseLyrics(lyrics: string | null | undefined, lyricsStructured: any): LyricSection[] | null {
  if (Array.isArray(lyricsStructured) && lyricsStructured.length > 0) {
    return lyricsStructured
      .map((section: any) => {
        const label = section?.label?.trim() || null;
        const lines = Array.isArray(section?.lines)
          ? section.lines.map((l: any) => String(l?.text || '').trim()).filter(Boolean)
          : [];
        return { label: label && !/^section\s+\d+$/i.test(label) ? label : null, lines };
      })
      .filter((s: LyricSection) => s.label || s.lines.length > 0);
  }

  if (!lyrics?.trim()) return null;

  return lyrics
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      const blockLines = block.trim().split('\n').map((l) => l.trim()).filter(Boolean);
      if (blockLines.length === 0) return null;
      let label: string | null = null;
      const headerMatch = blockLines[0].match(/^\[(.*?)\]$/);
      if (headerMatch) {
        label = headerMatch[1].trim();
        blockLines.shift();
      }
      return { label, lines: blockLines };
    })
    .filter(Boolean) as LyricSection[];
}

export function normalizeLineLabel(label: string | undefined | null): string | null {
  if (!label) return null;
  const trimmed = label.trim();
  if (!trimmed) return null;
  if (/^section\s+\d+$/i.test(trimmed)) return null;
  return trimmed;
}

export function parseLineNumber(value: unknown): number | null {
  const lineNo = Number(value);
  if (!Number.isInteger(lineNo) || lineNo <= 0) return null;
  return lineNo;
}

export interface StructuredLine {
  lineId: string;
  lineNo: number;
  text: string;
}

export interface StructuredSection {
  sectionId: string;
  label: string | null;
  order: number;
  lines: StructuredLine[];
}

export function findLyricMeaningForLine(
  meanings: any[],
  line: { lineId: string; lineNo: number; text: string }
): any | undefined {
  return meanings.find((meaning: any) => {
    if (meaning?.line_id && meaning.line_id === line.lineId) return true;
    const meaningLineNo = parseLineNumber(meaning?.line_no);
    if (meaningLineNo && meaningLineNo === line.lineNo) return true;
    if (!meaning?.line_id && !meaningLineNo && meaning?.line === line.text) return true;
    return false;
  });
}

export function buildStructuredLyricsFromRaw(lyrics: string | null | undefined): StructuredSection[] | null {
  if (!lyrics || !lyrics.trim()) return null;

  const normalized = lyrics.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const blocks = normalized.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length === 0) return null;

  const sections: StructuredSection[] = [];

  let sectionOrder = 1;
  let lineNo = 1;

  blocks.forEach((block) => {
    const blockLines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    if (blockLines.length === 0) return;

    let label: string | null = null;
    const headerMatch = blockLines[0].match(/^\[(.*?)\]$/);
    if (headerMatch) {
      label = headerMatch[1].trim();
      blockLines.shift();
    }

    const lines = blockLines.map((text) => {
      const line = { lineId: `line-${lineNo}`, lineNo, text };
      lineNo += 1;
      return line;
    });

    if (!label && lines.length === 0) return;

    sections.push({
      sectionId: `section-${sectionOrder}`,
      label,
      order: sectionOrder,
      lines,
    });
    sectionOrder += 1;
  });

  return sections.length > 0 ? sections : null;
}

export function normalizeStructuredLyrics(structured: any, fallbackLyrics?: string): StructuredSection[] | null {
  if (Array.isArray(structured) && structured.length > 0) {
    const sections = structured.map((section: any, index: number) => {
      const lines = Array.isArray(section?.lines)
        ? section.lines
            .map((line: any, lineIndex: number) => ({
              lineId: String(line?.line_id || line?.lineId || `line-${line?.line_no || line?.lineNo || lineIndex + 1}`),
              lineNo: Number(line?.line_no || line?.lineNo || lineIndex + 1),
              text: String(line?.text || '').trim(),
            }))
            .filter((line: any) => line.text.length > 0)
        : [];

      return {
        sectionId: String(section?.section_id || section?.sectionId || `section-${index + 1}`),
        label: normalizeLineLabel(section?.label),
        order: Number(section?.order || index + 1),
        lines,
      };
    }).filter((section: any) => section.label || section.lines.length > 0);

    if (sections.length > 0) return sections;
  }

  return buildStructuredLyricsFromRaw(fallbackLyrics || null);
}
