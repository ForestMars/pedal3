const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const config = {
  artifacts: path.join(__dirname, 'artifacts'),
  dist: path.join(__dirname, 'dist'),
  logs: path.join(__dirname, 'logs')
};

// Create directories if they don't exist
for (const dir of [config.artifacts, config.dist, config.logs]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Logger
const logger = {
  info: (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] INFO: ${message}\n`;
    fs.appendFileSync(path.join(config.logs, 'pedal.log'), logMessage);
    console.log(logMessage);
  },
  error: (message, error) => {
    const timestamp = new Date().toISOString();
    const errorDetail = error ? `\n${JSON.stringify(error, null, 2)}` : '';
    const logMessage = `[${timestamp}] ERROR: ${message}${errorDetail}\n`;
    fs.appendFileSync(path.join(config.logs, 'pedal.log'), logMessage);
    console.error(logMessage);
  }
};

// Pipeline Operators
const operators = {
  // Requirements Ingest Operator
  requirementsIngest: async (inputPath, outputPath) => {
    logger.info(`Running Requirements Ingest: ${inputPath} -> ${outputPath}`);
    
    try {
      const yamlContent = fs.readFileSync(inputPath, 'utf-8');
      // In a real implementation, this would parse YAML
      const requirements = JSON.parse(yamlContent);
      
      // Write validated requirements to output
      fs.writeFileSync(outputPath, JSON.stringify(requirements, null, 2));
      logger.info('Requirements validated and saved');
    } catch (error) {
      logger.error('Requirements ingest failed', error);
      throw error;
    }
  },
  
  // Domain Model Generator
  domainModelGenerator: async (inputPath, outputPath) => {
    logger.info(`Running Domain Model Generator: ${inputPath} -> ${outputPath}`);
    
    try {
      const requirementsJson = fs.readFileSync(inputPath, 'utf-8');
      const requirements = JSON.parse(requirementsJson);
      
      // Transform requirements to domain model
      const domainModel = {
        version: requirements.version,
        domains: [
          {
            name: 'Core',
            entities: requirements.entities.map((entity) => ({
              name: entity.name,
              attributes: entity.fields.map((field) => ({
                name: field.name,
                type: field.type,
                required: field.required ?? true,
                description: field.description
              }))
            }))
          }
        ],
        description: requirements.description
      };
      
      // Write domain model to output
      fs.writeFileSync(outputPath, JSON.stringify(domainModel, null, 2));
      logger.info('Domain model generated and saved');
    } catch (error) {
      logger.error('Domain model generation failed', error);
      throw error;
    }
  },
  
  // Action Model Generator
  actionModelGenerator: async (inputPath, outputPath) => {
    logger.info(`Running Action Model Generator: ${inputPath} -> ${outputPath}`);
    
    try {
      const domainModelJson = fs.readFileSync(inputPath, 'utf-8');
      const domainModel = JSON.parse(domainModelJson);
      
      // Generate CRUD actions for each entity
      const actions = [];
      
      for (const domain of domainModel.domains) {
        for (const entity of domain.entities) {
          // Create action
          actions.push({
            name: `create${entity.name}`,
            actor: 'User',
            entity: entity.name,
            type: 'create',
            parameters: entity.attributes.map((attr) => ({
              name: attr.name,
              type: attr.type,
              required: attr.required
            })),
            httpMethod: 'POST',
            path: `/${entity.name.toLowerCase()}`
          });
          
          // Read action
          actions.push({
            name: `get${entity.name}`,
            actor: 'User',
            entity: entity.name,
            type: 'read',
            parameters: [{ name: 'id', type: 'string', required: true }],
            httpMethod: 'GET',
            path: `/${entity.name.toLowerCase()}/{id}`
          });
          
          // Update action
          actions.push({
            name: `update${entity.name}`,
            actor: 'User',
            entity: entity.name,
            type: 'update',
            parameters: [
              { name: 'id', type: 'string', required: true },
              ...entity.attributes.map((attr) => ({
                name: attr.name,
                type: attr.type,
                required: false
              }))
            ],
            httpMethod: 'PUT',
            path: `/${entity.name.toLowerCase()}/{id}`
          });
          
          // Delete action
          actions.push({
            name: `delete${entity.name}`,
            actor: 'User',
            entity: entity.name,
            type: 'delete',
            parameters: [{ name: 'id', type: 'string', required: true }],
            httpMethod: 'DELETE',
            path: `/${entity.name.toLowerCase()}/{id}`
          });
        }
      }
      
      const actionModel = {
        version: domainModel.version,
        actions
      };
      
      // Write action model to output
      fs.writeFileSync(outputPath, JSON.stringify(actionModel, null, 2));
      logger.info('Action model generated and saved');
    } catch (error) {
      logger.error('Action model generation failed', error);
      throw error;
    }
  },
  
  // OpenAPI Generator
  openApiGenerator: async (inputPath, outputPath) => {
    logger.info(`Running OpenAPI Generator: ${inputPath} -> ${outputPath}`);
    
    try {
      const actionModelJson = fs.readFileSync(inputPath, 'utf-8');
      const actionModel = JSON.parse(actionModelJson);
      
      // Generate OpenAPI specification
      const openApi = {
        openapi: '3.0.0',
        info: {
          title: 'Generated API',
          version: actionModel.version,
          description: 'API generated from action model'
        },
        paths: {},
        components: {
          schemas: {}
        }
      };
      
      // Create schemas and paths for each action
      const entities = new Set();
      
      for (const action of actionModel.actions) {
        if (!openApi.paths[action.path]) {
          openApi.paths[action.path] = {};
        }
        
        const entityName = action.entity;
        entities.add(entityName);
        
        // Add operation to path
        openApi.paths[action.path][action.httpMethod.toLowerCase()] = {
          operationId: action.name,
          summary: `${action.type} ${entityName}`,
          parameters: action.parameters
            .filter((param) => action.httpMethod === 'GET' || param.name === 'id')
            .map((param) => ({
              name: param.name,
              in: action.path.includes(`{${param.name}}`) ? 'path' : 'query',
              required: param.required,
              schema: { type: param.type === 'string' ? 'string' : 'number' }
            })),
          responses: {
            '200': {
              description: 'Successful operation',
              content: {
                'application/json': {
                  schema: { $ref: `#/components/schemas/${entityName}` }
                }
              }
            }
          }
        };
        
        // Add request body for POST, PUT
        if (['POST', 'PUT'].includes(action.httpMethod)) {
          openApi.paths[action.path][action.httpMethod.toLowerCase()].requestBody = {
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${entityName}` }
              }
            },
            required: true
          };
        }
        
        // Add schema if not already added
        if (!openApi.components.schemas[entityName]) {
          const entity = actionModel.actions
            .find(a => a.entity === entityName && a.type === 'create');
          
          if (entity) {
            const properties = {};
            
            entity.parameters.forEach(param => {
              properties[param.name] = {
                type: param.type === 'string' ? 'string' : 'number'
              };
            });
            
            openApi.components.schemas[entityName] = {
              type: 'object',
              properties,
              required: entity.parameters
                .filter(param => param.required)
                .map(param => param.name)
            };
          }
        }
      }
      
      // Write OpenAPI spec to output
      fs.writeFileSync(outputPath, JSON.stringify(openApi, null, 2));
      logger.info('OpenAPI specification generated and saved');
    } catch (error) {
      logger.error('OpenAPI generation failed', error);
      throw error;
    }
  },
  
  // Zod Schema Generator
  zodSchemaGenerator: async (inputPath, outputPath) => {
    logger.info(`Running Zod Schema Generator: ${inputPath} -> ${outputPath}`);
    
    try {
      const openApiJson = fs.readFileSync(inputPath, 'utf-8');
      const openApi = JSON.parse(openApiJson);
      
      // Generate Zod schemas
      let zodSchemas = `/**
 * Generated Zod schemas from OpenAPI specification
 */

`;
      
      // Process schemas from OpenAPI components
      for (const [schemaName, schema] of Object.entries(openApi.components.schemas || {})) {
        zodSchemas += `// Schema for ${schemaName}\n`;
        zodSchemas += `export const ${schemaName}Schema = z.lazy(() => z.object({\n`;
        
        // Add properties
        for (const [propName, propSchema] of Object.entries(schema.properties || {})) {
          const required = (schema.required || []).includes(propName);
          const type = propSchema.type;
          
          let zodType = 'z.string()';
          if (type === 'integer' || type === 'number') {
            zodType = 'z.number()';
          } else if (type === 'boolean') {
            zodType = 'z.boolean()';
          } else if (type === 'array') {
            zodType = `z.array(z.string())`;
          } else if (type === 'object') {
            zodType = `z.record(z.string())`;
          }
          
          zodSchemas += `  ${propName}: ${zodType}${required ? '' : '.optional()'},\n`;
        }
        
        zodSchemas += `}));\n\n`;
        
        // Add type definition
        zodSchemas += `export type ${schemaName} = z.infer<typeof ${schemaName}Schema>;\n\n`;
      }
      
      // Write Zod schemas to output
      fs.writeFileSync(outputPath, zodSchemas);
      logger.info('Zod schemas generated and saved');
    } catch (error) {
      logger.error('Zod schema generation failed', error);
      throw error;
    }
  },
  
  // Database Schema Generator
  databaseSchemaGenerator: async (inputPath, outputPath) => {
    logger.info(`Running Database Schema Generator: ${inputPath} -> ${outputPath}`);
    
    try {
      const zodSchemasContent = fs.readFileSync(inputPath, 'utf-8');
      
      // Generate Drizzle schema
      let drizzleSchema = `/**
 * Generated Drizzle schema from Zod schemas
 */

`;
      
      // Extract schema names from Zod file (simplified parser)
      const schemaRegex = /export const (\w+)Schema = z\.lazy\(\)/g;
      let match;
      const matches = [];
      
      while ((match = schemaRegex.exec(zodSchemasContent)) !== null) {
        matches.push(match);
      }
      
      // Generate table definitions
      for (const match of matches) {
        const schemaName = match[1];
        const tableName = schemaName.toLowerCase();
        
        drizzleSchema += `// ${schemaName} table definition\n`;
        drizzleSchema += `export const ${tableName} = pgTable('${tableName}', {\n`;
        drizzleSchema += `  id: uuid('id').primaryKey(),\n`;
        drizzleSchema += `  // Add other fields based on Zod schema\n`;
        drizzleSchema += `  created_at: timestamp('created_at').notNull().defaultNow(),\n`;
        drizzleSchema += `  updated_at: timestamp('updated_at').notNull().defaultNow()\n`;
        drizzleSchema += `});\n\n`;
        
        // Add relations
        drizzleSchema += `// ${schemaName} relations\n`;
        drizzleSchema += `export const ${tableName}Relations = relations(${tableName}, ({ many, one }) => ({\n`;
        drizzleSchema += `  // Add relations here\n`;
        drizzleSchema += `}));\n\n`;
      }
      
      // Write Drizzle schema to output
      fs.writeFileSync(outputPath, drizzleSchema);
      
      // Create a migration SQL file
      const migrationDir = path.dirname(outputPath) + '/migrations';
      if (!fs.existsSync(migrationDir)) {
        fs.mkdirSync(migrationDir, { recursive: true });
      }
      
      const migrationFile = path.join(migrationDir, `migration_${Date.now()}.sql`);
      let sqlMigration = `-- Generated migration from Zod schemas\n\n`;
      
      // Add CREATE TABLE statements
      for (const match of matches) {
        const tableName = match[1].toLowerCase();
        
        sqlMigration += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
        sqlMigration += `  id UUID PRIMARY KEY,\n`;
        sqlMigration += `  created_at TIMESTAMP NOT NULL DEFAULT NOW(),\n`;
        sqlMigration += `  updated_at TIMESTAMP NOT NULL DEFAULT NOW()\n`;
        sqlMigration += `);\n\n`;
      }
      
      // Write SQL migration to file
      fs.writeFileSync(migrationFile, sqlMigration);
      logger.info('Database schema and migration generated and saved');
    } catch (error) {
      logger.error('Database schema generation failed', error);
      throw error;
    }
  },
  
  // Artifact Persist Operator
  artifactPersist: async (inputPath, outputPath) => {
    logger.info(`Running Artifact Persist: ${inputPath} -> ${outputPath}`);
    
    try {
      // Ensure output directory exists
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }
      
      // Check if input directory exists
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input directory not found: ${inputPath}`);
      }
      
      // Collect files from input directory
      const collectFiles = (dir, baseDir, fileList = []) => {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            collectFiles(filePath, baseDir, fileList);
          } else {
            fileList.push(path.relative(baseDir, filePath));
          }
        }
        
        return fileList;
      };
      
      const files = collectFiles(inputPath, inputPath);
      
      // Calculate hash for a file
      const calculateHash = (filePath) => {
        const content = fs.readFileSync(filePath);
        return crypto.createHash('sha256').update(content).digest('hex');
      };
      
      // Create manifest
      const manifest = {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        files: []
      };
      
      // Copy files to output directory and add to manifest
      for (const file of files) {
        const srcPath = path.join(inputPath, file);
        const destPath = path.join(outputPath, file);
        
        // Create destination directory if it doesn't exist
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        
        // Copy file
        fs.copyFileSync(srcPath, destPath);
        
        // Add to manifest
        manifest.files.push({
          name: path.basename(file),
          path: file,
          size: fs.statSync(srcPath).size,
          hash: calculateHash(srcPath)
        });
      }
      
      // Write manifest to output directory
      fs.writeFileSync(path.join(outputPath, 'manifest.json'), JSON.stringify(manifest, null, 2));
      logger.info('Artifacts persisted with manifest');
    } catch (error) {
      logger.error('Artifact persist failed', error);
      throw error;
    }
  }
};

// Pipeline stages
const stages = [
  {
    name: 'requirements_ingest',
    operator: operators.requirementsIngest,
    input: path.join(config.artifacts, 'requirements.yaml'),
    output: path.join(config.artifacts, 'requirements.json'),
    requires_approval: false
  },
  {
    name: 'domain_model_generator',
    operator: operators.domainModelGenerator,
    input: path.join(config.artifacts, 'requirements.json'),
    output: path.join(config.artifacts, 'domain_model.json'),
    requires_approval: true
  },
  {
    name: 'action_model_generator',
    operator: operators.actionModelGenerator,
    input: path.join(config.artifacts, 'domain_model.json'),
    output: path.join(config.artifacts, 'action_model.json'),
    requires_approval: true
  },
  {
    name: 'openapi_generator',
    operator: operators.openApiGenerator,
    input: path.join(config.artifacts, 'action_model.json'),
    output: path.join(config.artifacts, 'oas.json'),
    requires_approval: true
  },
  {
    name: 'zod_schema_generator',
    operator: operators.zodSchemaGenerator,
    input: path.join(config.artifacts, 'oas.json'),
    output: path.join(config.artifacts, 'zod_schemas.ts'),
    requires_approval: true
  },
  {
    name: 'database_schema_generator',
    operator: operators.databaseSchemaGenerator,
    input: path.join(config.artifacts, 'zod_schemas.ts'),
    output: path.join(config.artifacts, 'db_schema.ts'),
    requires_approval: true
  },
  {
    name: 'artifact_persist',
    operator: operators.artifactPersist,
    input: path.join(config.artifacts),
    output: path.join(config.dist),
    requires_approval: true
  }
];

// Set up sample data for testing
const setupSampleData = () => {
  const sampleRequirements = {
    version: '1.0.0',
    entities: [
      {
        name: 'User',
        fields: [
          { name: 'id', type: 'string', required: true, description: 'Unique identifier' },
          { name: 'username', type: 'string', required: true, description: 'User name' },
          { name: 'email', type: 'string', required: true, description: 'Email address' },
          { name: 'age', type: 'number', required: false, description: 'Age in years' }
        ]
      },
      {
        name: 'Product',
        fields: [
          { name: 'id', type: 'string', required: true, description: 'Unique identifier' },
          { name: 'name', type: 'string', required: true, description: 'Product name' },
          { name: 'price', type: 'number', required: true, description: 'Product price' },
          { name: 'description', type: 'string', required: false, description: 'Product description' }
        ]
      }
    ],
    description: 'Sample e-commerce system'
  };
  
  // Write requirements to YAML file
  fs.writeFileSync(
    path.join(config.artifacts, 'requirements.yaml'),
    JSON.stringify(sampleRequirements, null, 2)
  );
  logger.info('Sample requirements created');
};

// Run the sample pipeline
const runPipeline = async () => {
  // Setup sample data
  setupSampleData();
  
  // Run each stage sequentially
  for (const stage of stages) {
    logger.info(`Starting stage: ${stage.name}`);
    try {
      await stage.operator(stage.input, stage.output);
      logger.info(`Completed stage: ${stage.name}`);
    } catch (error) {
      logger.error(`Failed stage: ${stage.name}`, error);
      process.exit(1);
    }
  }
  
  logger.info('Pipeline completed successfully');
};

// Export for use in other modules
module.exports = {
  runPipeline,
  stages,
  operators,
  config
};