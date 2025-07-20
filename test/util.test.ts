import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strHash } from '../engine/util.js';

test('strHash deterministic and length', () => {
  const h1: string = strHash(4, 'foo', 'bar');
  const h2: string = strHash(4, 'foo', 'bar');
  assert.equal(h1.length, 8);
  assert.equal(h1, h2);
});