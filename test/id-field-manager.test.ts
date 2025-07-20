import { Types, type ColumnDefinition } from '../engine/column.js';
import {
  ensureIdField,
  findIdColumn,
  addIdField,
  configureExistingIdField,
  createIdColumnDefinition,
  validateIdField,
  isIdField,
  getIdFieldRequirements,
  createIdFieldConfig,
  applyIdFieldConfig,
} from '../engine/id-field-manager.js';
import { Schema } from '../engine/schema.js';

describe('IdFieldManager', () => {
  let schema: Schema;
  
  beforeEach(() => {
    schema = new Schema('test_db', 'test_table');
  });

  describe('findIdColumn', () => {
    it('should find existing ID column by name', () => {
      const columns: ColumnDefinition[] = [
        { name: 'name', type: Types.Text, length: 50 },
        { name: 'id', type: Types.UniqueIdentifier },
        { name: 'age', type: Types.Number },
      ];

      const idColumn = findIdColumn(columns);
      expect(idColumn).toBeDefined();
      expect(idColumn?.name).toBe('id');
      expect(idColumn?.type).toBe(Types.UniqueIdentifier);
    });

    it('should return null when no ID column exists', () => {
      const columns: ColumnDefinition[] = [
        { name: 'name', type: Types.Text, length: 50 },
        { name: 'age', type: Types.Number },
      ];

      const idColumn = findIdColumn(columns);
      expect(idColumn).toBeNull();
    });

    it('should find ID column regardless of position', () => {
      const columns: ColumnDefinition[] = [
        { name: 'name', type: Types.Text, length: 50 },
        { name: 'age', type: Types.Number },
        { name: 'id', type: Types.UniqueIdentifier },
      ];

      const idColumn = findIdColumn(columns);
      expect(idColumn).toBeDefined();
      expect(idColumn?.name).toBe('id');
    });
  });

  describe('isIdField', () => {
    it('should identify valid ID field', () => {
      const idColumn: ColumnDefinition = {
        name: 'id',
        type: Types.UniqueIdentifier,
      };

      expect(isIdField(idColumn)).toBe(true);
    });

    it('should reject non-ID field names', () => {
      const nonIdColumn: ColumnDefinition = {
        name: 'name',
        type: Types.UniqueIdentifier,
      };

      expect(isIdField(nonIdColumn)).toBe(false);
    });

    it('should reject non-UniqueIdentifier types', () => {
      const nonIdColumn: ColumnDefinition = {
        name: 'id',
        type: Types.Text,
        length: 50,
      };

      expect(isIdField(nonIdColumn)).toBe(false);
    });

    it('should return false for null column', () => {
      expect(isIdField(null)).toBe(false);
    });
  });

  describe('createIdColumnDefinition', () => {
    it('should create standard ID column definition', () => {
      const idColumn = createIdColumnDefinition(schema);
      
      expect(idColumn.name).toBe('id');
      expect(idColumn.type).toBe(Types.UniqueIdentifier);
      expect(idColumn.nullable).toBe(false);
      expect(idColumn.default).toBeDefined();
      expect(typeof idColumn.default).toBe('function');
    });

    it('should create ID column with proper generator function', () => {
      const idColumn = createIdColumnDefinition(schema);
      
      const generatedId = idColumn.default();
      expect(typeof generatedId).toBe('string');
      expect(generatedId.length).toBeGreaterThan(0);
    });
  });

  describe('addIdField', () => {
    it('should add ID field to beginning of empty columns array', () => {
      const columns: ColumnDefinition[] = [];
      const result = addIdField(columns, schema);
      
      expect(result.columns).toHaveLength(1);
      expect(result.columns[0].name).toBe('id');
      expect(result.columns[0].type).toBe(Types.UniqueIdentifier);
      expect(result.added).toBe(true);
    });

    it('should add ID field to beginning of existing columns', () => {
      const columns: ColumnDefinition[] = [
        { name: 'name', type: Types.Text, length: 50 },
        { name: 'age', type: Types.Number },
      ];
      
      const result = addIdField(columns, schema);
      
      expect(result.columns).toHaveLength(3);
      expect(result.columns[0].name).toBe('id');
      expect(result.columns[1].name).toBe('name');
      expect(result.columns[2].name).toBe('age');
      expect(result.added).toBe(true);
    });

    it('should not add ID field if one already exists', () => {
      const columns: ColumnDefinition[] = [
        { name: 'id', type: Types.UniqueIdentifier },
        { name: 'name', type: Types.Text, length: 50 },
      ];
      
      const result = addIdField(columns, schema);
      
      expect(result.columns).toHaveLength(2);
      expect(result.added).toBe(false);
    });
  });

  describe('configureExistingIdField', () => {
    it('should configure existing ID field with generator', () => {
      const columns: ColumnDefinition[] = [
        { name: 'id', type: Types.UniqueIdentifier },
        { name: 'name', type: Types.Text, length: 50 },
      ];
      
      const result = configureExistingIdField(columns, schema);
      
      expect(result.configured).toBe(true);
      expect(result.columns[0].default).toBeDefined();
      expect(typeof result.columns[0].default).toBe('function');
    });

    it('should not configure if no ID field exists', () => {
      const columns: ColumnDefinition[] = [
        { name: 'name', type: Types.Text, length: 50 },
        { name: 'age', type: Types.Number },
      ];
      
      const result = configureExistingIdField(columns, schema);
      
      expect(result.configured).toBe(false);
      expect(result.columns).toEqual(columns);
    });

    it('should preserve existing default generator', () => {
      const customGenerator = () => 'custom-id';
      const columns: ColumnDefinition[] = [
        { name: 'id', type: Types.UniqueIdentifier, default: customGenerator },
        { name: 'name', type: Types.Text, length: 50 },
      ];
      
      const result = configureExistingIdField(columns, schema);
      
      expect(result.configured).toBe(true);
      expect(result.columns[0].default).toBe(customGenerator);
    });
  });

  describe('validateIdField', () => {
    it('should validate correct ID field', () => {
      const idColumn: ColumnDefinition = {
        name: 'id',
        type: Types.UniqueIdentifier,
        nullable: false,
        default: () => 'test-id',
      };
      
      const result = validateIdField(idColumn);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid ID field name', () => {
      const invalidColumn: ColumnDefinition = {
        name: 'identifier',
        type: Types.UniqueIdentifier,
      };
      
      const result = validateIdField(invalidColumn);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("ID column must be named 'id'");
    });

    it('should reject invalid ID field type', () => {
      const invalidColumn: ColumnDefinition = {
        name: 'id',
        type: Types.Text,
        length: 50,
      };
      
      const result = validateIdField(invalidColumn);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("ID column must be of type 'UniqueIdentifier'");
    });

    it('should reject ID field without default generator', () => {
      const invalidColumn: ColumnDefinition = {
        name: 'id',
        type: Types.UniqueIdentifier,
        nullable: false,
      };
      
      const result = validateIdField(invalidColumn);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('ID column must have a default value generator function');
    });

    it('should accumulate multiple validation errors', () => {
      const invalidColumn: ColumnDefinition = {
        name: 'identifier',
        type: Types.Text,
        nullable: true,
        length: 50,
      };
      
      const result = validateIdField(invalidColumn);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('ensureIdField', () => {
    it('should add ID field to columns without ID', () => {
      const columns = [
        { name: 'name', type: Types.Text, length: 50 },
        { name: 'age', type: Types.Number },
      ];
      
      const result = ensureIdField(columns, schema);
      
      expect(result.added).toBe(true);
      expect(result.columns[0].name).toBe('id');
      expect(result.columns[0].type).toBe(Types.UniqueIdentifier);
    });

    it('should configure existing ID field in columns', () => {
      const columns = [
        { name: 'id', type: Types.UniqueIdentifier },
        { name: 'name', type: Types.Text, length: 50 },
      ];
      
      const result = ensureIdField(columns, schema);
      
      expect(result.added).toBe(false);
      expect(result.configured).toBe(true);
      expect(result.columns[0].default).toBeDefined();
    });
  });

  describe('getIdFieldRequirements', () => {
    it('should return correct ID field requirements', () => {
      const requirements = getIdFieldRequirements();
      
      expect(requirements.name).toBe('id');
      expect(requirements.type).toBe(Types.UniqueIdentifier);
      expect(requirements.nullable).toBe(false);
      expect(requirements.hasDefault).toBe(true);
      expect(requirements.position).toBe('first');
      expect(requirements.description).toContain('automatically generated');
    });
  });

  describe('createIdFieldConfig', () => {
    it('should create default ID field configuration', () => {
      const config = createIdFieldConfig();
      
      expect(config.name).toBe('id');
      expect(config.type).toBe(Types.UniqueIdentifier);
      expect(config.nullable).toBe(false);
      expect(config.customGenerator).toBeNull();
    });

    it('should create ID field configuration with custom options', () => {
      const customGenerator = () => 'custom-id';
      const options = {
        customGenerator,
        nullable: true,
        description: 'Custom ID field',
      };
      
      const config = createIdFieldConfig(options);
      
      expect(config.name).toBe('id');
      expect(config.type).toBe(Types.UniqueIdentifier);
      expect(config.nullable).toBe(true);
      expect(config.customGenerator).toBe(customGenerator);
      expect(config.description).toBe('Custom ID field');
    });
  });

  describe('Integration Tests', () => {
    it('should work with complete column array workflow', () => {
      // Start with columns without ID
      const columns = [
        { name: 'name', type: Types.Text, length: 50 },
        { name: 'email', type: Types.Text, length: 100 },
        { name: 'age', type: Types.Number },
      ];
      
      // Ensure ID field
      const ensureResult = ensureIdField(columns, schema);
      expect(ensureResult.added).toBe(true);
      
      // Validate the result
      expect(ensureResult.columns).toHaveLength(4);
      expect(ensureResult.columns[0].name).toBe('id');
      
      const validation = validateIdField(ensureResult.columns[0]);
      expect(validation.isValid).toBe(true);
      
      // Test the generator
      const generatedId = ensureResult.columns[0].default();
      expect(typeof generatedId).toBe('string');
      expect(generatedId.length).toBeGreaterThan(0);
    });

    it('should handle edge case with malformed ID field', () => {
      const columns = [
        { 
          name: 'id', 
          type: Types.Text, // Wrong type
          length: 50,
          nullable: true, // Wrong nullable setting
        },
      ];
      
      // Validate the malformed field
      const validation = validateIdField(columns[0]);
      expect(validation.isValid).toBe(false); // Should detect it's not valid
    });
  });
});