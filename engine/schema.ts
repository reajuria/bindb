import { Types, type ColumnDefinition } from './column.js';

// Re-export for external use
export type { ColumnDefinition };
import { strHash } from './util.js';

export interface SchemaJSON {
  database: string;
  table: string;
  columns: ColumnDefinition[];
}

export class Schema {
  private _database: string = '';
  private _table: string = '';
  private _columns: ColumnDefinition[] = [];
  private _tableHash: string | null = null;
  private _tableHashBuffer: Buffer | null = null;

  /**
   * Create a new schema
   */
  static create(
    database: string,
    table: string,
    columns: ColumnDefinition[]
  ): Schema {
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
   */
  static fromJSON(json: SchemaJSON): Schema {
    const { database, table, columns } = json;
    return Schema.create(database, table, columns);
  }

  constructor() {}

  get columns(): ColumnDefinition[] {
    return this._columns;
  }

  get database(): string {
    return this._database;
  }

  get table(): string {
    return this._table;
  }

  set database(database: string) {
    this._database = database;
    this._invalidateTableHash();
  }

  set table(table: string) {
    this._table = table;
    this._invalidateTableHash();
  }

  addColumn(column: ColumnDefinition): void {
    const { name, type, length } = column;
    if (Types[type] === undefined) {
      throw new Error(`Invalid type ${type}`);
    }
    if (this._columns.find(col => col.name === name) !== undefined) {
      throw new Error(`Column ${name} already exists`);
    }

    this._columns.push({
      name,
      type,
      ...(length !== undefined && { length }),
    });
  }

  /**
   * Get the cached table hash for uniqueId generation
   * Computes once and caches for performance
   */
  get tableHash(): string | null {
    if (!this._tableHash && this._database && this._table) {
      this._tableHash = strHash(4, this._database, this._table);
    }
    return this._tableHash;
  }

  /**
   * Get the cached table hash buffer for uniqueId generation
   * Pre-computed Buffer for maximum performance
   */
  get tableHashBuffer(): Buffer | null {
    if (!this._tableHashBuffer && this.tableHash) {
      this._tableHashBuffer = Buffer.from(this.tableHash, 'hex');
    }
    return this._tableHashBuffer;
  }

  /**
   * Invalidate cached hash when database/table changes
   * @private
   */
  private _invalidateTableHash(): void {
    this._tableHash = null;
    this._tableHashBuffer = null;
  }

  toJSON(): SchemaJSON {
    return {
      database: this._database,
      table: this._table,
      columns: this._columns,
    };
  }
}
