import { strHash } from '../engine/util.js';

describe('Util Functions', () => {
  test('strHash deterministic and length', () => {
    const h1: string = strHash(4, 'foo', 'bar');
    const h2: string = strHash(4, 'foo', 'bar');
    expect(h1).toHaveLength(8);
    expect(h1).toBe(h2);
  });
});