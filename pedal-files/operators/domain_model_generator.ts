#!/usr/bin/env node
/**
 * Domain Model Generator Operator
 * 
 * Transforms requirements into a domain model with domains, entities, and attributes
 * following Domain-Driven Design principles.
 * 
 * Usage:
 *   node domain_model_generator.ts --input /path/to/requirements.json --output /path/to/domain_model.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { requirementsSchema, type Requirements } from '../types/requirements.schema';
import { domainModelSchema, type DomainModel } from '../types/domain_model.schema';
import { config } from '../config/storage.config';
import { createLogger } from '../utils/logger';
import { readFile, writeFile, getVersionedFilename } from '../utils/file';

// Get task ID from environment variable or use default
const taskId = process.env.TASK_ID || 'domain_model_generator';
const logger = createLogger(taskId);

/**
 * Transforms a field from requirements into an attribute for domain model
 * @param field - Field from requirements
 * @returns Attribute for domain model
 */
function fieldToAttribute(field: any) {
  return {
    name: field.name,
    type: field.type,
    description: field.description,
    required: field.required !== undefined ? field.required : true,
    unique: field.unique !== undefined ? field.unique : false,
    validation: {},
  };
}

/**
 * Generates a TypeScript interface definition from a domain entity
 * @param entity - Domain entity
 * @returns TypeScript interface as string
 */
function generateTypeScriptInterface(entity: any): string {
  let interfaceStr = `interface ${entity.name} {\n`;
  
  for (const attr of entity.attributes) {
    const nullable = attr.required ? '' : '?';
    interfaceStr += `  ${attr.name}${nullable}: ${mapTypeToTypeScript(attr.type)};\n`;
  }
  
  interfaceStr += '}\n';
  return interfaceStr;
}

/**
 * Maps a type from the domain model to TypeScript type
 * @param type - Type from domain model
 * @returns TypeScript type
 */
function mapTypeToTypeScript(type: string): string {
  const typeMap: Record<string, string> = {
    'string': 'string',
    'number': 'number',
    'integer': 'number',
    'boolean': 'boolean',
    'object': 'Record<string, any>',
    'array': 'any[]',
    'date': 'Date',
    'datetime': 'Date',
    'time': 'string',
    'uuid': 'string',
    'binary': 'Buffer',
    'json': 'Record<string, any>',
  };
  
  return typeMap[type.toLowerCase()] || 'any';
}

/**
 * Runs the domain model generator process
 * @param inputPath - Path to the input JSON file (requirements)
 * @param outputPath - Path to the output JSON file (domain model)
 * @returns Promise resolving when complete
 */
export async function run(inputPath: string, outputPath: string): Promise<void> {
  try {
    logger.info(`Starting domain model generation from ${inputPath} to ${outputPath}`);
    
    // Read requirements file
    logger.info(`Reading requirements from ${inputPath}`);
    let requirements: Requirements;
    try {
      const requirementsData = readFile(inputPath);
      requirements = requirementsSchema.parse(requirementsData);
    } catch (error) {
      throw new Error(`Failed to read or parse requirements: ${error}`);
    }
    
    // Transform requirements into domain model
    logger.info('Transforming requirements into domain model');
    
    // For simplicity, we'll create a single domain containing all entities
    const domainModel: DomainModel = {
      domains: [
        {
          name: 'CoreDomain', // Default domain name
          description: 'Core domain containing primary entities',
          entities: [],
        },
      ],
      version: requirements.version || '1.0.0',
      description: requirements.description || 'Domain model generated from requirements',
    };
    
    // Transform each entity from requirements to domain entity
    requirements.entities.forEach(entity => {
      const domainEntity = {
        name: entity.name,
        description: entity.description,
        attributes: entity.fields.map(field => fieldToAttribute(field)),
        behaviors: [], // Empty behaviors by default
      };
      
      domainModel.domains[0].entities.push(domainEntity);
    });
    
    // Validate the transformed domain model
    try {
      logger.info('Validating domain model against schema');
      domainModelSchema.parse(domainModel);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedError = error.format();
        throw new Error(`Invalid domain model format: ${JSON.stringify(formattedError)}`);
      }
      throw new Error(`Validation error: ${error}`);
    }
    
    // Write domain model to output file
    logger.info(`Writing domain model to ${outputPath}`);
    writeFile(outputPath, domainModel);
    
    // Also write versioned copy
    const ext = path.extname(outputPath);
    const baseOutputPath = outputPath.substring(0, outputPath.length - ext.length);
    const versionedOutputPath = getVersionedFilename(baseOutputPath, ext);
    
    logger.info(`Writing versioned domain model to ${versionedOutputPath}`);
    writeFile(versionedOutputPath, domainModel);
    
    // Generate TypeScript interfaces
    const interfacesOutputPath = path.join(path.dirname(outputPath), 'domain_interfaces.ts');
    let interfacesContent = '/**\n * Generated TypeScript interfaces for domain model\n */\n\n';
    
    domainModel.domains.forEach(domain => {
      domain.entities.forEach(entity => {
        interfacesContent += generateTypeScriptInterface(entity) + '\n';
      });
    });
    
    logger.info(`Writing TypeScript interfaces to ${interfacesOutputPath}`);
    fs.writeFileSync(interfacesOutputPath, interfacesContent);
    
    // Also write versioned interfaces
    const interfacesVersionedPath = getVersionedFilename(
      interfacesOutputPath.substring(0, interfacesOutputPath.length - 3), 
      '.ts'
    );
    logger.info(`Writing versioned TypeScript interfaces to ${interfacesVersionedPath}`);
    fs.writeFileSync(interfacesVersionedPath, interfacesContent);
    
    logger.info('Domain model generation completed successfully');
  } catch (error) {
    logger.error(`Domain model generation failed: ${error instanceof Error ? error.message : error}`);
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
    console.error('Usage: node domain_model_generator.ts --input /path/to/requirements.json --output /path/to/domain_model.json');
    process.exit(1);
  }
  
  const inputPath = args[inputIndex + 1];
  const outputPath = args[outputIndex + 1];
  
  if (!inputPath || !outputPath) {
    logger.error('Invalid arguments: paths must be specified for --input and --output');
    console.error('Usage: node domain_model_generator.ts --input /path/to/requirements.json --output /path/to/domain_model.json');
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
