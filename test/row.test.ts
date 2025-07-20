import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Schema, type ColumnDefinition } from '../engine/schema.js';
import { Types } from '../engine/column.js';
import {
  parseBufferSchema,
  dataRowToBuffer,
  parseDataRow,
  RowStatus,
  type BufferSchema,
  type RowData
} from '../engine/row.js';

interface TestRowData extends Record<string, any> {
  name: string;
  value: number;
  flag: boolean;
  when: Date;
}

test('data row round trip', () => {
  const columns: ColumnDefinition[] = [
    { name: 'name', type: Types.Text, length: 10 },
    { name: 'value', type: Types.Number },
    { name: 'flag', type: Types.Boolean },
    { name: 'when', type: Types.Date },
  ];
  
  const schema = Schema.create('db', 'items', columns);
  const bufferSchema: BufferSchema = parseBufferSchema(schema);
  
  const row: TestRowData = {
    name: 'foo',
    value: 42,
    flag: true,
    when: new Date('2020-01-02T00:00:00Z'),
  };
  
  const buf: Buffer = dataRowToBuffer(bufferSchema, row);
  const parsed = parseDataRow(bufferSchema, buf) as RowData;
  
  assert.equal(parsed.name, row.name);
  assert.equal(parsed.value, row.value);
  assert.equal(parsed.flag, row.flag);
  assert.equal((parsed.when as Date).getTime(), row.when.getTime());
  assert.ok(parsed.id);
  assert.equal((parsed.id as string).length, 24);
});

test('parse deleted row', () => {
  const columns: ColumnDefinition[] = [
    { name: 'name', type: Types.Text, length: 10 },
  ];
  
  const schema = Schema.create('db', 'items', columns);
  const bufferSchema: BufferSchema = parseBufferSchema(schema);
  const buf: Buffer = dataRowToBuffer(bufferSchema, { name: 'foo' }, RowStatus.Deleted);
  
  assert.equal(parseDataRow(bufferSchema, buf), null);
});

test('parseDataRow error cases', () => {
  const columns: ColumnDefinition[] = [
    { name: 'name', type: Types.Text, length: 10 },
  ];
  
  const schema = Schema.create('db', 'items', columns);
  const bufferSchema: BufferSchema = parseBufferSchema(schema);
  
  assert.throws(
    () => parseDataRow(bufferSchema, Buffer.alloc(bufferSchema.size - 1)),
    /Buffer size mismatch/
  );
  
  const buf: Buffer = Buffer.alloc(bufferSchema.size);
  buf.writeUInt8(0xfe, 0); // invalid flag
  assert.throws(
    () => parseDataRow(bufferSchema, buf),
    /Invalid row flag/
  );
});