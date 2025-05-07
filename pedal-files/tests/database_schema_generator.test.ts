/**
 * Tests for Database Schema Generator Operator
 */
import * as fs from 'fs';
import * as path from 'path';
import { run } from '../operators/database_schema_generator';

// Setup test directory and cleanup function
const testDir = path.join(__dirname, 'temp_db_schema');
const inputFile = path.join(testDir, 'zod_schemas.ts');
const outputFile = path.join(testDir, 'db_schema.ts');
const migrationDir = path.join(testDir, 'migrations');

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

describe('Database Schema Generator Operator', () => {
  test('should generate Drizzle schema and migrations from Zod schemas', async () => {
    // Create a valid Zod schemas input file
    const zodSchemas = `
/**
 * Generated Zod schemas from OpenAPI specification
 */

import { z } from 'zod';

// Schema for UserSchema
export const UserSchema = z.lazy(() => z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().min(18).optional(),
  isActive: z.boolean().optional(),
  createdAt: z.string().datetime({ offset: true }).optional(),
  updatedAt: z.string().datetime({ offset: true }).optional()
}));

// Schema for ProductSchema
export const ProductSchema = z.lazy(() => z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().min(0),
  categoryId: z.string().uuid(),
  tags: z.array(z.string()).optional()
}));

// Type definitions
export type User = z.infer<typeof UserSchema>;
export type Product = z.infer<typeof ProductSchema>;

// Request schemas
export const createUserRequestSchema = UserSchema;
export const getUserParamsSchema = z.object({
  id: z.string().uuid()
});
`;
    fs.writeFileSync(inputFile, zodSchemas);

    // Run the operator
    await run(inputFile, outputFile);

    // Verify the outputs exist
    expect(fs.existsSync(outputFile)).toBe(true);
    expect(fs.existsSync(migrationDir)).toBe(true);
    
    // At least one SQL migration file should exist
    const migrationFiles = fs.readdirSync(migrationDir);
    expect(migrationFiles.some(file => file.endsWith('.sql'))).toBe(true);

    // Verify the Drizzle schema content
    const schemaContent = fs.readFileSync(outputFile, 'utf-8');
    
    // Check for table definitions
    expect(schemaContent).toContain('export const user = pgTable(\'user\'');
    expect(schemaContent).toContain('export const product = pgTable(\'product\'');
    
    // Check for correct column types
    expect(schemaContent).toContain('id: uuid(\'id\').primaryKey()');
    expect(schemaContent).toContain('email: varchar(\'email\', { length: 255 }).notNull()');
    expect(schemaContent).toContain('name: varchar(\'name\', { length: 100 }).notNull()');
    expect(schemaContent).toContain('age: integer(\'age\')');
    expect(schemaContent).toContain('isActive: boolean(\'isActive\')');
    expect(schemaContent).toContain('price: decimal(\'price\'');
    expect(schemaContent).toContain('tags: jsonb(\'tags\')');
    
    // Check for timestamps
    expect(schemaContent).toContain('created_at: timestamp(\'created_at\').notNull().defaultNow()');
    expect(schemaContent).toContain('updated_at: timestamp(\'updated_at\').notNull().defaultNow()');
    
    // Check for relations structure
    expect(schemaContent).toContain('export const userRelations = relations(user');
    expect(schemaContent).toContain('export const productRelations = relations(product');
    
    // Check SQL migration file
    const migrationFile = path.join(migrationDir, migrationFiles[0]);
    const migrationContent = fs.readFileSync(migrationFile, 'utf-8');
    
    expect(migrationContent).toContain('CREATE TABLE IF NOT EXISTS user');
    expect(migrationContent).toContain('CREATE TABLE IF NOT EXISTS product');
    expect(migrationContent).toContain('id UUID PRIMARY KEY');
    expect(migrationContent).toContain('email VARCHAR(255) NOT NULL');
    expect(migrationContent).toContain('price DECIMAL');
    expect(migrationContent).toContain('tags JSONB');
  });

  test('should handle Zod schemas without objects', async () => {
    // Create Zod schemas with no object schemas
    const noObjectZodSchemas = `
/**
 * Generated Zod schemas with no objects
 */

import { z } from 'zod';

// Just primitive schemas
export const IdSchema = z.string().uuid();
export const EmailSchema = z.string().email();
export const AgeSchema = z.number().int().min(18);
export const TagsSchema = z.array(z.string());

// No type definitions
`;
    fs.writeFileSync(inputFile, noObjectZodSchemas);

    // Run the operator
    await run(inputFile, outputFile);

    // Verify the output exists but has no table definitions
    expect(fs.existsSync(outputFile)).toBe(true);
    
    const schemaContent = fs.readFileSync(outputFile, 'utf-8');
    expect(schemaContent).not.toContain('export const');
    expect(schemaContent).toContain('// Drizzle schema definitions');
  });

  test('should handle non-existent input file', async () => {
    const nonExistentFile = path.join(testDir, 'non_existent.ts');
    
    // Run the operator with a non-existent file and expect it to throw
    await expect(run(nonExistentFile, outputFile)).rejects.toThrow();
  });

  test('should handle complex nested Zod schemas', async () => {
    // Create Zod schemas with nested structures
    const complexZodSchemas = `
/**
 * Complex Zod schemas with nested structures
 */

import { z } from 'zod';

// Address schema
export const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  country: z.string()
});

// Contact schema with nested address
export const ContactSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  address: AddressSchema,
  alternateAddresses: z.array(AddressSchema).optional()
});

// Order schema with references
export const OrderSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1),
    price: z.number().min(0)
  })),
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
  shippingAddress: AddressSchema,
  billingAddress: AddressSchema.optional(),
  total: z.number().min(0),
  createdAt: z.string().datetime({ offset: true })
});

// Export types
export type Address = z.infer<typeof AddressSchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type Order = z.infer<typeof OrderSchema>;
`;
    fs.writeFileSync(inputFile, complexZodSchemas);

    // Run the operator
    await run(inputFile, outputFile);

    // Verify the output exists
    expect(fs.existsSync(outputFile)).toBe(true);
    
    const schemaContent = fs.readFileSync(outputFile, 'utf-8');
    
    // Check for all tables
    expect(schemaContent).toContain('export const address = pgTable(\'address\'');
    expect(schemaContent).toContain('export const contact = pgTable(\'contact\'');
    expect(schemaContent).toContain('export const order = pgTable(\'order\'');
    
    // Check for complex fields handled appropriately
    expect(schemaContent).toContain('address: jsonb(\'address\').notNull()');
    expect(schemaContent).toContain('alternateAddresses: jsonb(\'alternateAddresses\')');
    expect(schemaContent).toContain('items: jsonb(\'items\').notNull()');
    expect(schemaContent).toContain('status: varchar(\'status\', { length: 255 }).notNull()');
  });
});
