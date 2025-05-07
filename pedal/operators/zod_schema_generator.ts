#!/usr/bin/env node
/**
 * Zod Schema Generator Operator
 * 
 * Parses an OpenAPI specification and generates Zod validators
 * for request/response validation.
 * 
 * Usage:
 *   node zod_schema_generator.ts --input /path/to/oas.yaml --output /path/to/zod_schemas.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { z } from 'zod';
import { openApiSchema } from '../types/openapi.schema';
import { config } from '../config/storage.config';
import { createLogger } from '../utils/logger';
import { readFile, writeFile, getVersionedFilename } from '../utils/file';

// Get task ID from environment variable or use default
const taskId = process.env.TASK_ID || 'zod_schema_generator';
const logger = createLogger(taskId);

/**
 * Maps an OpenAPI schema type to a Zod schema
 * @param schema - OpenAPI schema object
 * @param indentLevel - Indentation level for formatting
 * @returns String representation of Zod schema
 */
function mapOpenApiSchemaToZod(schema: any, indentLevel: number = 2): string {
  const indent = ' '.repeat(indentLevel);
  
  if (!schema) {
    return 'z.any()';
  }
  
  // Handle $ref
  if (schema.$ref) {
    const refParts = schema.$ref.split('/');
    const schemaName = refParts[refParts.length - 1];
    return `${schemaName}Schema`;
  }
  
  // Handle different types
  switch (schema.type) {
    case 'string': {
      let zodSchema = 'z.string()';
      
      // Add string format validations
      if (schema.format) {
        switch (schema.format) {
          case 'date-time':
          case 'date':
            zodSchema += '.datetime({ offset: true })';
            break;
          case 'email':
            zodSchema += '.email()';
            break;
          case 'uuid':
            zodSchema += '.uuid()';
            break;
          case 'uri':
            zodSchema += '.url()';
            break;
        }
      }
      
      // Add min/max length validations
      if (schema.minLength !== undefined) {
        zodSchema += `.min(${schema.minLength}, { message: "Must be at least ${schema.minLength} characters" })`;
      }
      if (schema.maxLength !== undefined) {
        zodSchema += `.max(${schema.maxLength}, { message: "Must be at most ${schema.maxLength} characters" })`;
      }
      
      // Add pattern validation
      if (schema.pattern) {
        zodSchema += `.regex(/${schema.pattern}/, { message: "Must match pattern" })`;
      }
      
      return zodSchema;
    }
    
    case 'number':
    case 'integer': {
      let zodSchema = schema.type === 'integer' ? 'z.number().int()' : 'z.number()';
      
      // Add min/max validations
      if (schema.minimum !== undefined) {
        zodSchema += `.min(${schema.minimum}, { message: "Must be at least ${schema.minimum}" })`;
      }
      if (schema.maximum !== undefined) {
        zodSchema += `.max(${schema.maximum}, { message: "Must be at most ${schema.maximum}" })`;
      }
      
      return zodSchema;
    }
    
    case 'boolean':
      return 'z.boolean()';
    
    case 'array': {
      const itemsSchema = mapOpenApiSchemaToZod(schema.items, indentLevel + 2);
      let zodSchema = `z.array(${itemsSchema})`;
      
      // Add min/max items validations
      if (schema.minItems !== undefined) {
        zodSchema += `.min(${schema.minItems}, { message: "Must have at least ${schema.minItems} items" })`;
      }
      if (schema.maxItems !== undefined) {
        zodSchema += `.max(${schema.maxItems}, { message: "Must have at most ${schema.maxItems} items" })`;
      }
      
      return zodSchema;
    }
    
    case 'object': {
      if (!schema.properties || Object.keys(schema.properties).length === 0) {
        return 'z.record(z.string(), z.any())';
      }
      
      const propertyLines = Object.entries(schema.properties).map(([propName, propSchema]) => {
        const propZodSchema = mapOpenApiSchemaToZod(propSchema, indentLevel + 2);
        const required = schema.required?.includes(propName);
        
        return `${indent}  ${propName}: ${propZodSchema}${required ? '' : '.optional()'}`;
      });
      
      return `z.object({\n${propertyLines.join(',\n')}\n${indent}})`;
    }
    
    case 'null':
      return 'z.null()';
    
    default:
      // For unknown or unsupported types
      return 'z.any()';
  }
}

/**
 * Runs the Zod schema generator process
 * @param inputPath - Path to the input YAML file (OpenAPI spec)
 * @param outputPath - Path to the output TS file (Zod schemas)
 * @returns Promise resolving when complete
 */
