/**
 * OpenAPI schema definition for PEDAL
 * Provides types and validation for OpenAPI v3.0.0 specification
 */
import { z } from 'zod';

/**
 * OpenAPI Info Object schema
 */
export const infoSchema = z.object({
  title: z.string().min(1, "Title is required"),
  version: z.string().min(1, "Version is required"),
  description: z.string().optional(),
  termsOfService: z.string().optional(),
  contact: z.object({
    name: z.string().optional(),
    url: z.string().optional(),
    email: z.string().optional(),
  }).optional(),
  license: z.object({
    name: z.string(),
    url: z.string().optional(),
  }).optional(),
});

/**
 * OpenAPI Server Object schema
 */
export const serverSchema = z.object({
  url: z.string().min(1, "URL is required"),
  description: z.string().optional(),
  variables: z.record(z.object({
    enum: z.array(z.string()).optional(),
    default: z.string(),
    description: z.string().optional(),
  })).optional(),
});

/**
 * OpenAPI Parameter Object schema
 */
export const parameterSchema = z.object({
  name: z.string().min(1, "Name is required"),
  in: z.enum(["query", "header", "path", "cookie"]),
  description: z.string().optional(),
  required: z.boolean().optional().default(false),
  deprecated: z.boolean().optional().default(false),
  allowEmptyValue: z.boolean().optional().default(false),
  schema: z.record(z.any()).optional(),
});

/**
 * OpenAPI RequestBody Object schema
 */
export const requestBodySchema = z.object({
  description: z.string().optional(),
  content: z.record(z.object({
    schema: z.record(z.any()),
    examples: z.record(z.object({
      value: z.any(),
      summary: z.string().optional(),
      description: z.string().optional(),
    })).optional(),
  })),
  required: z.boolean().optional().default(false),
});

/**
 * OpenAPI Response Object schema
 */
export const responseSchema = z.object({
  description: z.string(),
  content: z.record(z.object({
    schema: z.record(z.any()),
    examples: z.record(z.object({
      value: z.any(),
      summary: z.string().optional(),
      description: z.string().optional(),
    })).optional(),
  })).optional(),
  headers: z.record(z.any()).optional(),
});

/**
 * OpenAPI Operation Object schema
 */
export const operationSchema = z.object({
  tags: z.array(z.string()).optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  externalDocs: z.object({
    url: z.string(),
    description: z.string().optional(),
  }).optional(),
  operationId: z.string().min(1, "operationId is required"),
  parameters: z.array(parameterSchema).optional(),
  requestBody: requestBodySchema.optional(),
  responses: z.record(responseSchema),
  deprecated: z.boolean().optional().default(false),
  security: z.array(z.record(z.array(z.string()))).optional(),
});

/**
 * OpenAPI Path Item Object schema
 */
export const pathItemSchema = z.object({
  summary: z.string().optional(),
  description: z.string().optional(),
  get: operationSchema.optional(),
  put: operationSchema.optional(),
  post: operationSchema.optional(),
  delete: operationSchema.optional(),
  options: operationSchema.optional(),
  head: operationSchema.optional(),
  patch: operationSchema.optional(),
  parameters: z.array(parameterSchema).optional(),
});

/**
 * OpenAPI Components Object schema
 */
export const componentsSchema = z.object({
  schemas: z.record(z.any()).optional(),
  responses: z.record(responseSchema).optional(),
  parameters: z.record(parameterSchema).optional(),
  requestBodies: z.record(requestBodySchema).optional(),
  securitySchemes: z.record(z.object({
    type: z.enum(["apiKey", "http", "oauth2", "openIdConnect"]),
    description: z.string().optional(),
    name: z.string().optional(),
    in: z.enum(["query", "header", "cookie"]).optional(),
    scheme: z.string().optional(),
    bearerFormat: z.string().optional(),
    flows: z.any().optional(),
    openIdConnectUrl: z.string().optional(),
  })).optional(),
});

/**
 * OpenAPI Document schema
 */
export const openApiSchema = z.object({
  openapi: z.string().min(1, "openapi version is required").refine(
    (val) => val.startsWith("3.0"),
    "OpenAPI version must be 3.0.x"
  ),
  info: infoSchema,
  servers: z.array(serverSchema).optional(),
  paths: z.record(pathItemSchema),
  components: componentsSchema.optional(),
  security: z.array(z.record(z.array(z.string()))).optional(),
  tags: z.array(z.object({
    name: z.string().min(1, "Tag name is required"),
    description: z.string().optional(),
    externalDocs: z.object({
      url: z.string(),
      description: z.string().optional(),
    }).optional(),
  })).optional(),
  externalDocs: z.object({
    url: z.string(),
    description: z.string().optional(),
  }).optional(),
});

/**
 * Type for the OpenAPI Document
 */
export type OpenAPI = z.infer<typeof openApiSchema>;

/**
 * Type for the OpenAPI Info Object
 */
export type Info = z.infer<typeof infoSchema>;

/**
 * Type for the OpenAPI Path Item Object
 */
export type PathItem = z.infer<typeof pathItemSchema>;

/**
 * Type for the OpenAPI Operation Object
 */
export type Operation = z.infer<typeof operationSchema>;
