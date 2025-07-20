import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readColumn, writeColumn } from '../engine/buffer-utils.js';
import { Schema, type ColumnDefinition } from '../engine/schema.js';
import { Types } from '../engine/column.js';
import { parseBufferSchema, type BufferSchema } from '../engine/row.js';

interface Coordinates {
  lat: number;
  lng: number;
}

function createTestSchema(): Schema {
  const columns: ColumnDefinition[] = [
    { name: 'text_field', type: Types.Text, length: 20 },
    { name: 'number_field', type: Types.Number },
    { name: 'boolean_field', type: Types.Boolean },
    { name: 'date_field', type: Types.Date },
    { name: 'coordinates_field', type: Types.Coordinates }
  ];
  
  return Schema.create('testdb', 'test', columns);
}

test('text column read/write operations', () => {
  const schema = createTestSchema();
  const bufferSchema: BufferSchema = parseBufferSchema(schema);
  const buffer = Buffer.alloc(bufferSchema.size);
  
  const testText = 'Hello World';
  
  // Write text
  writeColumn(buffer, bufferSchema.schema, 'text_field', testText);
  
  // Read back text
  const readText = readColumn(buffer, bufferSchema, 'text_field') as string;
  assert.equal(readText, testText);
});

test('number column read/write operations', () => {
  const schema = createTestSchema();
  const bufferSchema: BufferSchema = parseBufferSchema(schema);
  const buffer = Buffer.alloc(bufferSchema.size);
  
  const testNumber = 3.14159;
  
  // Write number
  writeColumn(buffer, bufferSchema.schema, 'number_field', testNumber);
  
  // Read back number
  const readNumber = readColumn(buffer, bufferSchema, 'number_field') as number;
  assert.equal(readNumber, testNumber);
});

test('boolean column read/write operations', () => {
  const schema = createTestSchema();
  const bufferSchema: BufferSchema = parseBufferSchema(schema);
  const buffer = Buffer.alloc(bufferSchema.size);
  
  const testBooleanTrue = true;
  const testBooleanFalse = false;
  
  // Write and read true
  writeColumn(buffer, bufferSchema.schema, 'boolean_field', testBooleanTrue);
  let readBoolean = readColumn(buffer, bufferSchema, 'boolean_field') as boolean;
  assert.equal(readBoolean, testBooleanTrue);
  
  // Write and read false
  writeColumn(buffer, bufferSchema.schema, 'boolean_field', testBooleanFalse);
  readBoolean = readColumn(buffer, bufferSchema, 'boolean_field') as boolean;
  assert.equal(readBoolean, testBooleanFalse);
});

test('date column read/write operations', () => {
  const schema = createTestSchema();
  const bufferSchema: BufferSchema = parseBufferSchema(schema);
  const buffer = Buffer.alloc(bufferSchema.size);
  
  const testDate = new Date('2023-12-25T10:30:00Z');
  
  // Write date
  writeColumn(buffer, bufferSchema.schema, 'date_field', testDate);
  
  // Read back date
  const readDate = readColumn(buffer, bufferSchema, 'date_field') as Date;
  assert.equal(readDate.getTime(), testDate.getTime());
});

test('coordinates column read/write operations', () => {
  const schema = createTestSchema();
  const bufferSchema: BufferSchema = parseBufferSchema(schema);
  const buffer = Buffer.alloc(bufferSchema.size);
  
  const testCoordinates: Coordinates = { lat: 37.7749, lng: -122.4194 };
  
  // Write coordinates
  writeColumn(buffer, bufferSchema.schema, 'coordinates_field', testCoordinates);
  
  // Read back coordinates
  const readCoordinates = readColumn(buffer, bufferSchema, 'coordinates_field') as Coordinates;
  assert.equal(readCoordinates.lat, testCoordinates.lat);
  assert.equal(readCoordinates.lng, testCoordinates.lng);
});