export async function run(inputPath: string, outputPath: string): Promise<void> {
  try {
    logger.info(`Starting Zod schema generation from ${inputPath} to ${outputPath}`);
    
    // Read OpenAPI specification
    logger.info(`Reading OpenAPI specification from ${inputPath}`);
    let openApiDoc: any;
    try {
      const openApiData = fs.readFileSync(inputPath, 'utf-8');
      openApiDoc = yaml.parse(openApiData);
      
      // Validate against schema
      openApiSchema.parse(openApiDoc);
    } catch (error) {
      throw new Error(`Failed to read or validate OpenAPI specification: ${error}`);
    }
    
    // Start building Zod schemas
    logger.info('Generating Zod schemas from OpenAPI components');
    
    let zodOutput = `/**
 * Generated Zod schemas from OpenAPI specification
 * Generated by PEDAL Zod Schema Generator
 */

import { z } from 'zod';

`;
    
    // Handle components.schemas
    if (openApiDoc.components?.schemas) {
      logger.info(`Generating schemas for ${Object.keys(openApiDoc.components.schemas).length} components`);
      
      // First pass: declare all schema variables to handle circular references
      for (const [schemaName, schema] of Object.entries(openApiDoc.components.schemas)) {
        zodOutput += `// Schema for ${schemaName}\n`;
        zodOutput += `export const ${schemaName}Schema = z.lazy(() => ${mapOpenApiSchemaToZod(schema)});\n\n`;
      }
      
      // Type definitions
      zodOutput += '\n// Type definitions\n';
      for (const [schemaName, _] of Object.entries(openApiDoc.components.schemas)) {
        zodOutput += `export type ${schemaName} = z.infer<typeof ${schemaName}Schema>;\n`;
      }
    }
    
    // Generate request schemas for each path
    zodOutput += '\n// Request schemas\n';
    for (const [path, pathItem] of Object.entries(openApiDoc.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        // Skip if not an HTTP method
        if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
          continue;
        }
        
        const operationId = (operation as any).operationId;
        if (!operationId) {
          logger.warn(`Operation without operationId at ${method.toUpperCase()} ${path}`);
          continue;
        }
        
        // Path parameters
        const pathParams = (pathItem as any).parameters || [];
        const operationParams = (operation as any).parameters || [];
        const allParams = [...pathParams, ...operationParams];
        
        // Generate parameter schema if there are params
        if (allParams.length > 0) {
          zodOutput += `// Parameters for ${operationId}\n`;
          zodOutput += `export const ${operationId}ParamsSchema = z.object({\n`;
          
          for (const param of allParams) {
            const paramSchema = param.schema || { type: 'string' };
            const zodParamSchema = mapOpenApiSchemaToZod(paramSchema, 2);
            
            zodOutput += `  ${param.name}: ${zodParamSchema}${param.required ? '' : '.optional()'},\n`;
          }
          
          zodOutput += '});\n\n';
        }
        
        // Request body
        if ((operation as any).requestBody) {
          const requestBody = (operation as any).requestBody;
          const contentType = Object.keys(requestBody.content)[0];
          const schema = requestBody.content[contentType].schema;
          
          if (schema) {
            zodOutput += `// Request body for ${operationId}\n`;
            zodOutput += `export const ${operationId}RequestSchema = ${mapOpenApiSchemaToZod(schema)};\n\n`;
          }
        }
        
        // Response
        const successResponse = (operation as any).responses?.['200'];
        if (successResponse?.content) {
          const contentType = Object.keys(successResponse.content)[0];
          const schema = successResponse.content[contentType].schema;
          
          if (schema) {
            zodOutput += `// Response for ${operationId}\n`;
            zodOutput += `export const ${operationId}ResponseSchema = ${mapOpenApiSchemaToZod(schema)};\n\n`;
          }
        }
      }
    }
    
    // Write the Zod schemas to the output file
    logger.info(`Writing Zod schemas to ${outputPath}`);
    fs.writeFileSync(outputPath, zodOutput);
    
    // Also write versioned copy
    const baseOutputPath = outputPath.substring(0, outputPath.length - 3); // Remove .ts
    const versionedOutputPath = getVersionedFilename(baseOutputPath, '.ts');
    
    logger.info(`Writing versioned Zod schemas to ${versionedOutputPath}`);
    fs.writeFileSync(versionedOutputPath, zodOutput);
    
    logger.info('Zod schema generation completed successfully');
  } catch (error) {
    logger.error(`Zod schema generation failed: ${error instanceof Error ? error.message : error}`);
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
    console.error('Usage: node zod_schema_generator.ts --input /path/to/oas.yaml --output /path/to/zod_schemas.ts');
    process.exit(1);
  }
  
  const inputPath = args[inputIndex + 1];
  const outputPath = args[outputIndex + 1];
  
  if (!inputPath || !outputPath) {
    logger.error('Invalid arguments: paths must be specified for --input and --output');
    console.error('Usage: node zod_schema_generator.ts --input /path/to/oas.yaml --output /path/to/zod_schemas.ts');
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
