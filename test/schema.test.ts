import { Schema, type ColumnDefinition } from '../engine/schema.js';
import { Types } from '../engine/column.js';

describe('Schema', () => {
  it('Schema create and toJSON/fromJSON', () => {
    const columnDef: ColumnDefinition = {
      name: 'name',
      type: Types.Text,
      length: 10,
    };
    const schema = Schema.create('db', 'items', [columnDef]);

    expect(schema.database).toBe('db');
    expect(schema.table).toBe('items');
    expect(schema.columns.length).toBe(1);

    const json = schema.toJSON();
    const loaded = Schema.fromJSON(json);
    expect(loaded.toJSON()).toEqual(json);
  });

  it('Schema addColumn validation', () => {
    const schema = new Schema();
    schema.database = 'db';
    schema.table = 'items';

    const validColumn: ColumnDefinition = {
      name: 'name',
      type: Types.Text,
      length: 10,
    };
    schema.addColumn(validColumn);

    // Test duplicate column name
    expect(() => {
      const duplicateColumn: ColumnDefinition = {
        name: 'name',
        type: Types.Text,
        length: 5,
      };
      schema.addColumn(duplicateColumn);
    }).toThrow(/already exists/);

    // Test invalid type
    expect(() => {
      const invalidColumn = { name: 'other', type: 'Nope' as any };
      schema.addColumn(invalidColumn);
    }).toThrow(/Invalid type/);
  });
});