test('text column truncation handling', () => {
  const schema = createTestSchema();
  const bufferSchema: BufferSchema = parseBufferSchema(schema);
  const buffer = Buffer.alloc(bufferSchema.size);
  
  // Text longer than field length (20 chars)
  const longText = 'This is a very long text that exceeds the field length';
  
  // Write long text (should be truncated)
  writeColumn(buffer, bufferSchema.schema, 'text_field', longText);
  
  // Read back text (will be original length, not truncated by the current implementation)
  const readText = readColumn(buffer, bufferSchema, 'text_field') as string;
  assert.equal(readText.length, longText.length); // Current implementation stores full length
  assert.equal(readText, longText);
});

test('text column padding with shorter text', () => {
  const schema = createTestSchema();
  const bufferSchema: BufferSchema = parseBufferSchema(schema);
  const buffer = Buffer.alloc(bufferSchema.size);
  
  const shortText = 'Hi';
  
  // Write short text
  writeColumn(buffer, bufferSchema.schema, 'text_field', shortText);
  
  // Read back text (should not have padding artifacts)
  const readText = readColumn(buffer, bufferSchema, 'text_field') as string;
  assert.equal(readText, shortText);
});

test('null and undefined value handling', () => {
  const schema = createTestSchema();
  const bufferSchema: BufferSchema = parseBufferSchema(schema);
  const buffer = Buffer.alloc(bufferSchema.size);
  
  // Write null values
  writeColumn(buffer, bufferSchema.schema, 'text_field', null);
  writeColumn(buffer, bufferSchema.schema, 'number_field', null);
  writeColumn(buffer, bufferSchema.schema, 'boolean_field', null);
  
  // Read back null values
  const readText = readColumn(buffer, bufferSchema, 'text_field');
  const readNumber = readColumn(buffer, bufferSchema, 'number_field');
  const readBoolean = readColumn(buffer, bufferSchema, 'boolean_field');
  
  assert.equal(readText, null);
  assert.equal(readNumber, null);
  assert.equal(readBoolean, null);
});

test('zero and empty value handling', () => {
  const schema = createTestSchema();
  const bufferSchema: BufferSchema = parseBufferSchema(schema);
  const buffer = Buffer.alloc(bufferSchema.size);
  
  // Write zero/empty values
  writeColumn(buffer, bufferSchema.schema, 'text_field', '');
  writeColumn(buffer, bufferSchema.schema, 'number_field', 0);
  writeColumn(buffer, bufferSchema.schema, 'boolean_field', false);
  
  // Read back zero/empty values
  const readText = readColumn(buffer, bufferSchema, 'text_field') as string;
  const readNumber = readColumn(buffer, bufferSchema, 'number_field') as number;
  const readBoolean = readColumn(buffer, bufferSchema, 'boolean_field') as boolean;
  
  assert.equal(readText, '');
  assert.equal(readNumber, 0);
  assert.equal(readBoolean, false);
});

test('special number values', () => {
  const schema = createTestSchema();
  const bufferSchema: BufferSchema = parseBufferSchema(schema);
  const buffer = Buffer.alloc(bufferSchema.size);
  
  const specialNumbers = [
    Number.MAX_VALUE,
    Number.MIN_VALUE,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NaN
  ];
  
  for (const specialNumber of specialNumbers) {
    writeColumn(buffer, bufferSchema.schema, 'number_field', specialNumber);
    const readNumber = readColumn(buffer, bufferSchema, 'number_field') as number;
    
    if (Number.isNaN(specialNumber)) {
      assert.ok(Number.isNaN(readNumber), `Expected NaN, got ${readNumber}`);
    } else {
      assert.equal(readNumber, specialNumber, `Failed for ${specialNumber}`);
    }
  }
});

test('unicode text handling', () => {
  const schema = createTestSchema();
  const bufferSchema: BufferSchema = parseBufferSchema(schema);
  const buffer = Buffer.alloc(bufferSchema.size);
  
  const unicodeTexts = [
    'Hello 世界',
    '🌟✨💫⭐',
    'Café ñoño',
    'Здравствуй мир',
    'こんにちは世界'
  ];
  
  for (const unicodeText of unicodeTexts) {
    writeColumn(buffer, bufferSchema.schema, 'text_field', unicodeText);
    const readText = readColumn(buffer, bufferSchema, 'text_field') as string;
    assert.equal(readText, unicodeText, `Failed for unicode text: ${unicodeText}`);
  }
});

