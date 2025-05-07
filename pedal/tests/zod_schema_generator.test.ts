/**
 * Tests for Zod Schema Generator Operator
 */
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { run } from '../operators/zod_schema_generator';

// Setup test directory and cleanup function
const testDir = path.join(__dirname, 'temp_zod_schema');
const inputFile = path.join(testDir, 'oas.yaml');
const outputFile = path.join(testDir, 'zod_schemas.ts');

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

describe('Zod Schema Generator Operator', () => {
  test('should generate Zod schemas from OpenAPI spec', async () => {
    // Create a valid OpenAPI spec input file
    const openApiSpec = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0',
        description: 'Test OpenAPI specification'
      },
      paths: {
        '/users': {
          post: {
            operationId: 'createUser',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/User'
                  }
                }
              },
              required: true
            },
            responses: {
              '200': {
                description: 'User created successfully',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/User'
                    }
                  }
                }
              }
            }
          },
          get: {
            operationId: 'listUsers',
            responses: {
              '200': {
                description: 'List of users',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/User'
                      }
                    }
                  }
                }
              }
            }
          }
        },
        '/users/{id}': {
          get: {
            operationId: 'getUser',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                  format: 'uuid'
                }
              }
            ],
            responses: {
              '200': {
                description: 'User details',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/User'
                    }
                  }
                }
              }
            }
          }
        }
      },
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid'
              },
              email: {
                type: 'string',
                format: 'email'
              },
              name: {
                type: 'string',
                minLength: 1,
                maxLength: 100
              },
              age: {
                type: 'integer',
                minimum: 18
              },
              isActive: {
                type: 'boolean',
                default: true
              },
              tags: {
                type: 'array',
                items: {
                  type: 'string'
                }
              },
              metadata: {
                type: 'object',
                additionalProperties: true
              }
            },
            required: ['id', 'email', 'name']
          }
        }
      }
    };
    
    fs.writeFileSync(inputFile, yaml.stringify(openApiSpec));

    // Run the operator
    await run(inputFile, outputFile);

    // Verify the output exists
    expect(fs.existsSync(outputFile)).toBe(true);

    // Verify the output contains the expected Zod schemas
    const tsContent = fs.readFileSync(outputFile, 'utf-8');
    
    // Check for User schema
    expect(tsContent).toContain('export const UserSchema');
    expect(tsContent).toContain('z.object(');
    expect(tsContent).toContain('id: z.string().uuid()');
    expect(tsContent).toContain('email: z.string().email()');
    expect(tsContent).toContain('name: z.string().min(1, { message: "Must be at least 1 characters" }).max(100');
    expect(tsContent).toContain('age: z.number().int().min(18');
    expect(tsContent).toContain('isActive: z.boolean()');
    expect(tsContent).toContain('tags: z.array(z.string())');
    
    // Check for request/response schemas
    expect(tsContent).toContain('export const createUserRequestSchema');
    expect(tsContent).toContain('export const getUserParamsSchema');
    expect(tsContent).toContain('export const getUser');
    
    // Check for type definitions
    expect(tsContent).toContain('export type User = z.infer<typeof UserSchema>');
  });

  test('should handle OpenAPI spec without components/schemas', async () => {
    // Create an OpenAPI spec without component schemas
    const minimalOpenApiSpec = {
      openapi: '3.0.0',
      info: {
        title: 'Minimal API',
        version: '1.0.0'
      },
      paths: {
        '/health': {
          get: {
            operationId: 'getHealth',
            responses: {
              '200': {
                description: 'Service health',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        status: {
                          type: 'string',
                          enum: ['healthy', 'unhealthy']
                        },
                        timestamp: {
                          type: 'string',
                          format: 'date-time'
                        }
                      },
                      required: ['status']
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
    
    fs.writeFileSync(inputFile, yaml.stringify(minimalOpenApiSpec));

    // Run the operator
    await run(inputFile, outputFile);

    // Verify the output exists
    expect(fs.existsSync(outputFile)).toBe(true);

    // Verify the content has response schema but no component schemas
    const tsContent = fs.readFileSync(outputFile, 'utf-8');
    expect(tsContent).toContain('export const getHealthResponseSchema');
    expect(tsContent).not.toContain('export type User');
  });

  test('should handle non-existent input file', async () => {
    const nonExistentFile = path.join(testDir, 'non_existent.yaml');
    
    // Run the operator with a non-existent file and expect it to throw
    await expect(run(nonExistentFile, outputFile)).rejects.toThrow();
  });

  test('should handle invalid OpenAPI spec', async () => {
    // Create an invalid OpenAPI spec (missing required fields)
    const invalidOpenApiSpec = {
      openapi: '3.0.0',
      // Missing info object
      paths: {}
    };
    
    fs.writeFileSync(inputFile, yaml.stringify(invalidOpenApiSpec));

    // Run the operator and expect it to throw
    await expect(run(inputFile, outputFile)).rejects.toThrow();
  });

  test('should handle various OpenAPI schema types', async () => {
    // Create an OpenAPI spec with various schema types
    const typesOpenApiSpec = {
      openapi: '3.0.0',
      info: {
        title: 'Types API',
        version: '1.0.0'
      },
      paths: {},
      components: {
        schemas: {
          AllTypes: {
            type: 'object',
            properties: {
              stringValue: { type: 'string' },
              numberValue: { type: 'number' },
              integerValue: { type: 'integer' },
              booleanValue: { type: 'boolean' },
              dateValue: { type: 'string', format: 'date' },
              dateTimeValue: { type: 'string', format: 'date-time' },
              uuidValue: { type: 'string', format: 'uuid' },
              emailValue: { type: 'string', format: 'email' },
              uriValue: { type: 'string', format: 'uri' },
              stringArrayValue: { 
                type: 'array', 
                items: { type: 'string' } 
              },
              objectValue: { 
                type: 'object',
                properties: {
                  nestedValue: { type: 'string' }
                }
              },
              nullValue: { type: 'null' }
            }
          }
        }
      }
    };
    
    fs.writeFileSync(inputFile, yaml.stringify(typesOpenApiSpec));

    // Run the operator
    await run(inputFile, outputFile);

    // Verify the output exists
    expect(fs.existsSync(outputFile)).toBe(true);

    // Verify the schema contains all the expected type mappings
    const tsContent = fs.readFileSync(outputFile, 'utf-8');
    expect(tsContent).toContain('stringValue: z.string()');
    expect(tsContent).toContain('numberValue: z.number()');
    expect(tsContent).toContain('integerValue: z.number().int()');
    expect(tsContent).toContain('booleanValue: z.boolean()');
    expect(tsContent).toContain('dateValue: z.string()');
    expect(tsContent).toContain('dateTimeValue: z.string().datetime({ offset: true })');
    expect(tsContent).toContain('uuidValue: z.string().uuid()');
    expect(tsContent).toContain('emailValue: z.string().email()');
    expect(tsContent).toContain('uriValue: z.string().url()');
    expect(tsContent).toContain('stringArrayValue: z.array(z.string())');
    expect(tsContent).toContain('objectValue: z.object(');
  });
});
