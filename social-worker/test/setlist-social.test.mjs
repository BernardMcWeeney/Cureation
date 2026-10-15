import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildFullSetlistThread,
  buildOnThisDaySetlistThread,
  setlistSongLines,
} from '../src/setlist-social.js';

const newcastle = {
  date: '1981-08-16',
  venue: 'Newcastle Civic Theatre',
  city: 'Newcastle',
  country: 'Australia',
  tour_name: 'The Picture Tour (Australasian Leg)',
};

test('on-this-day posts contain the complete setlist as a thread', () => {
  const songs = Array.from({ length: 22 }, (_, index) => ({
    position: index + 1,
    set_type: index < 18 ? 'main' : 'encore',
    song_title: `Song ${index + 1}`,
  }));
  const thread = buildOnThisDaySetlistThread(newcastle, songs, 120);
  const fullCopy = thread.join('\n');

  assert.ok(thread.length > 1);
  assert.ok(thread.every((post) => post.length <= 120));
  assert.ok(fullCopy.includes('On this day in 1981'));
  assert.ok(fullCopy.includes('1. Song 1'));
  assert.ok(fullCopy.includes('22. Song 22'));
  assert.ok(!fullCopy.includes('and 17 more'));
  assert.ok(!fullCopy.includes('...and'));
});

test('keeps guest and performance notes with their songs', () => {
  const notes = "With added saxophone played by Jason Cooper's son Gabriel";
  const lines = setlistSongLines([{
    position: 15,
    set_type: 'main',
    song_title: 'A Night Like This',
    notes,
  }]);

  assert.deepEqual(lines, [
    '',
    'Main set',
    `15. A Night Like This (${notes})`,
  ]);
});

test('preserves long notes across posts instead of truncating them', () => {
  const noteWords = Array.from({ length: 80 }, (_, index) => `detail${index + 1}`);
  const thread = buildFullSetlistThread(newcastle, [{
    position: 1,
    set_type: 'main',
    song_title: 'A Forest',
    notes: noteWords.join(' '),
  }], 100);
  const allWords = thread.join(' ').match(/detail\d+/g);

  assert.deepEqual(allWords, noteWords);
  assert.ok(thread.every((post) => post.length <= 100));
});
