import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Types } from '../engine/column.js';
import { Database } from '../engine/database.js';
import { Schema, type ColumnDefinition } from '../engine/schema.js';

describe('Database', () => {
  async function createTempDir(): Promise<string> {
    return fs.mkdtemp(path.join(os.tmpdir(), 'bindb-'));
  }

  it('database metadata persistence', async () => {
    const dir: string = await createTempDir();
    let db: Database | undefined;
    let db2: Database | undefined;

    try {
      db = await Database.create(dir, 'testdb');

      const columns: ColumnDefinition[] = [
        { name: 'name', type: Types.Text, length: 10 },
      ];
      const schema = Schema.create('testdb', 'items', columns);

      await db.createTable('items', schema);

      const metadataPath: string = path.join(dir, 'testdb', 'db_metadata.json');
      const stat = await fs.stat(metadataPath);
      expect(stat.isFile()).toBeTruthy();

      db2 = new Database(dir, 'testdb');
      await db2.initDatabase();
      expect(db2.table('items')).toBeTruthy();
    } finally {
      // Cleanup file handles and temp directory
      await db?.close();
      await db2?.close();
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
