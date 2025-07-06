import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Schema } from '../engine/schema.js';
import { Types } from '../engine/column.js';


test('Schema create and toJSON/fromJSON', () => {
  const schema = Schema.create('db', 'items', [
    { name: 'name', type: Types.Text, length: 10 },
  ]);
  assert.equal(schema.database, 'db');
  assert.equal(schema.table, 'items');
  assert.equal(schema.columns.length, 1);
  const json = schema.toJSON();
  const loaded = Schema.fromJSON(json);
  assert.deepEqual(loaded.toJSON(), json);
});

test('Schema addColumn validation', () => {
  const schema = new Schema();
  schema.database = 'db';
  schema.table = 'items';
  schema.addColumn({ name: 'name', type: Types.Text, length: 10 });
  assert.throws(
    () => schema.addColumn({ name: 'name', type: Types.Text, length: 5 }),
    /already exists/
  );
  assert.throws(
    () => schema.addColumn({ name: 'other', type: 'Nope' }),
    /Invalid type/
  );
});
