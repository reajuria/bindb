import { Types, createColumnDefinition } from '../engine/column';
import { Database } from '../engine/database';
import { Schema } from '../engine/schema';

describe('Table', () => {
  it('database and table basic operations', async () => {
    const dbPath = `./test-data-basic-${Date.now()}`;
    const db = new Database(dbPath, 'testdb');
    await db.initDatabase();

    const schema = Schema.create('testdb', 'test_table', [
      createColumnDefinition('name', Types.Text, { length: 50 }),
      createColumnDefinition('age', Types.Number),
    ]);

    await db.createTable('test_table', schema);
    const table = db.table('test_table');
    expect(table).toBeTruthy();

    if (table) {
      const rowData = { name: 'John Doe', age: 30 };
      const insertedRow = await table.insert(rowData);

      expect(insertedRow.id).toBeTruthy();

      const result = await table.get(insertedRow.id as string);
      expect(result).toBeTruthy();
    }

    await db.close();
  });
});
