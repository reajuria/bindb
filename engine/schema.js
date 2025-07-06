import { Types } from './column.js';
import { strHash } from './util.js';

export class Schema {
  /**
   * Create a new schema
   * @param {string} database - The database name
   * @param {string} table - The table name
   * @param {Array} columns - The columns
   * @returns {Schema}
   */
  static create(database, table, columns) {
    const schema = new Schema();
    schema._database = database;
    schema._table = table;
    for (const column of columns) {
      schema.addColumn(column);
    }
    return schema;
  }

  /**
   * Create a new schema from a JSON object
   * @param {Object} json - The JSON object
   * @returns {Schema}
   */
  static fromJSON(json) {
    const { database, table, columns } = json;
    return Schema.create(database, table, columns);
  }

  constructor() {
    this._database = '';
    this._table = '';
    this._columns = [];
    this._tableHash = null;
    this._tableHashBuffer = null;
  }

  get columns() {
    return this._columns;
  }

  get database() {
    return this._database;
  }

  get table() {
    return this._table;
  }

  set database(database) {
    this._database = database;
    this._invalidateTableHash();
  }

  set table(table) {
    this._table = table;
    this._invalidateTableHash();
  }

  addColumn(column) {
    const { name, type, length } = column;
    if (Types[type] === undefined) {
      throw new Error(`Invalid type ${type}`);
    }
    if (this._columns.find((column) => column.name === name) !== undefined) {
      throw new Error(`Column ${name} already exists`);
    }

    this._columns.push({
      name,
      type,
      length,
    });
  }

  /**
   * Get the cached table hash for uniqueId generation
   * Computes once and caches for performance
   */
  get tableHash() {
    if (!this._tableHash && this._database && this._table) {
      this._tableHash = strHash(4, this._database, this._table);
    }
    return this._tableHash;
  }

  /**
   * Get the cached table hash buffer for uniqueId generation
   * Pre-computed Buffer for maximum performance
   */
  get tableHashBuffer() {
    if (!this._tableHashBuffer && this.tableHash) {
      this._tableHashBuffer = Buffer.from(this.tableHash, 'hex');
    }
    return this._tableHashBuffer;
  }

  /**
   * Invalidate cached hash when database/table changes
   * @private
   */
  _invalidateTableHash() {
    this._tableHash = null;
    this._tableHashBuffer = null;
  }

  toJSON() {
    return {
      database: this._database,
      table: this._table,
      columns: this._columns,
    };
  }
}
