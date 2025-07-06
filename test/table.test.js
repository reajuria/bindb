import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Database } from '../engine/database.js';
import { Schema } from '../engine/schema.js';
import { Types } from '../engine/column.js';

async function createTempDB() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bindb-'));
  const db = await Database.create(dir, 'testdb');
  const schema = new Schema();
  schema.addColumn({ name: 'name', type: Types.Text, length: 20 });
  await db.createTable('items', schema);
  return { dir, db };
}

test('insert and read row', async () => {
  const { dir, db } = await createTempDB();
  const table = db.table('items');
  const inserted = await table.insert({ name: 'foo' });

  const db2 = new Database(dir, 'testdb');
  await db2.initDatabase();
  const table2 = db2.table('items');
  const row = await table2.get(inserted.id);

  assert.deepEqual(row, inserted);
});
