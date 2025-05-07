#!/usr/bin/env node
/**
 * Action Model Generator Operator
 * 
 * Derives an action model from the domain model, defining
 * the possible actions that can be performed on domain entities.
 * 
 * Usage:
 *   node action_model_generator.ts --input /path/to/domain_model.json --output /path/to/action_model.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { domainModelSchema, type DomainModel } from '../types/domain_model.schema';
import { actionModelSchema, type ActionModel } from '../types/action_model.schema';
import { config } from '../config/storage.config';
import { createLogger } from '../utils/logger';
import { readFile, writeFile, getVersionedFilename } from '../utils/file';

// Get task ID from environment variable or use default
const taskId = process.env.TASK_ID || 'action_model_generator';
const logger = createLogger(taskId);

/**
 * HTTP methods for CRUD operations
 */
const crudHttpMethods = {
  create: "POST",
  read: "GET",
  update: "PUT",
  delete: "DELETE",
} as const;

/**
 * Generates CRUD actions for a domain entity
 * @param entityName - Name of the entity
 * @param attributes - Attributes of the entity
 * @returns Array of CRUD actions
 */
function generateCrudActions(entityName: string, attributes: any[]): any[] {
  const pluralName = `${entityName.toLowerCase()}s`; // Simple pluralization
  const actions = [];
  
  // Find the ID attribute, defaulting to the first attribute if none has 'id' in the name
  const idAttribute = attributes.find(attr => attr.name.toLowerCase().includes('id')) || attributes[0];
  
  // CREATE action
  actions.push({
    name: `create${entityName}`,
    actor: "User", // Default actor
    entity: entityName,
    type: "create",
    httpMethod: crudHttpMethods.create,
    httpPath: `/${pluralName}`,
    parameters: attributes
      .filter(attr => attr.name !== idAttribute.name) // Exclude ID for creation
      .map(attr => ({
        name: attr.name,
        type: attr.type,
        required: attr.required,
        description: attr.description,
      })),
    preconditions: [
      {
        description: `User has permission to create ${entityName}`,
      }
    ],
    postconditions: [
      {
        description: `${entityName} is created in the system`,
      }
    ],
    description: `Creates a new ${entityName}`,
  });
  
  // READ action (get by ID)
  actions.push({
    name: `get${entityName}`,
    actor: "User",
    entity: entityName,
    type: "read",
    httpMethod: crudHttpMethods.read,
    httpPath: `/${pluralName}/{${idAttribute.name}}`,
    parameters: [
      {
        name: idAttribute.name,
        type: idAttribute.type,
        required: true,
        description: `Identifier for the ${entityName}`,
      }
    ],
    preconditions: [
      {
        description: `${entityName} with the given ${idAttribute.name} exists`,
      }
    ],
    postconditions: [
      {
        description: `${entityName} details are returned`,
      }
    ],
    description: `Retrieves a ${entityName} by ${idAttribute.name}`,
  });
  
  // READ action (list all)
  actions.push({
    name: `list${entityName}s`,
    actor: "User",
    entity: entityName,
    type: "read",
    httpMethod: crudHttpMethods.read,
    httpPath: `/${pluralName}`,
    parameters: [],
    preconditions: [
      {
        description: `User has permission to list ${entityName}s`,
      }
    ],
    postconditions: [
      {
        description: `List of ${entityName}s is returned`,
      }
    ],
    description: `Retrieves a list of ${entityName}s`,
  });
  
  // UPDATE action
  actions.push({
    name: `update${entityName}`,
    actor: "User",
    entity: entityName,
    type: "update",
    httpMethod: crudHttpMethods.update,
    httpPath: `/${pluralName}/{${idAttribute.name}}`,
    parameters: [
      {
        name: idAttribute.name,
        type: idAttribute.type,
        required: true,
        description: `Identifier for the ${entityName}`,
      },
      ...attributes
        .filter(attr => attr.name !== idAttribute.name)
        .map(attr => ({
          name: attr.name,
          type: attr.type,
          required: false, // Updates don't require all fields
          description: attr.description,
        }))
    ],
    preconditions: [
      {
        description: `${entityName} with the given ${idAttribute.name} exists`,
      },
      {
        description: `User has permission to update the ${entityName}`,
      }
    ],
    postconditions: [
      {
        description: `${entityName} is updated in the system`,
      }
    ],
    description: `Updates an existing ${entityName}`,
  });
  
  // DELETE action
  actions.push({
    name: `delete${entityName}`,
    actor: "User",
    entity: entityName,
    type: "delete",
    httpMethod: crudHttpMethods.delete,
    httpPath: `/${pluralName}/{${idAttribute.name}}`,
    parameters: [
      {
        name: idAttribute.name,
        type: idAttribute.type,
        required: true,
        description: `Identifier for the ${entityName}`,
      }
    ],
    preconditions: [
      {
        description: `${entityName} with the given ${idAttribute.name} exists`,
      },
      {
        description: `User has permission to delete the ${entityName}`,
      }
    ],
    postconditions: [
      {
        description: `${entityName} is removed from the system`,
      }
    ],
    description: `Deletes an existing ${entityName}`,
  });
  
  return actions;
}

