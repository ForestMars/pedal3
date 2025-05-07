/**
 * Tests for Action Model Generator Operator
 */
import * as fs from 'fs';
import * as path from 'path';
import { run } from '../operators/action_model_generator';
import { domainModelSchema } from '../types/domain_model.schema';
import { actionModelSchema } from '../types/action_model.schema';

// Setup test directory and cleanup function
const testDir = path.join(__dirname, 'temp_action_model');
const inputFile = path.join(testDir, 'domain_model.json');
const outputFile = path.join(testDir, 'action_model.json');

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

describe('Action Model Generator Operator', () => {
  test('should derive actions from domain model', async () => {
    // Create a valid domain model JSON input file
    const domainModel = {
      domains: [
        {
          name: 'CoreDomain',
          description: 'Core domain with primary entities',
          entities: [
            {
              name: 'User',
              attributes: [
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
              attributes: [
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
          ]
        }
      ],
      version: '1.0.0',
      description: 'Test domain model'
    };
    
    // Validate domain model against schema to ensure our test data is valid
    domainModelSchema.parse(domainModel);
    
    fs.writeFileSync(inputFile, JSON.stringify(domainModel, null, 2));

    // Run the operator
    await run(inputFile, outputFile);

    // Verify the output exists
    expect(fs.existsSync(outputFile)).toBe(true);

    // Verify the output action model is valid and matches the schema
    const outputJson = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
    expect(() => actionModelSchema.parse(outputJson)).not.toThrow();
    
    // Verify content was correctly derived
    expect(outputJson.actions.length).toBe(10); // 5 CRUD actions per entity
    
    // Verify User actions were created
    const userActions = outputJson.actions.filter((a: any) => a.entity === 'User');
    expect(userActions.length).toBe(5);
    expect(userActions.map((a: any) => a.name)).toContain('createUser');
    expect(userActions.map((a: any) => a.name)).toContain('getUser');
    expect(userActions.map((a: any) => a.name)).toContain('listUsers');
    expect(userActions.map((a: any) => a.name)).toContain('updateUser');
    expect(userActions.map((a: any) => a.name)).toContain('deleteUser');
    
    // Verify Product actions were created
    const productActions = outputJson.actions.filter((a: any) => a.entity === 'Product');
    expect(productActions.length).toBe(5);
    
    // Verify specific action properties
    const createUserAction = userActions.find((a: any) => a.name === 'createUser');
    expect(createUserAction.httpMethod).toBe('POST');
    expect(createUserAction.httpPath).toBe('/users');
    expect(createUserAction.parameters.length).toBe(2); // email & name, but not id
    
    const getUserAction = userActions.find((a: any) => a.name === 'getUser');
    expect(getUserAction.httpMethod).toBe('GET');
    expect(getUserAction.httpPath).toBe('/users/{id}');
    expect(getUserAction.parameters.length).toBe(1); // just id
  });

  test('should handle domain model with no attributes', async () => {
    // Create a domain model with an entity that has no attributes
    const invalidDomainModel = {
      domains: [
        {
          name: 'CoreDomain',
          entities: [
            {
              name: 'EmptyEntity',
              attributes: []
            }
          ]
        }
      ],
      version: '1.0.0'
    };
    
    fs.writeFileSync(inputFile, JSON.stringify(invalidDomainModel, null, 2));

    // Run the operator and expect it to throw
    await expect(run(inputFile, outputFile)).rejects.toThrow();
  });

  test('should handle domain model with no entities', async () => {
    // Create a domain model with no entities
    const invalidDomainModel = {
      domains: [
        {
          name: 'EmptyDomain',
          entities: []
        }
      ],
      version: '1.0.0'
    };
    
    fs.writeFileSync(inputFile, JSON.stringify(invalidDomainModel, null, 2));

    // Run the operator and expect it to throw
    await expect(run(inputFile, outputFile)).rejects.toThrow();
  });

  test('should handle non-existent input file', async () => {
    const nonExistentFile = path.join(testDir, 'non_existent.json');
    
    // Run the operator with a non-existent file and expect it to throw
    await expect(run(nonExistentFile, outputFile)).rejects.toThrow();
  });

  test('should handle domain model without explicit ID field', async () => {
    // Create a domain model with entities that don't have 'id' fields
    const domainModelNoIds = {
      domains: [
        {
          name: 'CoreDomain',
          entities: [
            {
              name: 'Setting',
              attributes: [
                {
                  name: 'key',
                  type: 'string',
                  required: true,
                  unique: true
                },
                {
                  name: 'value',
                  type: 'string',
                  required: true
                }
              ]
            }
          ]
        }
      ],
      version: '1.0.0'
    };
    
    fs.writeFileSync(inputFile, JSON.stringify(domainModelNoIds, null, 2));

    // Run the operator
    await run(inputFile, outputFile);

    // Verify the output exists and is valid
    expect(fs.existsSync(outputFile)).toBe(true);
    const outputJson = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
    expect(() => actionModelSchema.parse(outputJson)).not.toThrow();
    
    // Verify it used the first field as the identifier
    const getSettingAction = outputJson.actions.find((a: any) => a.name === 'getSetting');
    expect(getSettingAction.httpPath).toBe('/settings/{key}');
  });
});
