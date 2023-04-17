import path from 'node:path';
import { Database } from './engine/database.js';
import { Schema } from './engine/schema.js';
import { Types } from './engine/column.js';

async function init() {
  const dataBasePath = path.join(process.cwd(), 'data');

  const testDB = await Database.create(dataBasePath, 'test');

  const testSchema = new Schema();
  testSchema.addColumn({
    name: 'id',
    type: Types.UniqueIdentifier,
  });
  testSchema.addColumn({
    name: 'name',
    type: Types.Text,
    length: 50,
  });

  await testDB.createTable('test', testSchema);
}

async function test() {
  const dataBasePath = path.join(process.cwd(), 'data');

  const testDB = new Database(dataBasePath, 'test');
  await testDB.initDatabase();

  const testTable = testDB.table('test');

  console.time('test');
  for (let i = 0; i < 1000; i++) {
    await testTable.insert({
      name: `test ${i}`,
    });
  }
  console.timeEnd('test');
}

// init();
test();
