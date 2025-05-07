/**
 * Database schema definition for PEDAL
 * Provides types and validation for database schema generation
 */
import { z } from 'zod';

/**
 * Database column type enum
 */
export const columnTypeEnum = z.enum([
  // String types
  "varchar",
  "text",
  "char",
  
  // Numeric types
  "integer",
  "bigint",
  "smallint",
  "decimal",
  "numeric",
  "real",
  "double",
  
  // Boolean type
  "boolean",
  
  // Date and time types
  "date",
  "time",
  "timestamp",
  "timestamptz",
  
  // JSON types
  "json",
  "jsonb",
  
  // UUID type
  "uuid",
  
  // Array types
  "array",
]);

/**
 * Database column options schema
 */
export const columnOptionsSchema = z.object({
  /** Primary key flag */
  primaryKey: z.boolean().optional().default(false),
  
  /** Unique constraint flag */
  unique: z.boolean().optional().default(false),
  
  /** Not null constraint flag */
  notNull: z.boolean().optional().default(false),
  
  /** Default value */
  default: z.any().optional(),
  
  /** For varchar/char types, the length */
  length: z.number().optional(),
  
  /** For numeric/decimal types, the precision */
  precision: z.number().optional(),
  
  /** For numeric/decimal types, the scale */
  scale: z.number().optional(),
  
  /** Column description/comment */
  description: z.string().optional(),
});

/**
 * Database column schema
 */
export const columnSchema = z.object({
  /** Column name */
  name: z.string().min(1, "Column name is required"),
  
  /** Column type */
  type: columnTypeEnum,
  
  /** Column options */
  options: columnOptionsSchema.optional().default({}),
});

/**
 * Foreign key reference schema
 */
export const foreignKeySchema = z.object({
  /** Column in the current table */
  column: z.string().min(1, "Column name is required"),
  
  /** Referenced table */
  referencesTable: z.string().min(1, "Referenced table is required"),
  
  /** Referenced column */
  referencesColumn: z.string().min(1, "Referenced column is required"),
  
  /** On delete action */
  onDelete: z.enum(["CASCADE", "RESTRICT", "SET NULL", "SET DEFAULT", "NO ACTION"]).optional(),
  
  /** On update action */
  onUpdate: z.enum(["CASCADE", "RESTRICT", "SET NULL", "SET DEFAULT", "NO ACTION"]).optional(),
});

/**
 * Index schema
 */
export const indexSchema = z.object({
  /** Index name */
  name: z.string().min(1, "Index name is required"),
  
  /** Columns included in the index */
  columns: z.array(z.string()).min(1, "At least one column is required"),
  
  /** Unique index flag */
  unique: z.boolean().optional().default(false),
  
  /** Index type */
  type: z.enum(["btree", "hash", "gist", "gin"]).optional().default("btree"),
});

/**
 * Table schema
 */
export const tableSchema = z.object({
  /** Table name */
  name: z.string().min(1, "Table name is required"),
  
  /** Columns in the table */
  columns: z.array(columnSchema).min(1, "At least one column is required"),
  
  /** Foreign key constraints */
  foreignKeys: z.array(foreignKeySchema).optional().default([]),
  
  /** Indexes */
  indexes: z.array(indexSchema).optional().default([]),
  
  /** Table description/comment */
  description: z.string().optional(),
});

/**
 * Database schema
 */
export const databaseSchema = z.object({
  /** Tables in the database */
  tables: z.array(tableSchema).min(1, "At least one table is required"),
  
  /** Schema version */
  version: z.string().optional().default("1.0.0"),
  
  /** Schema description */
  description: z.string().optional(),
});

/**
 * Type for the database schema
 */
export type DatabaseSchema = z.infer<typeof databaseSchema>;

/**
 * Type for a table
 */
export type Table = z.infer<typeof tableSchema>;

/**
 * Type for a column
 */
export type Column = z.infer<typeof columnSchema>;

/**
 * Type for a foreign key
 */
export type ForeignKey = z.infer<typeof foreignKeySchema>;

/**
 * Type for an index
 */
export type Index = z.infer<typeof indexSchema>;
