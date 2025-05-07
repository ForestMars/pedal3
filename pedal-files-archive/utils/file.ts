/**
 * File utilities for PEDAL operators
 * Provides consistent file operations with error handling
 */
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { createLogger } from './logger';

const logger = createLogger('file_utils');

/**
 * Ensures a directory exists, creating it if necessary
 * @param dirPath - Path to directory
 */
export function ensureDirectoryExists(dirPath: string): void {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      logger.info(`Created directory: ${dirPath}`);
    }
  } catch (error) {
    logger.error(`Failed to create directory ${dirPath}`, error);
    throw new Error(`Failed to create directory ${dirPath}: ${error}`);
  }
}

/**
 * Reads a file and parses its content based on extension
 * @param filePath - Path to file
 * @returns Parsed content
 */
export function readFile(filePath: string): any {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.json':
        return JSON.parse(content);
      case '.yaml':
      case '.yml':
        return yaml.parse(content);
      default:
        return content;
    }
  } catch (error) {
    logger.error(`Failed to read file ${filePath}`, error);
    throw new Error(`Failed to read file ${filePath}: ${error}`);
  }
}

/**
 * Writes content to a file, serializing based on extension
 * @param filePath - Path to file
 * @param content - Content to write
 */
export function writeFile(filePath: string, content: any): void {
  try {
    ensureDirectoryExists(path.dirname(filePath));
    
    const ext = path.extname(filePath).toLowerCase();
    let serializedContent: string;
    
    switch (ext) {
      case '.json':
        serializedContent = JSON.stringify(content, null, 2);
        break;
      case '.yaml':
      case '.yml':
        serializedContent = yaml.stringify(content);
        break;
      default:
        serializedContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    }
    
    fs.writeFileSync(filePath, serializedContent);
    logger.info(`Successfully wrote to file: ${filePath}`);
  } catch (error) {
    logger.error(`Failed to write to file ${filePath}`, error);
    throw new Error(`Failed to write to file ${filePath}: ${error}`);
  }
}

/**
 * Generates a versioned filename
 * @param basePath - Base path without extension
 * @param ext - File extension
 * @returns Versioned filename
 */
export function getVersionedFilename(basePath: string, ext: string): string {
  const date = new Date();
  const timestamp = date.toISOString().split('T')[0].replace(/-/g, '');
  const baseDir = path.dirname(basePath);
  const baseFilename = path.basename(basePath);
  
  return path.join(baseDir, `${baseFilename}_${timestamp}${ext}`);
}

/**
 * Copies a file with optional versioning
 * @param sourcePath - Source file path
 * @param destPath - Destination file path
 * @param versioned - Whether to create a versioned copy
 */
export function copyFile(sourcePath: string, destPath: string, versioned: boolean = false): void {
  try {
    ensureDirectoryExists(path.dirname(destPath));
    
    if (versioned) {
      const ext = path.extname(destPath);
      const baseDestPath = destPath.substring(0, destPath.length - ext.length);
      const versionedDestPath = getVersionedFilename(baseDestPath, ext);
      fs.copyFileSync(sourcePath, versionedDestPath);
      logger.info(`Copied file ${sourcePath} to ${versionedDestPath}`);
    } else {
      fs.copyFileSync(sourcePath, destPath);
      logger.info(`Copied file ${sourcePath} to ${destPath}`);
    }
  } catch (error) {
    logger.error(`Failed to copy file from ${sourcePath} to ${destPath}`, error);
    throw new Error(`Failed to copy file from ${sourcePath} to ${destPath}: ${error}`);
  }
}
