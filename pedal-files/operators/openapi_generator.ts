#!/usr/bin/env node
/**
 * OpenAPI Generator Operator
 * 
 * Converts the action model to a valid OpenAPI v3.0.0 specification,
 * defining the API endpoints based on the actions.
 * 
 * Usage:
 *   node openapi_generator.ts --input /path/to/action_model.json --output /path/to/oas.yaml
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { spawnSync } from 'child_process';
import { z } from 'zod';
import { actionModelSchema, type ActionModel, type Action } from '../types/action_model.schema';
import { openApiSchema, type OpenAPI } from '../types/openapi.schema';
import { config } from '../config/storage.config';
import { createLogger } from '../utils/logger';
import { readFile, writeFile, getVersionedFilename, ensureDirectoryExists } from '../utils/file';

// Get task ID from environment variable or use default
const taskId = process.env.TASK_ID || 'openapi_generator';
const logger = createLogger(taskId);

/**
 * Converts a type from action model to OpenAPI schema type
 * @param type - Type from action model
 * @returns OpenAPI schema type object
 */
function mapTypeToOpenApiType(type: string): any {
  const typeMap: Record<string, any> = {
    'string': { type: 'string' },
    'number': { type: 'number' },
    'integer': { type: 'integer' },
    'boolean': { type: 'boolean' },
    'object': { type: 'object' },
    'array': { type: 'array', items: { type: 'string' } },
    'date': { type: 'string', format: 'date' },
    'datetime': { type: 'string', format: 'date-time' },
    'time': { type: 'string', format: 'time' },
    'uuid': { type: 'string', format: 'uuid' },
    'email': { type: 'string', format: 'email' },
    'uri': { type: 'string', format: 'uri' },
    'binary': { type: 'string', format: 'binary' },
    'byte': { type: 'string', format: 'byte' },
    'password': { type: 'string', format: 'password' },
  };
  
  return typeMap[type.toLowerCase()] || { type: 'string' };
}

/**
 * Generates an OpenAPI schema for an entity based on its parameters
 * @param parameters - Action parameters
 * @param entityName - Name of the entity
 * @returns OpenAPI schema object
 */
function generateEntitySchema(parameters: any[], entityName: string): any {
  const properties: Record<string, any> = {};
  const required: string[] = [];
  
  parameters.forEach(param => {
    properties[param.name] = mapTypeToOpenApiType(param.type);
    
    if (param.description) {
      properties[param.name].description = param.description;
    }
    
    if (param.required) {
      required.push(param.name);
    }
  });
  
  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

/**
 * Generates OpenAPI path parameters from action parameters
 * @param parameters - Action parameters
 * @param pathParams - Path parameter names (extracted from URL)
 * @returns OpenAPI parameters array
 */
function generatePathParameters(parameters: any[], pathParams: string[]): any[] {
  return pathParams.map(paramName => {
    const param = parameters.find(p => p.name === paramName);
    
    if (!param) {
      logger.warn(`Path parameter ${paramName} not found in action parameters`);
      return {
        name: paramName,
        in: 'path',
        required: true,
        schema: { type: 'string' },
      };
    }
    
    return {
      name: param.name,
      in: 'path',
      required: true,
      description: param.description,
      schema: mapTypeToOpenApiType(param.type),
    };
  });
}

/**
 * Extracts path parameters from a URL path
 * @param path - URL path with parameter placeholders
 * @returns Array of parameter names
 */
function extractPathParams(path: string): string[] {
  const matches = path.match(/{([^}]+)}/g) || [];
  return matches.map(match => match.slice(1, -1));
}

/**
 * Validates an OpenAPI specification using openapi-cli
 * @param filePath - Path to the OpenAPI YAML file
 * @returns Whether validation succeeded
 */
function validateOpenApi(filePath: string): boolean {
  logger.info(`Validating OpenAPI spec with openapi-cli: ${filePath}`);
  
  try {
    const result = spawnSync('openapi-cli', ['validate', filePath], {
      encoding: 'utf-8',
      shell: true,
    });
    
    if (result.status !== 0) {
      logger.error(`OpenAPI validation failed: ${result.stderr || result.stdout}`);
      return false;
    }
    
    logger.info('OpenAPI validation succeeded');
    return true;
  } catch (error) {
    logger.error(`Failed to run OpenAPI validation: ${error}`);
    return false;
  }
}

/**
 * Runs the OpenAPI generator process
 * @param inputPath - Path to the input JSON file (action model)
 * @param outputPath - Path to the output YAML file (OpenAPI spec)
 * @returns Promise resolving when complete
 */
