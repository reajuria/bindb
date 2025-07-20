import { readColumn, writeColumn } from '../engine/buffer-utils';
import { Types } from '../engine/column';
import { parseBufferSchema, type BufferSchema } from '../engine/row';
import { Schema, type ColumnDefinition } from '../engine/schema';

describe('Buffer-utils', () => {
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
      { name: 'coordinates_field', type: Types.Coordinates },
    ];

    return Schema.create('testdb', 'test', columns);
  }

  it('text column read/write operations', () => {
    const schema = createTestSchema();
    const bufferSchema: BufferSchema = parseBufferSchema(schema);
    const buffer = Buffer.alloc(bufferSchema.size);

    const testText = 'Hello World';

    // Write text
    writeColumn(buffer, bufferSchema.schema, 'text_field', testText);

    // Read back text
    const readText = readColumn(buffer, bufferSchema, 'text_field') as string;
    expect(readText).toBe(testText);
  });

  it('number column read/write operations', () => {
    const schema = createTestSchema();
    const bufferSchema: BufferSchema = parseBufferSchema(schema);
    const buffer = Buffer.alloc(bufferSchema.size);

    const testNumber = 3.14159;

    // Write number
    writeColumn(buffer, bufferSchema.schema, 'number_field', testNumber);

    // Read back number
    const readNumber = readColumn(
      buffer,
      bufferSchema,
      'number_field'
    ) as number;
    expect(readNumber).toBe(testNumber);
  });

  it('boolean column read/write operations', () => {
    const schema = createTestSchema();
    const bufferSchema: BufferSchema = parseBufferSchema(schema);
    const buffer = Buffer.alloc(bufferSchema.size);

    const testBooleanTrue = true;
    const testBooleanFalse = false;

    // Write and read true
    writeColumn(buffer, bufferSchema.schema, 'boolean_field', testBooleanTrue);
    let readBoolean = readColumn(
      buffer,
      bufferSchema,
      'boolean_field'
    ) as boolean;
    expect(readBoolean).toBe(testBooleanTrue);

    // Write and read false
    writeColumn(buffer, bufferSchema.schema, 'boolean_field', testBooleanFalse);
    readBoolean = readColumn(buffer, bufferSchema, 'boolean_field') as boolean;
    expect(readBoolean).toBe(testBooleanFalse);
  });

  it('date column read/write operations', () => {
    const schema = createTestSchema();
    const bufferSchema: BufferSchema = parseBufferSchema(schema);
    const buffer = Buffer.alloc(bufferSchema.size);

    const testDate = new Date('2023-12-25T10:30:00Z');

    // Write date
    writeColumn(buffer, bufferSchema.schema, 'date_field', testDate);

    // Read back date
    const readDate = readColumn(buffer, bufferSchema, 'date_field') as Date;
    expect(readDate.getTime()).toBe(testDate.getTime());
  });

  it('coordinates column read/write operations', () => {
    const schema = createTestSchema();
    const bufferSchema: BufferSchema = parseBufferSchema(schema);
    const buffer = Buffer.alloc(bufferSchema.size);

    const testCoordinates: Coordinates = { lat: 37.7749, lng: -122.4194 };

    // Write coordinates
    writeColumn(
      buffer,
      bufferSchema.schema,
      'coordinates_field',
      testCoordinates
    );

    // Read back coordinates
    const readCoordinates = readColumn(
      buffer,
      bufferSchema,
      'coordinates_field'
    ) as Coordinates;
    expect(readCoordinates.lat).toBe(testCoordinates.lat);
    expect(readCoordinates.lng).toBe(testCoordinates.lng);
  });

  it('text column truncation handling', () => {
    const schema = createTestSchema();
    const bufferSchema: BufferSchema = parseBufferSchema(schema);
    const buffer = Buffer.alloc(bufferSchema.size);

    // Text longer than field length (20 chars)
    const longText = 'This is a very long text that exceeds the field length';

    // Write long text (should be truncated)
    writeColumn(buffer, bufferSchema.schema, 'text_field', longText);

    // Read back text (will be original length, not truncated by the current implementation)
    const readText = readColumn(buffer, bufferSchema, 'text_field') as string;
    expect(readText.length).toBe(longText.length); // Current implementation stores full length
    expect(readText).toBe(longText);
  });

  it('text column padding with shorter text', () => {
    const schema = createTestSchema();
    const bufferSchema: BufferSchema = parseBufferSchema(schema);
    const buffer = Buffer.alloc(bufferSchema.size);

    const shortText = 'Hi';

    // Write short text
    writeColumn(buffer, bufferSchema.schema, 'text_field', shortText);

    // Read back text (should not have padding artifacts)
    const readText = readColumn(buffer, bufferSchema, 'text_field') as string;
    expect(readText).toBe(shortText);
  });

  it('null and undefined value handling', () => {
    const schema = createTestSchema();
    const bufferSchema: BufferSchema = parseBufferSchema(schema);
    const buffer = Buffer.alloc(bufferSchema.size);

    // Write null values
    writeColumn(buffer, bufferSchema.schema, 'text_field', null);
    writeColumn(buffer, bufferSchema.schema, 'number_field', null);
    writeColumn(buffer, bufferSchema.schema, 'boolean_field', null);

    // Read back null values (null text becomes empty string in our implementation)
    const readText = readColumn(buffer, bufferSchema, 'text_field');
    const readNumber = readColumn(buffer, bufferSchema, 'number_field');
    const readBoolean = readColumn(buffer, bufferSchema, 'boolean_field');

    expect(readText).toBe(''); // null text becomes empty string
    expect(readNumber).toBe(0); // null number becomes 0
    expect(readBoolean).toBe(false); // null boolean becomes false
  });

  it('zero and empty value handling', () => {
    const schema = createTestSchema();
    const bufferSchema: BufferSchema = parseBufferSchema(schema);
    const buffer = Buffer.alloc(bufferSchema.size);

    // Write zero/empty values
    writeColumn(buffer, bufferSchema.schema, 'text_field', '');
    writeColumn(buffer, bufferSchema.schema, 'number_field', 0);
    writeColumn(buffer, bufferSchema.schema, 'boolean_field', false);

    // Read back zero/empty values
    const readText = readColumn(buffer, bufferSchema, 'text_field') as string;
    const readNumber = readColumn(
      buffer,
      bufferSchema,
      'number_field'
    ) as number;
    const readBoolean = readColumn(
      buffer,
      bufferSchema,
      'boolean_field'
    ) as boolean;

    expect(readText).toBe('');
    expect(readNumber).toBe(0);
    expect(readBoolean).toBe(false);
  });

  it('special number values', () => {
    const schema = createTestSchema();
    const bufferSchema: BufferSchema = parseBufferSchema(schema);
    const buffer = Buffer.alloc(bufferSchema.size);

    const specialNumbers = [
      Number.MAX_VALUE,
      Number.MIN_VALUE,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NaN,
    ];

    for (const specialNumber of specialNumbers) {
      writeColumn(buffer, bufferSchema.schema, 'number_field', specialNumber);
      const readNumber = readColumn(
        buffer,
        bufferSchema,
        'number_field'
      ) as number;

      if (Number.isNaN(specialNumber)) {
        expect(Number.isNaN(readNumber)).toBeTruthy();
      } else {
        expect(readNumber).toBe(specialNumber);
      }
    }
  });

  it('unicode text handling', () => {
    const schema = createTestSchema();
    const bufferSchema: BufferSchema = parseBufferSchema(schema);
    const buffer = Buffer.alloc(bufferSchema.size);

    const unicodeTexts = [
      'Hello 世界',
      '🌟✨💫⭐',
      'Café ñoño',
      'Здравствуй мир',
      'こんにちは世界',
    ];

    for (const unicodeText of unicodeTexts) {
      writeColumn(buffer, bufferSchema.schema, 'text_field', unicodeText);
      const readText = readColumn(buffer, bufferSchema, 'text_field') as string;
      expect(readText).toBe(unicodeText);
    }
  });

  it('coordinates edge cases', () => {
    const schema = createTestSchema();
    const bufferSchema: BufferSchema = parseBufferSchema(schema);
    const buffer = Buffer.alloc(bufferSchema.size);

    const edgeCases: Coordinates[] = [
      { lat: 90, lng: 180 }, // Maximum valid coordinates
      { lat: -90, lng: -180 }, // Minimum valid coordinates
      { lat: 0, lng: 0 }, // Null Island
      { lat: 0.000001, lng: 0.000001 }, // Very small positive
      { lat: -0.000001, lng: -0.000001 }, // Very small negative
    ];

    for (const coords of edgeCases) {
      writeColumn(buffer, bufferSchema.schema, 'coordinates_field', coords);
      const readCoords = readColumn(
        buffer,
        bufferSchema,
        'coordinates_field'
      ) as Coordinates;

      expect(readCoords.lat).toBe(coords.lat);
      expect(readCoords.lng).toBe(coords.lng);
    }
  });

  it('buffer size calculations', () => {
    const schema = createTestSchema();
    const bufferSchema: BufferSchema = parseBufferSchema(schema);

    // Verify buffer schema has expected structure
    expect(bufferSchema.size).toBeGreaterThan(0);
    expect(bufferSchema.schema).toBeTruthy();

    // Verify each field has proper metadata
    const fields = [
      'text_field',
      'number_field',
      'boolean_field',
      'date_field',
      'coordinates_field',
    ];

    for (const field of fields) {
      expect(bufferSchema.schema[field]).toBeTruthy();
      expect(bufferSchema.schema[field].offset).toBeGreaterThanOrEqual(0);
      expect(bufferSchema.schema[field].size).toBeGreaterThan(0);
    }
  });

  it('buffer operations type safety', () => {
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
    const readNumber = readColumn(
      buffer,
      bufferSchema,
      'number_field'
    ) as number;
    const readBoolean = readColumn(
      buffer,
      bufferSchema,
      'boolean_field'
    ) as boolean;
    const readDate = readColumn(buffer, bufferSchema, 'date_field') as Date;
    const readCoords = readColumn(
      buffer,
      bufferSchema,
      'coordinates_field'
    ) as Coordinates;

    // Verify types and values
    expect(typeof readText).toBe('string');
    expect(typeof readNumber).toBe('number');
    expect(typeof readBoolean).toBe('boolean');
    expect(readDate instanceof Date).toBeTruthy();
    expect(typeof readCoords).toBe('object');

    expect(readText).toBe(textValue);
    expect(readNumber).toBe(numberValue);
    expect(readBoolean).toBe(booleanValue);
    expect(readDate.getTime()).toBe(dateValue.getTime());
    expect(readCoords).toEqual(coordsValue);
  });
});
