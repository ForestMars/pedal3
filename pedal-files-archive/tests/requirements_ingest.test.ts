/**
 * Tests for Requirements Ingest Operator
 */
import * as fs from 'fs';
import * as path from 'path';
import { run } from '../operators/requirements_ingest';
import { requirementsSchema } from '../types/requirements.schema';

// Setup test directory and cleanup function
const testDir = path.join(__dirname, 'temp_requirements');
const inputFile = path.join(testDir, 'requirements.yaml');
const outputFile = path.join(testDir, 'requirements.json');

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

describe('Requirements Ingest Operator', () => {
  test('should process valid YAML and produce valid JSON', async () => {
    // Create a valid YAML input file
    const validYaml = `
entities:
  - name: User
    fields:
      - name: id
        type: uuid
        required: true
        unique: true
      - name: email
        type: string
        required: true
        unique: true
      - name: name
        type: string
        required: true
  - name: Product
    fields:
      - name: id
        type: uuid
        required: true
        unique: true
      - name: name
        type: string
        required: true
      - name: price
        type: number
        required: true
version: '1.0.0'
description: 'Test requirements'
`;
    fs.writeFileSync(inputFile, validYaml);

    // Run the operator
    await run(inputFile, outputFile);

    // Verify the output exists
    expect(fs.existsSync(outputFile)).toBe(true);

    // Verify the output is valid JSON and matches the schema
    const outputJson = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
    expect(() => requirementsSchema.parse(outputJson)).not.toThrow();
    
    // Verify content was correctly transformed
    expect(outputJson.entities.length).toBe(2);
    expect(outputJson.entities[0].name).toBe('User');
    expect(outputJson.entities[0].fields.length).toBe(3);
    expect(outputJson.entities[1].name).toBe('Product');
    expect(outputJson.version).toBe('1.0.0');
    expect(outputJson.description).toBe('Test requirements');
  });

  test('should reject invalid YAML (missing required fields)', async () => {
    // Create an invalid YAML input file (entities array with missing required fields)
    const invalidYaml = `
entities:
  - name: User
    # Missing fields array
`;
    fs.writeFileSync(inputFile, invalidYaml);

    // Run the operator and expect it to throw
    await expect(run(inputFile, outputFile)).rejects.toThrow();
  });

  test('should reject invalid YAML (malformed syntax)', async () => {
    // Create an invalid YAML input file (malformed syntax)
    const invalidYaml = `
entities:
  - name: User
    fields:
      - name: id
        type: uuid
        required: true
        unique: true
      - name: [malformed, array]
`;
    fs.writeFileSync(inputFile, invalidYaml);

    // Run the operator and expect it to throw
    await expect(run(inputFile, outputFile)).rejects.toThrow();
  });

  test('should handle non-existent input file', async () => {
    const nonExistentFile = path.join(testDir, 'non_existent.yaml');
    
    // Run the operator with a non-existent file and expect it to throw
    await expect(run(nonExistentFile, outputFile)).rejects.toThrow();
  });

  test('should handle empty input file', async () => {
    // Create an empty input file
    fs.writeFileSync(inputFile, '');

    // Run the operator and expect it to throw
    await expect(run(inputFile, outputFile)).rejects.toThrow();
  });
});
