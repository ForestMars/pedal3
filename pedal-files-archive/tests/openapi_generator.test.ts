/**
 * Tests for OpenAPI Generator Operator
 */
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { run } from '../operators/openapi_generator';
import { actionModelSchema } from '../types/action_model.schema';
import { openApiSchema } from '../types/openapi.schema';

// Mock validateOpenApi function to avoid dependency on openapi-cli
jest.mock('child_process', () => ({
  spawnSync: jest.fn(() => ({ status: 0, stderr: '', stdout: 'Validation succeeded' }))
}));

// Setup test directory and cleanup function
const testDir = path.join(__dirname, 'temp_openapi');
const inputFile = path.join(testDir, 'action_model.json');
const outputFile = path.join(testDir, 'oas.yaml');

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

describe('OpenAPI Generator Operator', () => {
  test('should generate OpenAPI spec from action model', async () => {
    // Create a valid action model JSON input file
    const actionModel = {
      actions: [
        {
          name: 'createUser',
          actor: 'Admin',
          entity: 'User',
          type: 'create',
          httpMethod: 'POST',
          httpPath: '/users',
          parameters: [
            {
              name: 'email',
              type: 'string',
              required: true,
              description: 'User email'
            },
            {
              name: 'name',
              type: 'string',
              required: true,
              description: 'User name'
            }
          ],
          preconditions: [
            {
              description: 'User has permission to create users'
            }
          ],
          postconditions: [
            {
              description: 'User is created in the system'
            }
          ],
          description: 'Creates a new user'
        },
        {
          name: 'getUser',
          actor: 'User',
          entity: 'User',
          type: 'read',
          httpMethod: 'GET',
          httpPath: '/users/{id}',
          parameters: [
            {
              name: 'id',
              type: 'uuid',
              required: true,
              description: 'User identifier'
            }
          ],
          preconditions: [
            {
              description: 'User with the given ID exists'
            }
          ],
          postconditions: [
            {
              description: 'User details are returned'
            }
          ],
          description: 'Retrieves a user by ID'
        }
      ],
      version: '1.0.0',
      description: 'Test action model'
    };
    
    // Validate action model against schema to ensure our test data is valid
    actionModelSchema.parse(actionModel);
    
    fs.writeFileSync(inputFile, JSON.stringify(actionModel, null, 2));

    // Run the operator
    await run(inputFile, outputFile);

    // Verify the output exists
    expect(fs.existsSync(outputFile)).toBe(true);

    // Verify the output OpenAPI spec is valid YAML
    const yamlContent = fs.readFileSync(outputFile, 'utf-8');
    const openApiDoc = yaml.parse(yamlContent);
    
    // Validate against OpenAPI schema
    expect(() => openApiSchema.parse(openApiDoc)).not.toThrow();
    
    // Verify content was correctly generated
    expect(openApiDoc.openapi).toBe('3.0.0');
    expect(openApiDoc.info.version).toBe('1.0.0');
    expect(openApiDoc.paths['/users']).toBeDefined();
    expect(openApiDoc.paths['/users/{id}']).toBeDefined();
    
    // Check POST /users endpoint
    expect(openApiDoc.paths['/users'].post).toBeDefined();
    expect(openApiDoc.paths['/users'].post.operationId).toBe('createUser');
    expect(openApiDoc.paths['/users'].post.requestBody).toBeDefined();
    
    // Check GET /users/{id} endpoint
    expect(openApiDoc.paths['/users/{id}'].get).toBeDefined();
    expect(openApiDoc.paths['/users/{id}'].get.operationId).toBe('getUser');
    expect(openApiDoc.paths['/users/{id}'].get.parameters.length).toBe(1);
    expect(openApiDoc.paths['/users/{id}'].get.parameters[0].name).toBe('id');
    expect(openApiDoc.paths['/users/{id}'].get.parameters[0].in).toBe('path');
    
    // Check components and schemas
    expect(openApiDoc.components.schemas.User).toBeDefined();
  });

  test('should handle actions without HTTP method or path', async () => {
    // Create an action model with missing HTTP details
    const invalidActionModel = {
      actions: [
        {
          name: 'processData',
          actor: 'System',
          entity: 'Data',
          type: 'custom',
          // Missing httpMethod and httpPath
          parameters: [],
          description: 'Processes data'
        }
      ],
      version: '1.0.0'
    };
    
    fs.writeFileSync(inputFile, JSON.stringify(invalidActionModel, null, 2));

    // Run the operator
    await run(inputFile, outputFile);

    // Verify the output exists
    expect(fs.existsSync(outputFile)).toBe(true);

    // Verify the output OpenAPI spec is valid but has no paths
    const yamlContent = fs.readFileSync(outputFile, 'utf-8');
    const openApiDoc = yaml.parse(yamlContent);
    
    expect(Object.keys(openApiDoc.paths).length).toBe(0);
  });

  test('should handle non-existent input file', async () => {
    const nonExistentFile = path.join(testDir, 'non_existent.json');
    
    // Run the operator with a non-existent file and expect it to throw
    await expect(run(nonExistentFile, outputFile)).rejects.toThrow();
  });

  test('should handle empty actions array', async () => {
    // Create an action model with empty actions array
    const emptyActionModel = {
      actions: [],
      version: '1.0.0'
    };
    
    fs.writeFileSync(inputFile, JSON.stringify(emptyActionModel, null, 2));

    // Run the operator and expect it to throw
    await expect(run(inputFile, outputFile)).rejects.toThrow();
  });

  test('should handle path parameters correctly', async () => {
    // Create an action model with path parameters
    const pathParamsActionModel = {
      actions: [
        {
          name: 'getUserOrder',
          actor: 'User',
          entity: 'Order',
          type: 'read',
          httpMethod: 'GET',
          httpPath: '/users/{userId}/orders/{orderId}',
          parameters: [
            {
              name: 'userId',
              type: 'uuid',
              required: true,
              description: 'User identifier'
            },
            {
              name: 'orderId',
              type: 'uuid',
              required: true,
              description: 'Order identifier'
            }
          ],
          description: 'Gets an order for a specific user'
        }
      ],
      version: '1.0.0'
    };
    
    fs.writeFileSync(inputFile, JSON.stringify(pathParamsActionModel, null, 2));

    // Run the operator
    await run(inputFile, outputFile);

    // Verify the output exists
    expect(fs.existsSync(outputFile)).toBe(true);

    // Verify the path parameters are correctly defined
    const yamlContent = fs.readFileSync(outputFile, 'utf-8');
    const openApiDoc = yaml.parse(yamlContent);
    
    expect(openApiDoc.paths['/users/{userId}/orders/{orderId}']).toBeDefined();
    expect(openApiDoc.paths['/users/{userId}/orders/{orderId}'].get.parameters.length).toBe(2);
    expect(openApiDoc.paths['/users/{userId}/orders/{orderId}'].get.parameters[0].in).toBe('path');
    expect(openApiDoc.paths['/users/{userId}/orders/{orderId}'].get.parameters[0].name).toBe('userId');
    expect(openApiDoc.paths['/users/{userId}/orders/{orderId}'].get.parameters[1].in).toBe('path');
    expect(openApiDoc.paths['/users/{userId}/orders/{orderId}'].get.parameters[1].name).toBe('orderId');
  });
});