/**
 * Runs the action model generator process
 * @param inputPath - Path to the input JSON file (domain model)
 * @param outputPath - Path to the output JSON file (action model)
 * @returns Promise resolving when complete
 */
export async function run(inputPath: string, outputPath: string): Promise<void> {
  try {
    logger.info(`Starting action model generation from ${inputPath} to ${outputPath}`);
    
    // Read domain model file
    logger.info(`Reading domain model from ${inputPath}`);
    let domainModel: DomainModel;
    try {
      const domainModelData = readFile(inputPath);
      domainModel = domainModelSchema.parse(domainModelData);
    } catch (error) {
      throw new Error(`Failed to read or parse domain model: ${error}`);
    }
    
    // Transform domain model into action model
    logger.info('Deriving action model from domain model');
    
    const actionModel: ActionModel = {
      actions: [],
      version: domainModel.version || '1.0.0',
      description: 'Action model derived from domain model',
    };
    
    // Generate CRUD actions for each entity in each domain
    domainModel.domains.forEach(domain => {
      domain.entities.forEach(entity => {
        const crudActions = generateCrudActions(entity.name, entity.attributes);
        actionModel.actions.push(...crudActions);
      });
    });
    
    // Validate the generated action model
    try {
      logger.info('Validating action model against schema');
      actionModelSchema.parse(actionModel);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedError = error.format();
        throw new Error(`Invalid action model format: ${JSON.stringify(formattedError)}`);
      }
      throw new Error(`Validation error: ${error}`);
    }
    
    // Write action model to output file
    logger.info(`Writing action model to ${outputPath}`);
    writeFile(outputPath, actionModel);
    
    // Also write versioned copy
    const ext = path.extname(outputPath);
    const baseOutputPath = outputPath.substring(0, outputPath.length - ext.length);
    const versionedOutputPath = getVersionedFilename(baseOutputPath, ext);
    
    logger.info(`Writing versioned action model to ${versionedOutputPath}`);
    writeFile(versionedOutputPath, actionModel);
    
    logger.info('Action model generation completed successfully');
  } catch (error) {
    logger.error(`Action model generation failed: ${error instanceof Error ? error.message : error}`);
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
    console.error('Usage: node action_model_generator.ts --input /path/to/domain_model.json --output /path/to/action_model.json');
    process.exit(1);
  }
  
  const inputPath = args[inputIndex + 1];
  const outputPath = args[outputIndex + 1];
  
  if (!inputPath || !outputPath) {
    logger.error('Invalid arguments: paths must be specified for --input and --output');
    console.error('Usage: node action_model_generator.ts --input /path/to/domain_model.json --output /path/to/action_model.json');
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