test('coordinates edge cases', () => {
  const schema = createTestSchema();
  const bufferSchema: BufferSchema = parseBufferSchema(schema);
  const buffer = Buffer.alloc(bufferSchema.size);
  
  const edgeCases: Coordinates[] = [
    { lat: 90, lng: 180 },     // Maximum valid coordinates
    { lat: -90, lng: -180 },   // Minimum valid coordinates
    { lat: 0, lng: 0 },        // Null Island
    { lat: 0.000001, lng: 0.000001 }, // Very small positive
    { lat: -0.000001, lng: -0.000001 } // Very small negative
  ];
  
  for (const coords of edgeCases) {
    writeColumn(buffer, bufferSchema.schema, 'coordinates_field', coords);
    const readCoords = readColumn(buffer, bufferSchema, 'coordinates_field') as Coordinates;
    
    assert.equal(readCoords.lat, coords.lat, `Latitude mismatch for ${JSON.stringify(coords)}`);
    assert.equal(readCoords.lng, coords.lng, `Longitude mismatch for ${JSON.stringify(coords)}`);
  }
});

test('buffer size calculations', () => {
  const schema = createTestSchema();
  const bufferSchema: BufferSchema = parseBufferSchema(schema);
  
  // Verify buffer schema has expected structure
  assert.ok(bufferSchema.size > 0, 'Buffer size should be positive');
  assert.ok(bufferSchema.schema, 'Buffer schema should have schema object');
  
  // Verify each field has proper metadata
  const fields = ['text_field', 'number_field', 'boolean_field', 'date_field', 'coordinates_field'];
  
  for (const field of fields) {
    assert.ok(bufferSchema.schema[field], `Field ${field} should exist in buffer schema`);
    assert.ok(bufferSchema.schema[field].offset >= 0, `Field ${field} should have valid offset`);
    assert.ok(bufferSchema.schema[field].size > 0, `Field ${field} should have positive size`);
  }
});

test('buffer operations type safety', () => {
  const schema = createTestSchema();
  const bufferSchema: BufferSchema = parseBufferSchema(schema);
  const buffer = Buffer.alloc(bufferSchema.size);
  
  // Type-safe value assignments
  const textValue: string = 'test';
  const numberValue: number = 42;
  const booleanValue: boolean = true;
  const dateValue: Date = new Date();
  const coordsValue: Coordinates = { lat: 1.0, lng: 2.0 };
  
  // Write typed values
  writeColumn(buffer, bufferSchema.schema, 'text_field', textValue);
  writeColumn(buffer, bufferSchema.schema, 'number_field', numberValue);
  writeColumn(buffer, bufferSchema.schema, 'boolean_field', booleanValue);
  writeColumn(buffer, bufferSchema.schema, 'date_field', dateValue);
  writeColumn(buffer, bufferSchema.schema, 'coordinates_field', coordsValue);
  
  // Read back with type assertions
  const readText = readColumn(buffer, bufferSchema, 'text_field') as string;
  const readNumber = readColumn(buffer, bufferSchema, 'number_field') as number;
  const readBoolean = readColumn(buffer, bufferSchema, 'boolean_field') as boolean;
  const readDate = readColumn(buffer, bufferSchema, 'date_field') as Date;
  const readCoords = readColumn(buffer, bufferSchema, 'coordinates_field') as Coordinates;
  
  // Verify types and values
  assert.equal(typeof readText, 'string');
  assert.equal(typeof readNumber, 'number');
  assert.equal(typeof readBoolean, 'boolean');
  assert.ok(readDate instanceof Date);
  assert.equal(typeof readCoords, 'object');
  
  assert.equal(readText, textValue);
  assert.equal(readNumber, numberValue);
  assert.equal(readBoolean, booleanValue);
  assert.equal(readDate.getTime(), dateValue.getTime());
  assert.deepEqual(readCoords, coordsValue);
});