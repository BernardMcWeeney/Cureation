import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLyricPostText,
  normalizeLyricSections,
  ordinal,
  selectLyricPassage,
} from '../src/lyric-social.js';

test('normalizes structured lyrics and removes embedded section labels', () => {
  const sections = normalizeLyricSections(JSON.stringify([
    { lines: [{ text: 'First line' }, { text: 'Second line' }] },
    { lines: [{ text: '[Chorus]' }, { text: 'Third line' }] },
  ]));

  assert.deepEqual(sections, [['First line', 'Second line'], ['Third line']]);
});

test('selects up to three adjacent lines without crossing a lyric section', () => {
  const sections = [
    ['Verse one', 'Verse two', 'Verse three'],
    ['So I trick myself', 'Like everybody else'],
  ];

  assert.deepEqual(selectLyricPassage(sections, 4), [
    'So I trick myself',
    'Like everybody else',
  ]);
  assert.deepEqual(selectLyricPassage(sections, 1), [
    'Verse one',
    'Verse two',
    'Verse three',
  ]);
});

test('builds the requested editorial lyric post with no link or hashtag', () => {
  const text = buildLyricPostText({
    lines: ['So I trick myself', 'Like everybody else'],
    title: 'Sinking',
    trackNumber: 10,
    albumTitle: 'The Head on the Door',
  });

  assert.equal(
    text,
    '“So I trick myself\nLike everybody else”\n\nSinking, the 10th track on The Head on the Door by The Cure.'
  );
  assert.ok(text.length <= 280);
  assert.ok(!text.includes('#'));
  assert.ok(!text.includes('http'));
});

test('uses correct English ordinals', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 10, 11, 12, 13, 21].map(ordinal),
    ['1st', '2nd', '3rd', '4th', '10th', '11th', '12th', '13th', '21st']
  );
});

test('reduces the passage line count before truncating copy', () => {
  const text = buildLyricPostText({
    lines: ['A'.repeat(80), 'B'.repeat(80), 'C'.repeat(80)],
    title: 'A Short Song',
    albumTitle: 'A Short Album',
  }, 180);

  assert.ok(text.includes('A'.repeat(80)));
  assert.ok(!text.includes('C'.repeat(80)));
  assert.ok(text.length <= 180);
});
