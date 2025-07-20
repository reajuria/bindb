import { Types, type ColumnDefinition } from '../engine/column.js';
import {
  calculateBufferSchema,
  validateBufferSchema,
  getBufferSchemaStats,
  DEFAULT_TEXT_LENGTH,
} from '../engine/buffer-schema-calculator.js';
import { Schema } from '../engine/schema.js';

describe('BufferSchemaCalculator', () => {
  let schema: Schema;

  beforeEach(() => {
    schema = new Schema('test_db', 'test_table');
  });

  describe('Basic Buffer Schema Calculation', () => {
    it('should calculate buffer schema for simple columns', () => {
      schema.addColumn({ name: 'id', type: Types.UniqueIdentifier });
      schema.addColumn({ name: 'name', type: Types.Text, length: 50 });
      schema.addColumn({ name: 'age', type: Types.Number });

      const bufferSchema = calculateBufferSchema(schema);

      expect(bufferSchema.columns.id).toBeDefined();
      expect(bufferSchema.columns.name).toBeDefined();
      expect(bufferSchema.columns.age).toBeDefined();
      expect(bufferSchema.totalSize).toBeGreaterThan(0);
    });

    it('should include status byte in total size', () => {
      schema.addColumn({ name: 'id', type: Types.UniqueIdentifier });

      const bufferSchema = calculateBufferSchema(schema);
      
      // Should include status byte (1) + ID field (12) = 13 minimum
      expect(bufferSchema.totalSize).toBeGreaterThanOrEqual(13);
    });

    it('should assign sequential offsets to columns', () => {
      schema.addColumn({ name: 'id', type: Types.UniqueIdentifier });
      schema.addColumn({ name: 'name', type: Types.Text, length: 20 });
      schema.addColumn({ name: 'active', type: Types.Boolean });

      const bufferSchema = calculateBufferSchema(schema);

      // Status byte is at offset 0, then columns follow
      expect(bufferSchema.columns.id.offset).toBe(1);
      expect(bufferSchema.columns.name.offset).toBeGreaterThan(bufferSchema.columns.id.offset);
      expect(bufferSchema.columns.active.offset).toBeGreaterThan(bufferSchema.columns.name.offset);
    });
  });

  describe('Column Type Handling', () => {
    it('should handle UniqueIdentifier type correctly', () => {
      schema.addColumn({ name: 'id', type: Types.UniqueIdentifier });

      const bufferSchema = calculateBufferSchema(schema);
      const idColumn = bufferSchema.columns.id;

      expect(idColumn.type).toBe(Types.UniqueIdentifier);
      expect(idColumn.size).toBe(12); // UNIQUE_IDENTIFIER_SIZE
      expect(idColumn.nullFlag).toBe(0); // Not nullable
    });

    it('should handle Text type with custom length', () => {
      const textLength = 100;
      schema.addColumn({ name: 'description', type: Types.Text, length: textLength });

      const bufferSchema = calculateBufferSchema(schema);
      const textColumn = bufferSchema.columns.description;

      expect(textColumn.type).toBe(Types.Text);
      expect(textColumn.size).toBe(textLength + 2); // Length + size header
      expect(textColumn.nullFlag).toBeGreaterThan(0);
    });

    it('should handle Text type with default length', () => {
      schema.addColumn({ name: 'name', type: Types.Text }); // No length specified

      const bufferSchema = calculateBufferSchema(schema);
      const textColumn = bufferSchema.columns.name;

      expect(textColumn.size).toBe(DEFAULT_TEXT_LENGTH + 2);
    });

    it('should handle Number type correctly', () => {
      schema.addColumn({ name: 'price', type: Types.Number });

      const bufferSchema = calculateBufferSchema(schema);
      const numberColumn = bufferSchema.columns.price;

      expect(numberColumn.type).toBe(Types.Number);
      expect(numberColumn.size).toBe(8); // DOUBLE_SIZE
      expect(numberColumn.nullFlag).toBeGreaterThan(0);
    });

    it('should handle Boolean type correctly', () => {
      schema.addColumn({ name: 'active', type: Types.Boolean });

      const bufferSchema = calculateBufferSchema(schema);
      const boolColumn = bufferSchema.columns.active;

      expect(boolColumn.type).toBe(Types.Boolean);
      expect(boolColumn.size).toBe(1); // BYTE_SIZE
      expect(boolColumn.nullFlag).toBeGreaterThan(0);
    });

    it('should handle Date type correctly', () => {
      schema.addColumn({ name: 'created_at', type: Types.Date });

      const bufferSchema = calculateBufferSchema(schema);
      const dateColumn = bufferSchema.columns.created_at;

      expect(dateColumn.type).toBe(Types.Date);
      expect(dateColumn.size).toBe(8); // DOUBLE_SIZE
      expect(dateColumn.nullFlag).toBeGreaterThan(0);
    });

    it('should handle UpdatedAt type correctly', () => {
      schema.addColumn({ name: 'updated_at', type: Types.UpdatedAt });

      const bufferSchema = calculateBufferSchema(schema);
      const updatedColumn = bufferSchema.columns.updated_at;

      expect(updatedColumn.type).toBe(Types.UpdatedAt);
      expect(updatedColumn.size).toBe(8); // DOUBLE_SIZE
      expect(updatedColumn.nullFlag).toBe(0); // Not nullable
    });

    it('should handle Buffer type correctly', () => {
      const bufferLength = 256;
      schema.addColumn({ name: 'data', type: Types.Buffer, length: bufferLength });

      const bufferSchema = calculateBufferSchema(schema);
      const bufferColumn = bufferSchema.columns.data;

      expect(bufferColumn.type).toBe(Types.Buffer);
      expect(bufferColumn.size).toBe(bufferLength + 2); // Length + size header
      expect(bufferColumn.nullFlag).toBeGreaterThan(0);
    });

    it('should handle Coordinates type correctly', () => {
      schema.addColumn({ name: 'location', type: Types.Coordinates });

      const bufferSchema = calculateBufferSchema(schema);
      const coordColumn = bufferSchema.columns.location;

      expect(coordColumn.type).toBe(Types.Coordinates);
      expect(coordColumn.size).toBe(16); // COORDINATES_SIZE
      expect(coordColumn.nullFlag).toBeGreaterThan(0);
    });
  });

  describe('Null Flag Management', () => {
    it('should assign unique null flag bits to nullable columns', () => {
      schema.addColumn({ name: 'id', type: Types.UniqueIdentifier }); // Not nullable
      schema.addColumn({ name: 'name', type: Types.Text, length: 50 }); // Nullable
      schema.addColumn({ name: 'age', type: Types.Number }); // Nullable
      schema.addColumn({ name: 'active', type: Types.Boolean }); // Nullable

      const bufferSchema = calculateBufferSchema(schema);

      // ID should have null flag 0 (not nullable)
      expect(bufferSchema.columns.id.nullFlag).toBe(0);

      // Other columns should have unique null flag bits
      const nullFlags = [
        bufferSchema.columns.name.nullFlag,
        bufferSchema.columns.age.nullFlag,
        bufferSchema.columns.active.nullFlag,
      ];

      // Should be powers of 2 (1, 2, 4, 8, etc.)
      nullFlags.forEach(flag => {
        expect(flag).toBeGreaterThan(0);
        expect((flag & (flag - 1))).toBe(0); // Power of 2 check
      });

      // Should be unique
      const uniqueFlags = new Set(nullFlags);
      expect(uniqueFlags.size).toBe(nullFlags.length);
    });

    it('should handle many nullable columns', () => {
      // Add many nullable columns to test null flag overflow handling
      for (let i = 0; i < 10; i++) {
        schema.addColumn({ name: `field${i}`, type: Types.Text, length: 10 });
      }

      const bufferSchema = calculateBufferSchema(schema);

      // All should have different null flags
      const nullFlags = Object.values(bufferSchema.columns).map(col => col.nullFlag);
      const uniqueFlags = new Set(nullFlags.filter(flag => flag > 0));
      
      expect(uniqueFlags.size).toBe(10); // All 10 nullable columns should have unique flags
    });
  });

  describe('Buffer Schema Validation', () => {
    it('should validate correct buffer schema', () => {
      schema.addColumn({ name: 'id', type: Types.UniqueIdentifier });
      schema.addColumn({ name: 'name', type: Types.Text, length: 50 });

      const bufferSchema = calculateBufferSchema(schema);
      const validation = validateBufferSchema(bufferSchema);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing columns', () => {
      const invalidSchema = {
        columns: {},
        totalSize: 0,
      };

      const validation = validateBufferSchema(invalidSchema);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Buffer schema has no columns');
    });

    it('should detect zero total size', () => {
      const invalidSchema = {
        columns: {
          id: { type: Types.UniqueIdentifier, offset: 0, size: 12, nullFlag: 0 },
        },
        totalSize: 0, // Invalid
      };

      const validation = validateBufferSchema(invalidSchema);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Buffer schema total size must be greater than 0');
    });

    it('should detect negative offsets', () => {
      const invalidSchema = {
        columns: {
          id: { type: Types.UniqueIdentifier, offset: -1, size: 12, nullFlag: 0 },
        },
        totalSize: 12,
      };

      const validation = validateBufferSchema(invalidSchema);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should detect zero or negative sizes', () => {
      const invalidSchema = {
        columns: {
          id: { type: Types.UniqueIdentifier, offset: 0, size: 0, nullFlag: 0 },
        },
        totalSize: 12,
      };

      const validation = validateBufferSchema(invalidSchema);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should detect overlapping columns', () => {
      const invalidSchema = {
        columns: {
          id: { type: Types.UniqueIdentifier, offset: 1, size: 12, nullFlag: 0 },
          name: { type: Types.Text, offset: 5, size: 20, nullFlag: 1 }, // Overlaps with id
        },
        totalSize: 25,
      };

      const validation = validateBufferSchema(invalidSchema);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(err => err.includes('overlap'))).toBe(true);
    });

    it('should detect columns extending beyond total size', () => {
      const invalidSchema = {
        columns: {
          id: { type: Types.UniqueIdentifier, offset: 1, size: 12, nullFlag: 0 },
          name: { type: Types.Text, offset: 13, size: 20, nullFlag: 1 },
        },
        totalSize: 30, // Too small for last column
      };

      const validation = validateBufferSchema(invalidSchema);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(err => err.includes('extends beyond'))).toBe(true);
    });
  });

  describe('Buffer Schema Statistics', () => {
    it('should calculate correct statistics', () => {
      schema.addColumn({ name: 'id', type: Types.UniqueIdentifier });
      schema.addColumn({ name: 'name', type: Types.Text, length: 50 });
      schema.addColumn({ name: 'age', type: Types.Number });
      schema.addColumn({ name: 'active', type: Types.Boolean });

      const bufferSchema = calculateBufferSchema(schema);
      const stats = getBufferSchemaStats(bufferSchema);

      expect(stats.columnCount).toBe(4);
      expect(stats.nullableColumns).toBe(3); // name, age, active
      expect(stats.totalSize).toBe(bufferSchema.totalSize);
      expect(stats.averageColumnSize).toBeGreaterThan(0);
      expect(stats.nullFlagsUsed).toBe(3); // For the 3 nullable columns
    });

    it('should handle schema with only non-nullable columns', () => {
      schema.addColumn({ name: 'id', type: Types.UniqueIdentifier });
      schema.addColumn({ name: 'updated_at', type: Types.UpdatedAt });

      const bufferSchema = calculateBufferSchema(schema);
      const stats = getBufferSchemaStats(bufferSchema);

      expect(stats.columnCount).toBe(2);
      expect(stats.nullableColumns).toBe(0);
      expect(stats.nullFlagsUsed).toBe(0);
    });

    it('should calculate average column size correctly', () => {
      schema.addColumn({ name: 'id', type: Types.UniqueIdentifier }); // 12 bytes
      schema.addColumn({ name: 'price', type: Types.Number }); // 8 bytes

      const bufferSchema = calculateBufferSchema(schema);
      const stats = getBufferSchemaStats(bufferSchema);

      expect(stats.averageColumnSize).toBe(10); // (12 + 8) / 2
    });
  });

  describe('Complex Schema Scenarios', () => {
    it('should handle schema with all column types', () => {
      schema.addColumn({ name: 'id', type: Types.UniqueIdentifier });
      schema.addColumn({ name: 'name', type: Types.Text, length: 100 });
      schema.addColumn({ name: 'age', type: Types.Number });
      schema.addColumn({ name: 'active', type: Types.Boolean });
      schema.addColumn({ name: 'created_at', type: Types.Date });
      schema.addColumn({ name: 'updated_at', type: Types.UpdatedAt });
      schema.addColumn({ name: 'data', type: Types.Buffer, length: 512 });
      schema.addColumn({ name: 'location', type: Types.Coordinates });

      const bufferSchema = calculateBufferSchema(schema);

      expect(Object.keys(bufferSchema.columns)).toHaveLength(8);
      expect(bufferSchema.totalSize).toBeGreaterThan(500); // Should be substantial

      const validation = validateBufferSchema(bufferSchema);
      expect(validation.isValid).toBe(true);
    });

    it('should handle large text fields', () => {
      schema.addColumn({ name: 'id', type: Types.UniqueIdentifier });
      schema.addColumn({ name: 'content', type: Types.Text, length: 10000 });

      const bufferSchema = calculateBufferSchema(schema);
      const contentColumn = bufferSchema.columns.content;

      expect(contentColumn.size).toBe(10002); // 10000 + 2 for size header
      expect(bufferSchema.totalSize).toBeGreaterThan(10000);
    });

    it('should handle schema with many small columns', () => {
      schema.addColumn({ name: 'id', type: Types.UniqueIdentifier });
      
      // Add 20 boolean columns
      for (let i = 0; i < 20; i++) {
        schema.addColumn({ name: `flag${i}`, type: Types.Boolean });
      }

      const bufferSchema = calculateBufferSchema(schema);

      expect(Object.keys(bufferSchema.columns)).toHaveLength(21);
      
      // Each boolean is 1 byte, plus ID (12), plus status (1) = 34 minimum
      expect(bufferSchema.totalSize).toBeGreaterThanOrEqual(34);

      const validation = validateBufferSchema(bufferSchema);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty schema gracefully', () => {
      const bufferSchema = calculateBufferSchema(schema);

      // Should still have status byte
      expect(bufferSchema.totalSize).toBe(1);
      expect(Object.keys(bufferSchema.columns)).toHaveLength(0);
    });

    it('should handle schema with only ID field', () => {
      schema.addColumn({ name: 'id', type: Types.UniqueIdentifier });

      const bufferSchema = calculateBufferSchema(schema);

      expect(bufferSchema.totalSize).toBe(13); // Status (1) + ID (12)
      expect(Object.keys(bufferSchema.columns)).toHaveLength(1);
    });

    it('should handle very long column names', () => {
      const longName = 'a'.repeat(1000);
      schema.addColumn({ name: longName, type: Types.Text, length: 50 });

      const bufferSchema = calculateBufferSchema(schema);

      expect(bufferSchema.columns[longName]).toBeDefined();
      expect(bufferSchema.columns[longName].size).toBe(52);
    });

    it('should handle Text columns with minimum length', () => {
      schema.addColumn({ name: 'tiny', type: Types.Text, length: 1 });

      const bufferSchema = calculateBufferSchema(schema);
      const tinyColumn = bufferSchema.columns.tiny;

      expect(tinyColumn.size).toBe(3); // 1 + 2 for size header
    });

    it('should handle Buffer columns with minimum length', () => {
      schema.addColumn({ name: 'small_buffer', type: Types.Buffer, length: 1 });

      const bufferSchema = calculateBufferSchema(schema);
      const bufferColumn = bufferSchema.columns.small_buffer;

      expect(bufferColumn.size).toBe(3); // 1 + 2 for size header
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unknown column type', () => {
      const invalidColumn = { name: 'invalid', type: 'InvalidType' as any };
      schema.addColumn(invalidColumn);

      expect(() => calculateBufferSchema(schema)).toThrow('Unknown column type');
    });

    it('should handle columns without required length', () => {
      // This should use default length
      schema.addColumn({ name: 'text_no_length', type: Types.Text });

      const bufferSchema = calculateBufferSchema(schema);
      const textColumn = bufferSchema.columns.text_no_length;

      expect(textColumn.size).toBe(DEFAULT_TEXT_LENGTH + 2);
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large schemas efficiently', () => {
      const startTime = Date.now();

      // Create a large schema
      schema.addColumn({ name: 'id', type: Types.UniqueIdentifier });
      for (let i = 0; i < 100; i++) {
        schema.addColumn({ name: `field${i}`, type: Types.Text, length: 50 });
      }

      const bufferSchema = calculateBufferSchema(schema);
      const endTime = Date.now();

      expect(Object.keys(bufferSchema.columns)).toHaveLength(101);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second

      const validation = validateBufferSchema(bufferSchema);
      expect(validation.isValid).toBe(true);
    });

    it('should produce consistent results for same schema', () => {
      schema.addColumn({ name: 'id', type: Types.UniqueIdentifier });
      schema.addColumn({ name: 'name', type: Types.Text, length: 50 });
      schema.addColumn({ name: 'age', type: Types.Number });

      const bufferSchema1 = calculateBufferSchema(schema);
      const bufferSchema2 = calculateBufferSchema(schema);

      expect(bufferSchema1.totalSize).toBe(bufferSchema2.totalSize);
      expect(bufferSchema1.columns.id.offset).toBe(bufferSchema2.columns.id.offset);
      expect(bufferSchema1.columns.name.offset).toBe(bufferSchema2.columns.name.offset);
      expect(bufferSchema1.columns.age.offset).toBe(bufferSchema2.columns.age.offset);
    });
  });
});