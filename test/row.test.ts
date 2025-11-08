import { Types } from '../engine/column';
import {
  dataRowToBuffer,
  parseBufferSchema,
  parseDataRow,
  RowStatus,
  type BufferSchema,
  type RowData,
} from '../engine/row';
import { Schema, type ColumnDefinition } from '../engine/schema';

describe('Row', () => {
  interface TestRowData extends Record<string, any> {
    name: string;
    value: number;
    flag: boolean;
    when: Date;
  }

  it('data row round trip', () => {
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

    expect(parsed.name).toBe(row.name);
    expect(parsed.value).toBe(row.value);
    expect(parsed.flag).toBe(row.flag);
    expect((parsed.when as Date).getTime()).toBe(row.when.getTime());
    expect(parsed.id).toBeTruthy();
    expect((parsed.id as string).length).toBe(24);
  });

  it('parse deleted row', () => {
    const columns: ColumnDefinition[] = [
      { name: 'name', type: Types.Text, length: 10 },
    ];

    const schema = Schema.create('db', 'items', columns);
    const bufferSchema: BufferSchema = parseBufferSchema(schema);
    const buf: Buffer = dataRowToBuffer(
      bufferSchema,
      { name: 'foo' },
      RowStatus.Deleted
    );

    expect(parseDataRow(bufferSchema, buf)).toBeNull();
  });

  it('parseDataRow error cases', () => {
    const columns: ColumnDefinition[] = [
      { name: 'name', type: Types.Text, length: 10 },
    ];

    const schema = Schema.create('db', 'items', columns);
    const bufferSchema: BufferSchema = parseBufferSchema(schema);

    expect(() =>
      parseDataRow(bufferSchema, Buffer.alloc(bufferSchema.size - 1))
    ).toThrow(/Invalid buffer size/);

    const buf: Buffer = Buffer.alloc(bufferSchema.size);
    buf.writeUInt8(0xfe, 0); // invalid flag
    expect(() => parseDataRow(bufferSchema, buf)).toThrow(/Invalid row flag/);
  });
});
