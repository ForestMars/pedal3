/**
 * Tests for Domain Model Generator Operator
 */
import * as fs from 'fs';
import * as path from 'path';
import { run } from '../operators/domain_model_generator';
import { requirementsSchema } from '../types/requirements.schema';
import { domainModelSchema } from '../types/domain_model.schema';

// Setup test directory and cleanup function
const testDir = path.join(__dirname, 'temp_domain_model');
const inputFile = path.join(testDir, 'requirements.json');
const outputFile = path.join(testDir, 'domain_model.json');
const interfacesFile = path.join(testDir, 'domain_interfaces.ts');

beforeAll(() => {
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
});

afterAll(() => {
  // Clean up test files
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

describe('Domain Model Generator Operator', () => {
  test('should transform requirements into domain model', async () => {
    // Create a valid requirements JSON input file
    const requirements = {
      entities: [
        {
          name: 'User',
          fields: [
            {
              name: 'id',
              type: 'uuid',
              required: true,
              unique: true
            },
            {
              name: 'email',
              type: 'string',
              required: true,
              unique: true
            },
            {
              name: 'name',
              type: 'string',
              required: true
            }
          ]
        },
        {
          name: 'Product',
          fields: [
            {
              name: 'id',
              type: 'uuid',
              required: true,
              unique: true
            },
            {
              name: 'name',
              type: 'string',
              required: true
            },
            {
              name: 'price',
              type: 'number',
              required: true
            }
          ]
        }
      ],
      version: '1.0.0',
      description: 'Test requirements'
    };
    
    // Validate requirements against schema to ensure our test data is valid
    requirementsSchema.parse(requirements);
    
    fs.writeFileSync(inputFile, JSON.stringify(requirements, null, 2));

    // Run the operator
    await run(inputFile, outputFile);

    // Verify the output exists
    expect(fs.existsSync(outputFile)).toBe(true);
    expect(fs.existsSync(interfacesFile)).toBe(true);

    // Verify the output domain model is valid and matches the schema
    const outputJson = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
    expect(() => domainModelSchema.parse(outputJson)).not.toThrow();
    
    // Verify content was correctly transformed
    expect(outputJson.domains.length).toBe(1);
    expect(outputJson.domains[0].entities.length).toBe(2);
    expect(outputJson.domains[0].entities[0].name).toBe('User');
    expect(outputJson.domains[0].entities[0].attributes.length).toBe(3);
    expect(outputJson.domains[0].entities[1].name).toBe('Product');
    
    // Verify TypeScript interfaces were generated
    const interfacesContent = fs.readFileSync(interfacesFile, 'utf-8');
    expect(interfacesContent).toContain('interface User {');
    expect(interfacesContent).toContain('interface Product {');
    expect(interfacesContent).toContain('id: string;'); // uuid maps to string
    expect(interfacesContent).toContain('price: number;');
  });

  test('should handle invalid requirements JSON', async () => {
    // Create an invalid requirements JSON
    const invalidRequirements = {
      // Missing entities array
      version: '1.0.0'
    };
    
    fs.writeFileSync(inputFile, JSON.stringify(invalidRequirements, null, 2));

    // Run the operator and expect it to throw
    await expect(run(inputFile, outputFile)).rejects.toThrow();
  });

  test('should handle non-existent input file', async () => {
    const nonExistentFile = path.join(testDir, 'non_existent.json');
    
    // Run the operator with a non-existent file and expect it to throw
    await expect(run(nonExistentFile, outputFile)).rejects.toThrow();
  });

  test('should handle empty entities array', async () => {
    // Create requirements with empty entities array
    const emptyRequirements = {
      entities: [],
      version: '1.0.0'
    };
    
    fs.writeFileSync(inputFile, JSON.stringify(emptyRequirements, null, 2));

    // Run the operator and expect it to throw
    await expect(run(inputFile, outputFile)).rejects.toThrow();
  });

  test('should handle requirements with no fields', async () => {
    // Create requirements with an entity that has no fields
    const invalidRequirements = {
      entities: [
        {
          name: 'EmptyEntity',
          fields: []
        }
      ],
      version: '1.0.0'
    };
    
    fs.writeFileSync(inputFile, JSON.stringify(invalidRequirements, null, 2));

    // Run the operator and expect it to throw
    await expect(run(inputFile, outputFile)).rejects.toThrow();
  });
});
