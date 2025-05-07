const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 5000;

// Configuration for our artifacts
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

// Set up middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Pipeline stages
const stages = [
  {
    name: 'requirements_ingest',
    description: 'Parses and validates requirements YAML against schema definition.',
    input: path.join(config.artifacts, 'requirements.yaml'),
    output: path.join(config.artifacts, 'requirements.json'),
    requires_approval: false
  },
  {
    name: 'domain_model_generator',
    description: 'Creates structured domain model from requirements.',
    input: path.join(config.artifacts, 'requirements.json'),
    output: path.join(config.artifacts, 'domain_model.json'),
    requires_approval: true
  },
  {
    name: 'action_model_generator',
    description: 'Defines domain actions as CRUD operations on entities.',
    input: path.join(config.artifacts, 'domain_model.json'),
    output: path.join(config.artifacts, 'action_model.json'),
    requires_approval: true
  },
  {
    name: 'openapi_generator',
    description: 'Generates OpenAPI specification from action model.',
    input: path.join(config.artifacts, 'action_model.json'),
    output: path.join(config.artifacts, 'oas.json'),
    requires_approval: true
  },
  {
    name: 'zod_schema_generator',
    description: 'Creates Zod validators from OpenAPI specification.',
    input: path.join(config.artifacts, 'oas.json'),
    output: path.join(config.artifacts, 'zod_schemas.ts'),
    requires_approval: true
  },
  {
    name: 'database_schema_generator',
    description: 'Generates Drizzle ORM schema from Zod validators.',
    input: path.join(config.artifacts, 'zod_schemas.ts'),
    output: path.join(config.artifacts, 'db_schema.ts'),
    requires_approval: true
  },
  {
    name: 'artifact_persist',
    description: 'Packages all artifacts with manifest for distribution.',
    input: path.join(config.artifacts),
    output: path.join(config.dist),
    requires_approval: true
  }
];

// Stage status tracking
const stageStatus = new Map(stages.map(stage => [stage.name, fs.existsSync(stage.output) ? 'completed' : 'pending']));
const approvalStatus = new Map(stages.map(stage => [stage.name, !stage.requires_approval]));

// Create sample data
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
  
  // Write requirements to YAML file (for demo purposes, just using JSON)
  if (!fs.existsSync(stages[0].input)) {
    fs.writeFileSync(
      stages[0].input,
      JSON.stringify(sampleRequirements, null, 2)
    );
    console.log('Sample requirements created');
  }
};

// Setup sample data
setupSampleData();

