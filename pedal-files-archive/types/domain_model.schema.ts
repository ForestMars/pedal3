/**
 * Domain model schema definition for PEDAL
 * Defines the structure and validation for domain_model.json
 */
import { z } from 'zod';

/**
 * Attribute schema - defines an attribute of an entity
 * Similar to field in requirements, but with domain-specific enrichment
 */
export const attributeSchema = z.object({
  /** Name of the attribute */
  name: z.string().min(1, "Attribute name is required"),
  
  /** Type of the attribute */
  type: z.string().min(1, "Attribute type is required"),
  
  /** Optional description of the attribute */
  description: z.string().optional(),
  
  /** Whether the attribute is required */
  required: z.boolean().optional().default(true),
  
  /** Whether the attribute is unique */
  unique: z.boolean().optional().default(false),
  
  /** Optional validation rules */
  validation: z.record(z.any()).optional(),
});

/**
 * Domain entity schema - defines an entity in a specific domain
 */
export const domainEntitySchema = z.object({
  /** Name of the entity */
  name: z.string().min(1, "Entity name is required"),
  
  /** Attributes that comprise the entity */
  attributes: z.array(attributeSchema).min(1, "At least one attribute is required"),
  
  /** Optional description of the entity */
  description: z.string().optional(),
  
  /** Optional behaviors (methods) of the entity */
  behaviors: z.array(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    parameters: z.array(z.object({
      name: z.string().min(1),
      type: z.string().min(1),
    })).optional(),
    returnType: z.string().optional(),
  })).optional(),
});

/**
 * Domain schema - defines a domain in the domain model
 */
export const domainSchema = z.object({
  /** Name of the domain */
  name: z.string().min(1, "Domain name is required"),
  
  /** Entities in the domain */
  entities: z.array(domainEntitySchema).min(1, "At least one entity is required"),
  
  /** Optional description of the domain */
  description: z.string().optional(),
});

/**
 * Domain model schema - defines the overall structure of the domain model
 */
export const domainModelSchema = z.object({
  /** Domains in the model */
  domains: z.array(domainSchema).min(1, "At least one domain is required"),
  
  /** Version of the domain model */
  version: z.string().optional().default("1.0.0"),
  
  /** Optional description of the domain model */
  description: z.string().optional(),
});

/**
 * Type for the domain model
 */
export type DomainModel = z.infer<typeof domainModelSchema>;

/**
 * Type for a domain
 */
export type Domain = z.infer<typeof domainSchema>;

/**
 * Type for a domain entity
 */
export type DomainEntity = z.infer<typeof domainEntitySchema>;

/**
 * Type for an attribute
 */
export type Attribute = z.infer<typeof attributeSchema>;
