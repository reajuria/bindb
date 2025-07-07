import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uniqueId, uniqueIdDate } from '../engine/id-generator.js';

test('uniqueId length and date extraction', () => {
  const id = uniqueId('foo');
  assert.equal(id.length, 24);
  const d = uniqueIdDate(id);
  assert(d instanceof Date);
  assert.ok(!Number.isNaN(d.getTime()));
});
