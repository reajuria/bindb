import { uniqueId, uniqueIdDate } from '../engine/id-generator.js';

describe('Column Functions', () => {
  test('uniqueId length and date extraction', () => {
    const id: string = uniqueId('foo');
    expect(id).toHaveLength(24);
    const d: Date = uniqueIdDate(id);
    expect(d).toBeInstanceOf(Date);
    expect(d.getTime()).not.toBeNaN();
  });
});
