/**
 * Requirements schema definition for PEDAL
 * Defines the structure and validation for requirements.yaml/json
 */
import { z } from 'zod';

/**
 * Field schema - defines a field in an entity
 */
export const fieldSchema = z.object({
  /** Name of the field */
  name: z.string().min(1, "Field name is required"),
  
  /** Type of the field */
  type: z.string().min(1, "Field type is required"),
  
  /** Optional description of the field */
  description: z.string().optional(),
  
  /** Whether the field is required */
  required: z.boolean().optional().default(true),
  
  /** Whether the field is unique */
  unique: z.boolean().optional().default(false),
});

/**
 * Entity schema - defines an entity in the domain model
 */
export const entitySchema = z.object({
  /** Name of the entity */
  name: z.string().min(1, "Entity name is required"),
  
  /** Fields that comprise the entity */
  fields: z.array(fieldSchema).min(1, "At least one field is required"),
  
  /** Optional description of the entity */
  description: z.string().optional(),
});

/**
 * Requirements schema - defines the overall structure of requirements
 */
export const requirementsSchema = z.object({
  /** Entities in the requirements */
  entities: z.array(entitySchema).min(1, "At least one entity is required"),
  
  /** Optional version of the requirements */
  version: z.string().optional().default("1.0.0"),
  
  /** Optional description of the requirements */
  description: z.string().optional(),
});

/**
 * Type for the requirements
 */
export type Requirements = z.infer<typeof requirementsSchema>;

/**
 * Type for an entity
 */
export type Entity = z.infer<typeof entitySchema>;

/**
 * Type for a field
 */
export type Field = z.infer<typeof fieldSchema>;