export async function run(inputPath: string, outputPath: string): Promise<void> {
  try {
    logger.info(`Starting OpenAPI generation from ${inputPath} to ${outputPath}`);
    
    // Read action model file
    logger.info(`Reading action model from ${inputPath}`);
    let actionModel: ActionModel;
    try {
      const actionModelData = readFile(inputPath);
      actionModel = actionModelSchema.parse(actionModelData);
    } catch (error) {
      throw new Error(`Failed to read or parse action model: ${error}`);
    }
    
    // Generate OpenAPI specification
    logger.info('Generating OpenAPI specification');
    
    // Create base OpenAPI document
    const openApi: OpenAPI = {
      openapi: '3.0.0',
      info: {
        title: 'Generated API',
        version: actionModel.version || '1.0.0',
        description: actionModel.description || 'API generated from action model',
      },
      servers: [
        {
          url: '/api',
          description: 'API server',
        }
      ],
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [
        {
          bearerAuth: [],
        }
      ],
      tags: [],
    };
    
    // Process each action
    actionModel.actions.forEach(action => {
      if (!action.httpMethod || !action.httpPath) {
        logger.warn(`Skipping action ${action.name} - missing HTTP method or path`);
        return;
      }
      
      const httpMethod = action.httpMethod.toLowerCase();
      const path = action.httpPath;
      
      // Extract path parameters
      const pathParams = extractPathParams(path);
      
      // Initialize path if not exists
      if (!openApi.paths[path]) {
        openApi.paths[path] = {};
      }
      
      // Add tag for entity if not exists
      const tagName = action.entity;
      if (!openApi.tags?.find(tag => tag.name === tagName)) {
        if (!openApi.tags) openApi.tags = [];
        openApi.tags.push({
          name: tagName,
          description: `Operations related to ${tagName}`,
        });
      }
      
      // Generate schema for request/response
      const entitySchemaName = `${action.entity}`;
      if (!openApi.components?.schemas?.[entitySchemaName] && action.parameters.length > 0) {
        if (!openApi.components) openApi.components = {};
        if (!openApi.components.schemas) openApi.components.schemas = {};
        
        openApi.components.schemas[entitySchemaName] = generateEntitySchema(
          action.parameters.filter(p => !pathParams.includes(p.name)),
          action.entity
        );
      }
      
      // Create operation
      const operation: any = {
        tags: [tagName],
        summary: action.description || `${action.name}`,
        operationId: action.name,
        parameters: pathParams.length > 0 ? 
          generatePathParameters(action.parameters, pathParams) : [],
      };
      
      // Add request body for POST/PUT/PATCH
      if (['post', 'put', 'patch'].includes(httpMethod) && action.parameters.length > 0) {
        // Filter out path parameters since they won't be in the body
        const bodyParams = action.parameters.filter(p => !pathParams.includes(p.name));
        
        if (bodyParams.length > 0) {
          operation.requestBody = {
            description: `${action.entity} data`,
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: `#/components/schemas/${entitySchemaName}`,
                },
              },
            },
          };
        }
      }
      
      // Add responses
      operation.responses = {
        '200': {
          description: 'Successful operation',
          content: {
            'application/json': {
              schema: action.type === 'read' ? {
                $ref: `#/components/schemas/${entitySchemaName}`,
              } : {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: true,
                  },
                  message: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
        '400': {
          description: 'Bad request',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: false,
                  },
                  error: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
        },
        '404': {
          description: 'Not found',
        },
        '500': {
          description: 'Internal server error',
        },
      };
      
      // Add operation to path
      openApi.paths[path][httpMethod] = operation;
    });
    
    // Validate the generated OpenAPI spec against schema
    try {
      logger.info('Validating OpenAPI specification against schema');
      openApiSchema.parse(openApi);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedError = error.format();
        throw new Error(`Invalid OpenAPI specification format: ${JSON.stringify(formattedError)}`);
      }
      throw new Error(`Validation error: ${error}`);
    }
    
    // Write OpenAPI spec to output file
    logger.info(`Writing OpenAPI specification to ${outputPath}`);
    ensureDirectoryExists(path.dirname(outputPath));
    fs.writeFileSync(outputPath, yaml.stringify(openApi));
    
    // Also write versioned copy
    const baseOutputPath = outputPath.substring(0, outputPath.length - 5); // Remove .yaml
    const versionedOutputPath = getVersionedFilename(baseOutputPath, '.yaml');
    
    logger.info(`Writing versioned OpenAPI specification to ${versionedOutputPath}`);
    fs.writeFileSync(versionedOutputPath, yaml.stringify(openApi));
    
    // Validate with openapi-cli
    const validationSuccess = validateOpenApi(outputPath);
    if (!validationSuccess) {
      throw new Error('OpenAPI validation failed');
    }
    
    logger.info('OpenAPI generation completed successfully');
  } catch (error) {
    logger.error(`OpenAPI generation failed: ${error instanceof Error ? error.message : error}`);
    throw error;
  }
}

// When run directly from command line
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf('--input');
  const outputIndex = args.indexOf('--output');
  
  if (inputIndex === -1 || outputIndex === -1) {
    logger.error('Missing required arguments: --input and --output must be specified');
    console.error('Usage: node openapi_generator.ts --input /path/to/action_model.json --output /path/to/oas.yaml');
    process.exit(1);
  }
  
  const inputPath = args[inputIndex + 1];
  const outputPath = args[outputIndex + 1];
  
  if (!inputPath || !outputPath) {
    logger.error('Invalid arguments: paths must be specified for --input and --output');
    console.error('Usage: node openapi_generator.ts --input /path/to/action_model.json --output /path/to/oas.yaml');
    process.exit(1);
  }
  
  // Execute the operator
  run(inputPath, outputPath)
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error(`Execution failed: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    });
}
