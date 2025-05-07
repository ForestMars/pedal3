#!/usr/bin/env node
/**
 * Artifact Persist Operator
 * 
 * Collects artifacts from previous stages and creates a distribution package
 * with a manifest listing all included files.
 * 
 * Usage:
 *   node artifact_persist.ts --input /path/to/artifacts --output /path/to/dist
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { config } from '../config/storage.config';
import { createLogger } from '../utils/logger';
import { readFile, writeFile, copyFile, ensureDirectoryExists } from '../utils/file';

// Get task ID from environment variable or use default
const taskId = process.env.TASK_ID || 'artifact_persist';
const logger = createLogger(taskId);

/**
 * Interface for artifact manifest
 */
interface ArtifactManifest {
  version: string;
  generatedAt: string;
  files: Array<{
    name: string;
    path: string;
    size: number;
    hash: string;
  }>;
}

/**
 * Calculates SHA256 hash of a file
 * @param filePath - Path to the file
 * @returns SHA256 hash as hex string
 */
function calculateFileHash(filePath: string): string {
  const fileContent = fs.readFileSync(filePath);
  return createHash('sha256').update(fileContent).digest('hex');
}

/**
 * Gets file size in bytes
 * @param filePath - Path to the file
 * @returns File size in bytes
 */
function getFileSize(filePath: string): number {
  const stats = fs.statSync(filePath);
  return stats.size;
}

/**
 * Recursively collects files from a directory
 * @param dirPath - Path to the directory
 * @param fileList - Accumulator for file paths
 * @returns Array of file paths
 */
function collectFiles(dirPath: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) {
    return fileList;
  }
  
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    
    if (fs.statSync(filePath).isDirectory()) {
      fileList = collectFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

/**
 * Gets the artifact stage from a file path
 * @param filePath - Path to the file
 * @returns Stage name (e.g., 'requirements', 'domain_model')
 */
function getArtifactStage(filePath: string): string {
  const fileName = path.basename(filePath);
  
  // Extract base name without versioning and extension
  const baseNameMatch = fileName.match(/^(.+?)(?:_\d{8})?(\.[^.]+)?$/);
  if (baseNameMatch) {
    return baseNameMatch[1];
  }
  
  return fileName;
}

/**
 * Runs the artifact persist process
 * @param inputPath - Path to the input directory (artifacts)
 * @param outputPath - Path to the output directory (dist)
 * @returns Promise resolving when complete
 */
export async function run(inputPath: string, outputPath: string): Promise<void> {
  try {
    logger.info(`Starting artifact persistence from ${inputPath} to ${outputPath}`);
    
    // Ensure input/output directories exist
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input directory not found: ${inputPath}`);
    }
    
    ensureDirectoryExists(outputPath);
    
    // Collect all files from artifacts directory
    logger.info(`Collecting artifacts from ${inputPath}`);
    const artifactFiles = collectFiles(inputPath);
    
    if (artifactFiles.length === 0) {
      logger.warn('No artifacts found to persist');
    } else {
      logger.info(`Found ${artifactFiles.length} artifacts to persist`);
    }
    
    // Create manifest
    const manifest: ArtifactManifest = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      files: [],
    };
    
    // Copy artifacts to dist directory and add to manifest
    for (const artifactFile of artifactFiles) {
      const relativePath = path.relative(inputPath, artifactFile);
      const outputFilePath = path.join(outputPath, relativePath);
      const stageName = getArtifactStage(artifactFile);
      
      // Ensure the subdirectory exists
      ensureDirectoryExists(path.dirname(outputFilePath));
      
      // Copy the file
      logger.info(`Copying ${relativePath} to ${outputFilePath}`);
      fs.copyFileSync(artifactFile, outputFilePath);
      
      // Calculate hash and size
      const hash = calculateFileHash(outputFilePath);
      const size = getFileSize(outputFilePath);
      
      // Add to manifest
      manifest.files.push({
        name: path.basename(artifactFile),
        path: relativePath,
        size,
        hash,
      });
    }
    
    // Write manifest to dist directory
    const manifestPath = path.join(outputPath, 'manifest.json');
    logger.info(`Writing manifest to ${manifestPath}`);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    
    // If remote storage is configured, upload to it
    if (config.remoteStorage) {
      logger.info(`Remote storage configured (${config.remoteStorage.provider}), but upload not implemented yet`);
      // This would be the place to implement remote storage upload
    }
    
    logger.info('Artifact persistence completed successfully');
  } catch (error) {
    logger.error(`Artifact persistence failed: ${error instanceof Error ? error.message : error}`);
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
    console.error('Usage: node artifact_persist.ts --input /path/to/artifacts --output /path/to/dist');
    process.exit(1);
  }
  
  const inputPath = args[inputIndex + 1];
  const outputPath = args[outputIndex + 1];
  
  if (!inputPath || !outputPath) {
    logger.error('Invalid arguments: paths must be specified for --input and --output');
    console.error('Usage: node artifact_persist.ts --input /path/to/artifacts --output /path/to/dist');
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
