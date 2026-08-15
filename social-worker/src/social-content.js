export const SHARED_SOCIAL_LIMIT = 280;

const LINK_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<]+/gi;
const LINK_ONLY_PATTERN = /^\s*(?:https?:\/\/|www\.)[^\s<]+\s*$/i;

/**
 * Produce the one link-free thread that is published unchanged to X and
 * Bluesky. Long text is split instead of truncated so the full copy survives.
 */
export function prepareSocialThread(posts, maxLength = SHARED_SOCIAL_LIMIT) {
  return posts
    .flatMap((post) => splitSocialText(removeSocialLinks(post), maxLength))
    .filter(Boolean);
}

export function removeSocialLinks(text) {
  return String(text || '')
    .split('\n')
    .filter((line) => !LINK_ONLY_PATTERN.test(line))
    .join('\n')
    .replace(LINK_PATTERN, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitSocialText(text, maxLength) {
  if (!text) return [];
  if (text.length <= maxLength) return [text];

  const units = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const chunks = [];
  let current = '';

  const pushCurrent = () => {
    if (current) chunks.push(current);
    current = '';
  };

  for (const unit of units) {
    const pieces = unit.length <= maxLength ? [unit] : splitLongUnit(unit, maxLength);
    for (const piece of pieces) {
      const candidate = current ? `${current}\n${piece}` : piece;
      if (candidate.length <= maxLength) {
        current = candidate;
      } else {
        pushCurrent();
        current = piece;
      }
    }
  }

  pushCurrent();
  return chunks;
}

function splitLongUnit(text, maxLength) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  let current = '';

  for (const word of words) {
    if (word.length > maxLength) {
      if (current) chunks.push(current);
      current = '';
      for (let offset = 0; offset < word.length; offset += maxLength) {
        chunks.push(word.slice(offset, offset + maxLength));
      }
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxLength) {
      current = candidate;
    } else {
      chunks.push(current);
      current = word;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}
