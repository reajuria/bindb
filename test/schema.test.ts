import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Schema, type ColumnDefinition } from '../engine/schema.js';
import { Types } from '../engine/column.js';

test('Schema create and toJSON/fromJSON', () => {
  const columnDef: ColumnDefinition = { name: 'name', type: Types.Text, length: 10 };
  const schema = Schema.create('db', 'items', [columnDef]);
  
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
  
  const validColumn: ColumnDefinition = { name: 'name', type: Types.Text, length: 10 };
  schema.addColumn(validColumn);
  
  // Test duplicate column name
  assert.throws(
    () => {
      const duplicateColumn: ColumnDefinition = { name: 'name', type: Types.Text, length: 5 };
      schema.addColumn(duplicateColumn);
    },
    /already exists/
  );
  
  // Test invalid type
  assert.throws(
    () => {
      const invalidColumn = { name: 'other', type: 'Nope' as any };
      schema.addColumn(invalidColumn);
    },
    /Invalid type/
  );
});