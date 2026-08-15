import assert from 'node:assert/strict';
import test from 'node:test';

import {
  chooseTourAssignment,
  cleanCompletedShowNotes,
  findUniqueNormalizedPlaceholder,
  normalizePlaceName,
} from '../src/setlist-merge.js';

test('normalizes accented and unaccented city names identically', () => {
  assert.equal(normalizePlaceName('Nîmes'), normalizePlaceName('Nimes'));
});

test('selects only a unique normalized placeholder', () => {
  const placeholder = { id: 2427, city: 'Nimes' };

  assert.equal(
    findUniqueNormalizedPlaceholder([placeholder, { id: 1, city: 'Paris' }], 'Nîmes'),
    placeholder
  );
  assert.equal(
    findUniqueNormalizedPlaceholder([placeholder, { id: 2, city: 'Nîmes' }], 'Nîmes'),
    null
  );
});

test('preserves Cureation tour metadata when enriching an existing show', () => {
  assert.deepEqual(
    chooseTourAssignment(
      { tour: 98, tour_name: '2026 European Summer Shows' },
      'Festival Summer 2026',
      99
    ),
    { tourId: 98, tourName: '2026 European Summer Shows' }
  );
});

test('uses Setlist.fm tour metadata for a genuinely new show', () => {
  assert.deepEqual(
    chooseTourAssignment(null, 'Festival Summer 2026', 99),
    { tourId: 99, tourName: 'Festival Summer 2026' }
  );
});

test('removes stale pending wording after songs have imported', () => {
  assert.equal(
    cleanCompletedShowNotes(
      'Upcoming 2026 festival appearance announced on The Cure official shows page. Setlist pending.',
      23
    ),
    '2026 festival appearance announced on The Cure official shows page.'
  );
});
