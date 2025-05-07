/**
 * Tests for Artifact Persist Operator
 */
import * as fs from 'fs';
import * as path from 'path';
import { run } from '../operators/artifact_persist';

// Setup test directory and cleanup function
const testDir = path.join(__dirname, 'temp_artifact_persist');
const inputDir = path.join(testDir, 'artifacts');
const outputDir = path.join(testDir, 'dist');

beforeAll(() => {
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  if (!fs.existsSync(inputDir)) {
    fs.mkdirSync(inputDir, { recursive: true });
  }
});

afterAll(() => {
  // Clean up test files
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

describe('Artifact Persist Operator', () => {
  test('should copy artifacts to distribution directory with manifest', async () => {
    // Create some test artifacts
    const requirementsJson = path.join(inputDir, 'requirements.json');
    fs.writeFileSync(requirementsJson, JSON.stringify({
      entities: [{ name: 'User', fields: [{ name: 'id', type: 'string' }] }],
      version: '1.0.0'
    }));
    
    const domainModelJson = path.join(inputDir, 'domain_model.json');
    fs.writeFileSync(domainModelJson, JSON.stringify({
      domains: [{ name: 'Core', entities: [{ name: 'User', attributes: [{ name: 'id', type: 'string' }] }] }],
      version: '1.0.0'
    }));
    
    const openApiYaml = path.join(inputDir, 'oas.yaml');
    fs.writeFileSync(openApiYaml, 'openapi: 3.0.0\ninfo:\n  title: Test API\n  version: 1.0.0');
    
    // Create a nested directory with artifact
    const nestedDir = path.join(inputDir, 'nested');
    fs.mkdirSync(nestedDir, { recursive: true });
    
    const nestedFile = path.join(nestedDir, 'db_schema.ts');
    fs.writeFileSync(nestedFile, 'export const users = pgTable("users", { id: uuid("id").primaryKey() });');

    // Run the operator
    await run(inputDir, outputDir);

    // Verify the output directory exists
    expect(fs.existsSync(outputDir)).toBe(true);
    
    // Verify manifest was created
    const manifestPath = path.join(outputDir, 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    
    // Verify manifest content
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.files.length).toBe(4); // All artifacts including nested one
    
    // Verify each artifact exists in the output directory
    expect(fs.existsSync(path.join(outputDir, 'requirements.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'domain_model.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'oas.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'nested', 'db_schema.ts'))).toBe(true);
    
    // Verify manifest file entries
    const fileNames = manifest.files.map((f: any) => f.name);
    expect(fileNames).toContain('requirements.json');
    expect(fileNames).toContain('domain_model.json');
    expect(fileNames).toContain('oas.yaml');
    expect(fileNames).toContain('db_schema.ts');
    
    // Verify each file in manifest has correct properties
    manifest.files.forEach((file: any) => {
      expect(file).toHaveProperty('path');
      expect(file).toHaveProperty('size');
      expect(file).toHaveProperty('hash');
      expect(typeof file.hash).toBe('string');
      expect(file.hash.length).toBe(64); // SHA-256 hash is 64 characters
    });
  });

  test('should handle empty input directory', async () => {
    // Create an empty input directory
    const emptyDir = path.join(testDir, 'empty');
    fs.mkdirSync(emptyDir, { recursive: true });

    // Run the operator
    await run(emptyDir, outputDir);

    // Verify the output directory exists
    expect(fs.existsSync(outputDir)).toBe(true);
    
    // Verify manifest was created
    const manifestPath = path.join(outputDir, 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    
    // Verify manifest has no files
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.files.length).toBe(0);
  });

  test('should handle non-existent input directory', async () => {
    const nonExistentDir = path.join(testDir, 'non_existent');
    
    // Run the operator with a non-existent directory and expect it to throw
    await expect(run(nonExistentDir, outputDir)).rejects.toThrow();
  });

  test('should handle versioned files correctly', async () => {
    // Create artifacts with version timestamps
    const versionedDir = path.join(testDir, 'versioned');
    fs.mkdirSync(versionedDir, { recursive: true });
    
    const regularFile = path.join(versionedDir, 'requirements.json');
    fs.writeFileSync(regularFile, '{"version":"1.0.0"}');
    
    const versionedFile = path.join(versionedDir, 'requirements_20250407.json');
    fs.writeFileSync(versionedFile, '{"version":"1.0.1"}');

    // Run the operator
    const versionedOutput = path.join(testDir, 'versioned_output');
    await run(versionedDir, versionedOutput);

    // Verify both files were copied
    expect(fs.existsSync(path.join(versionedOutput, 'requirements.json'))).toBe(true);
    expect(fs.existsSync(path.join(versionedOutput, 'requirements_20250407.json'))).toBe(true);
    
    // Verify manifest contains both files
    const manifest = JSON.parse(fs.readFileSync(path.join(versionedOutput, 'manifest.json'), 'utf-8'));
    const fileNames = manifest.files.map((f: any) => f.name);
    expect(fileNames).toContain('requirements.json');
    expect(fileNames).toContain('requirements_20250407.json');
    
    // Verify both were identified with the same stage
    const stages = manifest.files.map((f: any) => path.basename(f.path).split('_')[0]);
    expect(stages.every(s => s === 'requirements')).toBe(true);
  });
});
