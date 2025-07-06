import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Schema } from '../engine/schema.js';
import { Types } from '../engine/column.js';
import {
  parseBufferSchema,
  dataRowToBuffer,
  parseDataRow,
  RowStatus,
} from '../engine/row.js';

test('data row round trip', () => {
  const schema = Schema.create('db', 'items', [
    { name: 'name', type: Types.Text, length: 10 },
    { name: 'value', type: Types.Number },
    { name: 'flag', type: Types.Boolean },
    { name: 'when', type: Types.Date },
  ]);
  const bufferSchema = parseBufferSchema(schema);
  const row = {
    name: 'foo',
    value: 42,
    flag: true,
    when: new Date('2020-01-02T00:00:00Z'),
  };
  const buf = dataRowToBuffer(bufferSchema, row);
  const parsed = parseDataRow(bufferSchema, buf);
  assert.equal(parsed.name, row.name);
  assert.equal(parsed.value, row.value);
  assert.equal(parsed.flag, row.flag);
  assert.equal(parsed.when.getTime(), row.when.getTime());
  assert.ok(parsed.id);
  assert.equal(parsed.id.length, 24);
});

test('parse deleted row', () => {
  const schema = Schema.create('db', 'items', [
    { name: 'name', type: Types.Text, length: 10 },
  ]);
  const bufferSchema = parseBufferSchema(schema);
  const buf = dataRowToBuffer(bufferSchema, { name: 'foo' }, RowStatus.Deleted);
  assert.equal(parseDataRow(bufferSchema, buf), null);
});

test('parseDataRow error cases', () => {
  const schema = Schema.create('db', 'items', [
    { name: 'name', type: Types.Text, length: 10 },
  ]);
  const bufferSchema = parseBufferSchema(schema);
  assert.throws(
    () => parseDataRow(bufferSchema, Buffer.alloc(bufferSchema.size - 1)),
    /Buffer size mismatch/
  );
  const buf = Buffer.alloc(bufferSchema.size);
  buf.writeUInt8(0xfe, 0); // invalid flag
  assert.throws(
    () => parseDataRow(bufferSchema, buf),
    /Invalid row flag/
  );
});
