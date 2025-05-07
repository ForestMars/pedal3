/**
 * Action model schema definition for PEDAL
 * Defines the structure and validation for action_model.json
 */
import { z } from 'zod';

/**
 * Parameter schema - defines a parameter for an action
 */
export const parameterSchema = z.object({
  /** Name of the parameter */
  name: z.string().min(1, "Parameter name is required"),
  
  /** Type of the parameter */
  type: z.string().min(1, "Parameter type is required"),
  
  /** Whether the parameter is required */
  required: z.boolean().optional().default(true),
  
  /** Optional description of the parameter */
  description: z.string().optional(),
  
  /** Optional validation rules */
  validation: z.record(z.any()).optional(),
});

/**
 * Precondition schema - defines a precondition for an action
 */
export const preconditionSchema = z.object({
  /** Description of the precondition */
  description: z.string().min(1, "Precondition description is required"),
  
  /** Optional code representation of the precondition */
  code: z.string().optional(),
});

/**
 * Postcondition schema - defines a postcondition (result) of an action
 */
export const postconditionSchema = z.object({
  /** Description of the postcondition */
  description: z.string().min(1, "Postcondition description is required"),
  
  /** Optional code representation of the postcondition */
  code: z.string().optional(),
});

/**
 * Action schema - defines an action in the action model
 */
export const actionSchema = z.object({
  /** Name of the action */
  name: z.string().min(1, "Action name is required"),
  
  /** Actor who performs the action */
  actor: z.string().min(1, "Actor is required"),
  
  /** Domain entity this action operates on */
  entity: z.string().min(1, "Entity is required"),
  
  /** Type of the action (e.g., create, read, update, delete) */
  type: z.enum(["create", "read", "update", "delete", "custom"]),
  
  /** Parameters for the action */
  parameters: z.array(parameterSchema).optional().default([]),
  
  /** Preconditions for the action */
  preconditions: z.array(preconditionSchema).optional().default([]),
  
  /** Postconditions (results) of the action */
  postconditions: z.array(postconditionSchema).optional().default([]),
  
  /** Optional description of the action */
  description: z.string().optional(),
  
  /** HTTP method for the action (for API generation) */
  httpMethod: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional(),
  
  /** HTTP path for the action (for API generation) */
  httpPath: z.string().optional(),
});

/**
 * Action model schema - defines the overall structure of the action model
 */
export const actionModelSchema = z.object({
  /** Actions in the model */
  actions: z.array(actionSchema).min(1, "At least one action is required"),
  
  /** Version of the action model */
  version: z.string().optional().default("1.0.0"),
  
  /** Optional description of the action model */
  description: z.string().optional(),
});

/**
 * Type for the action model
 */
export type ActionModel = z.infer<typeof actionModelSchema>;

/**
 * Type for an action
 */
export type Action = z.infer<typeof actionSchema>;

/**
 * Type for a parameter
 */
export type Parameter = z.infer<typeof parameterSchema>;

/**
 * Type for a precondition
 */
export type Precondition = z.infer<typeof preconditionSchema>;

/**
 * Type for a postcondition
 */
export type Postcondition = z.infer<typeof postconditionSchema>;
