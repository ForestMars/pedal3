#!/usr/bin/env node
/**
 * Requirements Ingest Operator
 * 
 * Parses a YAML requirements file, validates it against the schema,
 * and writes it as a JSON file for further processing.
 * 
 * Usage:
 *   node requirements_ingest.ts --input /path/to/requirements.yaml --output /path/to/requirements.json
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { z } from 'zod';
import { requirementsSchema, type Requirements } from '../types/requirements.schema';
import { config } from '../config/storage.config';
import { createLogger } from '../utils/logger';
import { readFile, writeFile, getVersionedFilename } from '../utils/file';

// Get task ID from environment variable or use default
const taskId = process.env.TASK_ID || 'requirements_ingest';
const logger = createLogger(taskId);

/**
 * Runs the requirements ingest process
 * @param inputPath - Path to the input YAML file
 * @param outputPath - Path to the output JSON file
 * @returns Promise resolving when complete
 */
export async function run(inputPath: string, outputPath: string): Promise<void> {
  try {
    logger.info(`Starting requirements ingest from ${inputPath} to ${outputPath}`);
    
    // Read YAML file
    logger.info(`Reading requirements file from ${inputPath}`);
    let rawContent: string;
    try {
      rawContent = fs.readFileSync(inputPath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read requirements file: ${error}`);
    }
    
    // Parse YAML to object
    let parsedYaml: any;
    try {
      logger.info('Parsing YAML content');
      parsedYaml = yaml.parse(rawContent);
    } catch (error) {
      throw new Error(`Failed to parse YAML: ${error}`);
    }
    
    // Validate against schema
    let validatedRequirements: Requirements;
    try {
      logger.info('Validating requirements against schema');
      validatedRequirements = requirementsSchema.parse(parsedYaml);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedError = error.format();
        throw new Error(`Invalid requirements format: ${JSON.stringify(formattedError)}`);
      }
      throw new Error(`Validation error: ${error}`);
    }
    
    // Write validated JSON
    try {
      logger.info(`Writing validated requirements to ${outputPath}`);
      fs.writeFileSync(outputPath, JSON.stringify(validatedRequirements, null, 2));
      
      // Also write versioned copy
      const ext = path.extname(outputPath);
      const baseOutputPath = outputPath.substring(0, outputPath.length - ext.length);
      const versionedOutputPath = getVersionedFilename(baseOutputPath, ext);
      
      logger.info(`Writing versioned requirements to ${versionedOutputPath}`);
      fs.writeFileSync(versionedOutputPath, JSON.stringify(validatedRequirements, null, 2));
    } catch (error) {
      throw new Error(`Failed to write output file: ${error}`);
    }
    
    logger.info('Requirements ingest completed successfully');
  } catch (error) {
    logger.error(`Requirements ingest failed: ${error instanceof Error ? error.message : error}`);
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
    console.error('Usage: node requirements_ingest.ts --input /path/to/requirements.yaml --output /path/to/requirements.json');
    process.exit(1);
  }
  
  const inputPath = args[inputIndex + 1];
  const outputPath = args[outputIndex + 1];
  
  if (!inputPath || !outputPath) {
    logger.error('Invalid arguments: paths must be specified for --input and --output');
    console.error('Usage: node requirements_ingest.ts --input /path/to/requirements.yaml --output /path/to/requirements.json');
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
