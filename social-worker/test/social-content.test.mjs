import assert from 'node:assert/strict';
import test from 'node:test';

import {
  prepareSocialThread,
  removeSocialLinks,
  SHARED_SOCIAL_LIMIT,
} from '../src/social-content.js';

test('removes archive links while preserving the Cureation copy', () => {
  const input = `“I think it’s dark and it looks like rain”\n\nPlainsong, the 1st track on Disintegration by The Cure.\nhttps://cureation.com/songs/plainsong`;

  assert.equal(
    removeSocialLinks(input),
    `“I think it’s dark and it looks like rain”\n\nPlainsong, the 1st track on Disintegration by The Cure.`
  );
});

test('removes every http and www link from shared posts', () => {
  const input = 'Read https://cureation.com/news/example and www.example.com/source for more.';

  assert.equal(removeSocialLinks(input), 'Read and for more.');
});

test('returns one unchanged thread for both channels', () => {
  const input = 'On this day in 1989: The Cure in London.';

  assert.deepEqual(prepareSocialThread([input]), [input]);
});

test('splits long copy without links, truncation, or lost words', () => {
  const words = Array.from({ length: 110 }, (_, index) => `detail${index + 1}`);
  const thread = prepareSocialThread([`${words.join(' ')}\nhttps://cureation.com/archive`]);

  assert.ok(thread.length > 1);
  assert.ok(thread.every((post) => post.length <= SHARED_SOCIAL_LIMIT));
  assert.ok(thread.every((post) => !post.includes('http')));
  assert.deepEqual(thread.join(' ').split(/\s+/), words);
});
