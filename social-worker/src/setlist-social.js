import { prepareSocialThread, SHARED_SOCIAL_LIMIT } from './social-content.js';

export function buildOnThisDaySetlistThread(
  setlist,
  songs,
  maxLength = SHARED_SOCIAL_LIMIT
) {
  const year = String(setlist?.date || '').slice(0, 4) || 'the archive';
  return buildSetlistThread([
    `On this day in ${year}: The Cure at ${showLocation(setlist)}.`,
    setlist?.tour_name || '',
    `${songs.length} songs performed.`,
    '',
    'Full setlist:',
    ...setlistSongLines(songs),
  ], maxLength);
}

export function buildFullSetlistThread(
  setlist,
  songs,
  maxLength = SHARED_SOCIAL_LIMIT
) {
  return buildSetlistThread([
    `The Cure at ${showLocation(setlist)}`,
    [setlist?.date, setlist?.tour_name].filter(Boolean).join(' - '),
    '',
    'Full setlist:',
    ...setlistSongLines(songs),
  ], maxLength);
}

export function setlistSongLines(songs) {
  let currentSetType = '';
  const lines = [];

  for (const [index, song] of songs.entries()) {
    const setType = String(song?.set_type || '').trim();
    if (setType && setType !== currentSetType) {
      currentSetType = setType;
      lines.push('');
      lines.push(setTypeLabel(setType));
    }

    const position = song?.position ?? index + 1;
    const title = String(song?.song_title || 'Untitled').trim() || 'Untitled';
    const cover = song?.is_cover && song?.cover_artist ? ` [${song.cover_artist}]` : '';
    const notes = song?.notes ? ` (${String(song.notes).trim()})` : '';
    lines.push(`${position}. ${title}${cover}${notes}`);
  }

  return lines;
}

function buildSetlistThread(lines, maxLength) {
  return prepareSocialThread([lines.filter((line) => line !== null && line !== undefined).join('\n')], maxLength);
}

function showLocation(setlist) {
  return [setlist?.venue || 'Unknown venue', setlist?.city, setlist?.country]
    .filter(Boolean)
    .join(', ');
}

function setTypeLabel(value) {
  if (value.toLowerCase() === 'main') return 'Main set';
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
