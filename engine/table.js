import fs from 'node:fs/promises';
import path from 'node:path';
import {
  RowStatus,
  dataRowToBuffer,
  parseBufferSchema,
  parseDataRow,
} from './row.js';
import { Schema } from './schema.js';
import { readColumn } from './buffer-utils.js';
import { ID_FIELD, UNIQUE_IDENTIFIER_SIZE } from './constants.js';

export class Table {
  /**
   * @param {string} storageBasePath
   * @param {import('./database.js').Database} database
   * @param {string} name
   */
  constructor(storageBasePath, database, name) {
    this.storageBasePath = storageBasePath;
    this.database = database;
    this.name = name;
    this.idMap = [];

    this.schemaFilePath = path.join(
      this.storageBasePath,
      database.name,
      `${name}.schema.json`
    );

    this.dataFilePath = path.join(
      this.storageBasePath,
      database.name,
      `${name}.data`
    );
  }

  /**
   * @param {import('./schema.js').Schema} schema
   * @returns {Promise<void>}
   */
  async initTable(schema) {
    schema.database = this.database.name;
    schema.table = this.name;
    await fs.writeFile(this.schemaFilePath, JSON.stringify(schema.toJSON()));
    const dataFileExists = await fs.access(this.dataFilePath).then(
      () => true,
      () => false
    );
    if (!dataFileExists) {
      await fs.writeFile(this.dataFilePath, '');
    }
    await this.loadSchema();
  }

  async loadSchema(force = false) {
    if (this.schema && !force) {
      return;
    }
    const schema = Schema.fromJSON(
      JSON.parse(await fs.readFile(this.schemaFilePath, 'utf8'))
    );
    this.schema = schema;
    this.bufferSchema = parseBufferSchema(schema);
  }

  async loadTable() {
    await this.loadSchema();
    const handle = await fs.open(this.dataFilePath, 'r');
    const stat = await handle.stat();
    const size = stat.size;
    let i = 0;
    for (let p = 0; p < size; p += this.bufferSchema.size) {
      const nullRowFlag = await handle.read(Buffer.alloc(1), 0, 1, p);
      if (nullRowFlag === RowStatus.Deleted) {
        this.idMap[i] = null;
      } else {
        const size = this.bufferSchema.schema[ID_FIELD].nullFlag + 1;
        const { buffer } = await handle.read(Buffer.alloc(size), 0, size, p);
        const id = readColumn(buffer, this.bufferSchema, ID_FIELD);
        this.idMap[i] = id;
      }
      i++;
    }

    console.log(
      `Loaded ${this.name} with ${this.idMap.filter((id) => id).length} rows`
    );

    await handle.close();
  }

  getOffset(slot) {
    return (slot === 0 ? 0 : slot - 1) * this.bufferSchema.size;
  }

  findEmptySlot() {
    const ix = this.idMap.findIndex((id) => !id);
    return ix === -1 ? this.idMap.length + 1 : ix + 1;
  }

  async insert(row) {
    const handle = await fs.open(this.dataFilePath, 'r+');
    const buffer = dataRowToBuffer(this.bufferSchema, row);
    const slot = this.findEmptySlot();
    const pos = this.getOffset(slot);
    await handle.write(buffer, 0, buffer.length, pos);
    await handle.close();
    const data = parseDataRow(this.bufferSchema, buffer);
    this.idMap[slot - 1] = data[ID_FIELD];
    return data;
  }
}
