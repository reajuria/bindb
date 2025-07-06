import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Database } from '../engine/database.js';
import { Schema } from '../engine/schema.js';
import { Types } from '../engine/column.js';

async function createTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'bindb-'));
}

test('database metadata persistence', async () => {
  const dir = await createTempDir();
  let db, db2;
  
  try {
    db = await Database.create(dir, 'testdb');
    const schema = Schema.create('testdb', 'items', [
      { name: 'name', type: Types.Text, length: 10 },
    ]);
    await db.createTable('items', schema);
    const metadataPath = path.join(dir, 'testdb', 'db_metadata.json');
    const stat = await fs.stat(metadataPath);
    assert.ok(stat.isFile());

    db2 = new Database(dir, 'testdb');
    await db2.initDatabase();
    assert.ok(db2.table('items'));
  } finally {
    // Cleanup file handles and temp directory
    await db?.close();
    await db2?.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