// Simulated pipeline operators
const operators = {
  // Requirements Ingest Operator
  requirements_ingest: async (inputPath, outputPath) => {
    console.log(`Running Requirements Ingest: ${inputPath} -> ${outputPath}`);
    
    try {
      const content = fs.readFileSync(inputPath, 'utf-8');
      const requirements = JSON.parse(content);
      
      // Add a timestamp for demo purposes
      requirements.processedAt = new Date().toISOString();
      
      // Write to output
      fs.writeFileSync(outputPath, JSON.stringify(requirements, null, 2));
      console.log('Requirements validated and saved');
      return true;
    } catch (error) {
      console.error('Requirements ingest failed', error);
      throw error;
    }
  },
  
  // Domain Model Generator
  domain_model_generator: async (inputPath, outputPath) => {
    console.log(`Running Domain Model Generator: ${inputPath} -> ${outputPath}`);
    
    try {
      const requirementsJson = fs.readFileSync(inputPath, 'utf-8');
      const requirements = JSON.parse(requirementsJson);
      
      // Transform requirements to domain model
      const domainModel = {
        version: requirements.version,
        processedAt: new Date().toISOString(),
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
      console.log('Domain model generated and saved');
      return true;
    } catch (error) {
      console.error('Domain model generation failed', error);
      throw error;
    }
  },
  
  // Action Model Generator
  action_model_generator: async (inputPath, outputPath) => {
    console.log(`Running Action Model Generator: ${inputPath} -> ${outputPath}`);
    
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
          
          // Other CRUD actions would follow
          actions.push({
            name: `get${entity.name}`,
            actor: 'User',
            entity: entity.name,
            type: 'read',
            httpMethod: 'GET',
            path: `/${entity.name.toLowerCase()}/{id}`
          });
        }
      }
      
      const actionModel = {
        version: domainModel.version,
        processedAt: new Date().toISOString(),
        actions
      };
      
      // Write action model to output
      fs.writeFileSync(outputPath, JSON.stringify(actionModel, null, 2));
      console.log('Action model generated and saved');
      return true;
    } catch (error) {
      console.error('Action model generation failed', error);
      throw error;
    }
  },
  
  // OpenAPI Generator
  openapi_generator: async (inputPath, outputPath) => {
    console.log(`Running OpenAPI Generator: ${inputPath} -> ${outputPath}`);
    
    try {
      const actionModelJson = fs.readFileSync(inputPath, 'utf-8');
      const actionModel = JSON.parse(actionModelJson);
      
      // Generate simple OpenAPI spec
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
      
      // Add paths and schemas based on actions
      actionModel.actions.forEach(action => {
        if (!openApi.paths[action.path]) {
          openApi.paths[action.path] = {};
        }
        
        openApi.paths[action.path][action.httpMethod.toLowerCase()] = {
          operationId: action.name,
          summary: `${action.type} ${action.entity}`
        };
      });
      
      // Write to output
      fs.writeFileSync(outputPath, JSON.stringify(openApi, null, 2));
      console.log('OpenAPI specification generated and saved');
      return true;
    } catch (error) {
      console.error('OpenAPI generation failed', error);
      throw error;
    }
  },
  
  // Zod Schema Generator
  zod_schema_generator: async (inputPath, outputPath) => {
    console.log(`Running Zod Schema Generator: ${inputPath} -> ${outputPath}`);
    
    try {
      const openApiJson = fs.readFileSync(inputPath, 'utf-8');
      const openApi = JSON.parse(openApiJson);
      
      // Generate a simple Zod schema
      let zodSchemas = `/**
 * Generated Zod schemas from OpenAPI specification
 */

// Generated at: ${new Date().toISOString()}
// OpenAPI version: ${openApi.info.version}

import { z } from 'zod';

`;
      
      // Just add a simple User schema for demo
      zodSchemas += `export const UserSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().min(0).optional()
});

export type User = z.infer<typeof UserSchema>;
`;
      
      // Write to output
      fs.writeFileSync(outputPath, zodSchemas);
      console.log('Zod schemas generated and saved');
      return true;
    } catch (error) {
      console.error('Zod schema generation failed', error);
      throw error;
    }
  },
  
  // Database Schema Generator
  database_schema_generator: async (inputPath, outputPath) => {
    console.log(`Running Database Schema Generator: ${inputPath} -> ${outputPath}`);
    
    try {
      const zodSchemasContent = fs.readFileSync(inputPath, 'utf-8');
      
      // Generate a simple Drizzle schema
      let drizzleSchema = `/**
 * Generated Drizzle schema from Zod schemas
 */
import { pgTable, serial, uuid, varchar, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Generated at: ${new Date().toISOString()}

// User table definition
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  username: varchar('username', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  age: integer('age'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow()
});

// User relations
export const usersRelations = relations(users, ({ many }) => ({
  products: many(products)
}));

// Product table definition
export const products = pgTable('products', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  price: integer('price').notNull(),
  description: varchar('description', { length: 1000 }),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow()
});

// Product relations
export const productsRelations = relations(products, ({ many }) => ({
  users: many(users)
}));
`;
      
      // Write to output
      fs.writeFileSync(outputPath, drizzleSchema);
      
      // Create migrations directory
      const migrationDir = path.join(path.dirname(outputPath), 'migrations');
      if (!fs.existsSync(migrationDir)) {
        fs.mkdirSync(migrationDir, { recursive: true });
      }
      
      // Create a simple migration file
      const migrationFile = path.join(migrationDir, `migration_${Date.now()}.sql`);
      let sqlMigration = `-- Generated migration from Zod schemas
-- Generated at: ${new Date().toISOString()}

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  age INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price INTEGER NOT NULL,
  description VARCHAR(1000),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
`;
      
      fs.writeFileSync(migrationFile, sqlMigration);
      console.log('Database schema and migration generated and saved');
      return true;
    } catch (error) {
      console.error('Database schema generation failed', error);
      throw error;
    }
  },
  
  // Artifact Persist
  artifact_persist: async (inputPath, outputPath) => {
    console.log(`Running Artifact Persist: ${inputPath} -> ${outputPath}`);
    
    try {
      // Ensure output directory exists
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }
      
      // Function to collect files recursively
      const collectFiles = (dir, baseDir, fileList = []) => {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            // Skip migrations directory as a demo simplification
            if (file !== 'migrations') {
              collectFiles(filePath, baseDir, fileList);
            }
          } else {
            fileList.push(path.relative(baseDir, filePath));
          }
        }
        
        return fileList;
      };
      
      const files = collectFiles(inputPath, inputPath);
      
      // Create manifest
      const manifest = {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        files: []
      };
      
      // Simple hash function
      const calculateHash = (content) => {
        return crypto.createHash('sha256').update(content).digest('hex');
      };
      
      // Copy files and build manifest
      for (const file of files) {
        const srcPath = path.join(inputPath, file);
        const destPath = path.join(outputPath, file);
        
        // Create destination directory if needed
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        
        // Copy file
        const content = fs.readFileSync(srcPath);
        fs.writeFileSync(destPath, content);
        
        // Add to manifest
        manifest.files.push({
          name: path.basename(file),
          path: file,
          size: fs.statSync(srcPath).size,
          hash: calculateHash(content)
        });
      }
      
      // Write manifest
      fs.writeFileSync(path.join(outputPath, 'manifest.json'), JSON.stringify(manifest, null, 2));
      console.log('Artifacts persisted with manifest');
      return true;
    } catch (error) {
      console.error('Artifact persist failed', error);
      throw error;
    }
  }
};

// Routes
app.get('/', (req, res) => {
  // Update stage status based on file existence
  stages.forEach(stage => {
    if (fs.existsSync(stage.output)) {
      stageStatus.set(stage.name, 'completed');
    }
  });

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>PEDAL Dashboard</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        .stage { margin-bottom: 15px; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
        .stage-header { display: flex; justify-content: space-between; align-items: center; }
        .status-pending { color: #f90; }
        .status-running { color: #00f; }
        .status-completed { color: #0a0; }
        .status-failed { color: #e00; }
        .button { 
          background-color: #4CAF50; 
          color: white; 
          padding: 10px 15px; 
          border: none; 
          border-radius: 4px;
          cursor: pointer;
        }
        .button:disabled { background-color: #ddd; cursor: not-allowed; }
        .button-approve { background-color: #4CAF50; }
        .button-run { background-color: #2196F3; }
      </style>
    </head>
    <body>
      <h1>PEDAL Dashboard</h1>
      <p>Pipeline for Enhanced Domain Artifact Logic</p>
      
      <div id="stages">
        ${stages.map(stage => `
          <div class="stage">
            <div class="stage-header">
              <h2>${stage.name.replace(/_/g, ' ').toUpperCase()}</h2>
              <span class="status-${stageStatus.get(stage.name)}">${stageStatus.get(stage.name).toUpperCase()}</span>
            </div>
            <p>${stage.description}</p>
            <p><strong>Input:</strong> ${stage.input}</p>
            <p><strong>Output:</strong> ${stage.output}</p>
            <div>
              ${stage.requires_approval ? 
                `<button class="button button-approve" onclick="approveStage('${stage.name}')" ${approvalStatus.get(stage.name) ? 'disabled' : ''}>
                  ${approvalStatus.get(stage.name) ? 'Approved' : 'Approve'}
                </button>` : ''}
              <button class="button button-run" onclick="runStage('${stage.name}')" 
                ${(stage.name !== 'requirements_ingest' && stageStatus.get(stages[stages.findIndex(s => s.name === stage.name) - 1].name) !== 'completed') || !approvalStatus.get(stage.name) ? 'disabled' : ''}>
                Run Stage
              </button>
            </div>
          </div>
        `).join('')}
      </div>
      
      <div style="margin-top: 20px;">
        <button class="button" onclick="runFullPipeline()" style="background-color: #673AB7;">Run Full Pipeline</button>
      </div>
      
      <script>
        function approveStage(stageName) {
          fetch('/api/stages/' + stageName + '/approve', { method: 'POST' })
            .then(response => response.json())
            .then(() => location.reload())
            .catch(error => console.error('Error:', error));
        }
        
        function runStage(stageName) {
          fetch('/api/stages/' + stageName + '/run', { method: 'POST' })
            .then(response => response.json())
            .then(() => {
              // Poll for completion
              const interval = setInterval(() => {
                fetch('/api/stages/' + stageName)
                  .then(response => response.json())
                  .then(data => {
                    if (data.status !== 'running') {
                      clearInterval(interval);
                      location.reload();
                    }
                  });
              }, 1000);
            })
            .catch(error => console.error('Error:', error));
        }
        
        function runFullPipeline() {
          fetch('/api/pipeline/run', { method: 'POST' })
            .then(response => response.json())
            .then(() => {
              alert('Pipeline is running. This may take a few moments.');
              // Poll for completion
              const interval = setInterval(() => {
                fetch('/api/pipeline/status')
                  .then(response => response.json())
                  .then(data => {
                    if (data.status === 'completed' || data.status === 'failed') {
                      clearInterval(interval);
                      location.reload();
                    }
                  });
              }, 2000);
            })
            .catch(error => console.error('Error:', error));
        }
      </script>
    </body>
    </html>
  `);
});

// API endpoints
app.get('/api/stages', (req, res) => {
  const stagesData = stages.map(stage => ({
    name: stage.name,
    status: stageStatus.get(stage.name),
    requires_approval: stage.requires_approval,
    approved: approvalStatus.get(stage.name)
  }));
  
  res.json(stagesData);
});

app.get('/api/stages/:name', (req, res) => {
  const stageName = req.params.name;
  const stage = stages.find(s => s.name === stageName);
  
  if (!stage) {
    return res.status(404).json({ error: 'Stage not found' });
  }
  
  res.json({
    name: stage.name,
    status: stageStatus.get(stage.name),
    requires_approval: stage.requires_approval,
    approved: approvalStatus.get(stage.name)
  });
});

app.post('/api/stages/:name/approve', (req, res) => {
  const stageName = req.params.name;
  const stage = stages.find(s => s.name === stageName);
  
  if (!stage) {
    return res.status(404).json({ error: 'Stage not found' });
  }
  
  if (!stage.requires_approval) {
    return res.status(400).json({ error: 'Stage does not require approval' });
  }
  
  approvalStatus.set(stageName, true);
  console.log(`Stage ${stageName} approved`);
  
  res.json({ success: true });
});

app.post('/api/stages/:name/run', async (req, res) => {
  const stageName = req.params.name;
  const stage = stages.find(s => s.name === stageName);
  
  if (!stage) {
    return res.status(404).json({ error: 'Stage not found' });
  }
  
  // Check if stage is approved (if required)
  if (stage.requires_approval && !approvalStatus.get(stageName)) {
    return res.status(400).json({ error: 'Stage requires approval' });
  }
  
  // Check if previous stage is completed (except for first stage)
  if (stageName !== 'requirements_ingest') {
    const prevStageIndex = stages.findIndex(s => s.name === stageName) - 1;
    const prevStage = stages[prevStageIndex];
    
    if (stageStatus.get(prevStage.name) !== 'completed') {
      return res.status(400).json({ error: 'Previous stage not completed' });
    }
  }
  
  // Run stage asynchronously
  stageStatus.set(stageName, 'running');
  res.json({ status: 'running' });
  
  try {
    // Call the appropriate operator function
    const operatorFn = operators[stageName];
    if (!operatorFn) {
      throw new Error(`No operator found for stage: ${stageName}`);
    }
    
    await operatorFn(stage.input, stage.output);
    stageStatus.set(stageName, 'completed');
    console.log(`Stage ${stageName} completed`);
  } catch (error) {
    stageStatus.set(stageName, 'failed');
    console.error(`Stage ${stageName} failed`, error);
  }
});

// Pipeline endpoints
app.post('/api/pipeline/run', (req, res) => {
  // Auto-approve all stages
  stages.forEach(stage => {
    approvalStatus.set(stage.name, true);
  });
  
  // Start pipeline in background
  res.json({ status: 'running' });
  
  // Run each stage sequentially
  (async () => {
    try {
      for (const stage of stages) {
        console.log(`Starting stage: ${stage.name}`);
        stageStatus.set(stage.name, 'running');
        
        try {
          const operatorFn = operators[stage.name];
          if (!operatorFn) {
            throw new Error(`No operator found for stage: ${stage.name}`);
          }
          
          await operatorFn(stage.input, stage.output);
          stageStatus.set(stage.name, 'completed');
          console.log(`Completed stage: ${stage.name}`);
        } catch (error) {
          stageStatus.set(stage.name, 'failed');
          console.error(`Failed stage: ${stage.name}`, error);
          break;
        }
      }
      console.log('Pipeline execution completed');
    } catch (error) {
      console.error('Pipeline execution failed', error);
    }
  })();
});

app.get('/api/pipeline/status', (req, res) => {
  // Check overall pipeline status
  const allCompleted = stages.every(stage => stageStatus.get(stage.name) === 'completed');
  const anyFailed = stages.some(stage => stageStatus.get(stage.name) === 'failed');
  const anyRunning = stages.some(stage => stageStatus.get(stage.name) === 'running');
  
  let status = 'pending';
  if (allCompleted) {
    status = 'completed';
  } else if (anyFailed) {
    status = 'failed';
  } else if (anyRunning) {
    status = 'running';
  }
  
  res.json({ status });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`PEDAL server running on port ${PORT}`);
});