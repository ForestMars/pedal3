const express = require('express');
const fs = require('fs');
const path = require('path');
const pipeline = require('./pipeline');

const app = express();
const PORT = 5000;

// Stage status tracking
const stageStatus = new Map(pipeline.stages.map(stage => [stage.name, fs.existsSync(stage.output) ? 'completed' : 'pending']));
const approvalStatus = new Map(pipeline.stages.map(stage => [stage.name, !stage.requires_approval]));

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// Get the description for a stage
function getStageDescription(stageName) {
  switch (stageName) {
    case 'requirements_ingest':
      return 'Parses and validates requirements YAML against schema definition.';
    case 'domain_model_generator':
      return 'Creates structured domain model from requirements.';
    case 'action_model_generator':
      return 'Defines domain actions as CRUD operations on entities.';
    case 'openapi_generator':
      return 'Generates OpenAPI specification from action model.';
    case 'zod_schema_generator':
      return 'Creates Zod validators from OpenAPI specification.';
    case 'database_schema_generator':
      return 'Generates Drizzle ORM schema from Zod validators.';
    case 'artifact_persist':
      return 'Packages all artifacts with manifest for distribution.';
    default:
      return '';
  }
}

// Create sample data manually
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
if (!fs.existsSync(pipeline.config.artifacts)) {
  fs.mkdirSync(pipeline.config.artifacts, { recursive: true });
}

// Write sample data to file if it doesn't exist
if (!fs.existsSync(pipeline.stages[0].input)) {
  fs.writeFileSync(
    pipeline.stages[0].input,
    JSON.stringify(sampleRequirements, null, 2)
  );
  console.log('Sample requirements created');
}

app.get('/', (req, res) => {
  // Check for file existence to update stage status
  pipeline.stages.forEach(stage => {
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
        ${pipeline.stages.map(stage => `
          <div class="stage">
            <div class="stage-header">
              <h2>${stage.name.replace(/_/g, ' ').toUpperCase()}</h2>
              <span class="status-${stageStatus.get(stage.name)}">${stageStatus.get(stage.name).toUpperCase()}</span>
            </div>
            <p>${getStageDescription(stage.name)}</p>
            <p><strong>Input:</strong> ${stage.input}</p>
            <p><strong>Output:</strong> ${stage.output}</p>
            <div>
              ${stage.requires_approval ? 
                `<button class="button button-approve" onclick="approveStage('${stage.name}')" ${approvalStatus.get(stage.name) ? 'disabled' : ''}>
                  ${approvalStatus.get(stage.name) ? 'Approved' : 'Approve'}
                </button>` : ''}
              <button class="button button-run" onclick="runStage('${stage.name}')" 
                ${(stage.name !== 'requirements_ingest' && stageStatus.get(pipeline.stages[pipeline.stages.findIndex(s => s.name === stage.name) - 1].name) !== 'completed') || !approvalStatus.get(stage.name) ? 'disabled' : ''}>
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
  const stagesData = pipeline.stages.map(stage => ({
    name: stage.name,
    status: stageStatus.get(stage.name),
    requires_approval: stage.requires_approval,
    approved: approvalStatus.get(stage.name)
  }));
  
  res.json(stagesData);
});

app.get('/api/stages/:name', (req, res) => {
  const stageName = req.params.name;
  const stage = pipeline.stages.find(s => s.name === stageName);
  
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
  const stage = pipeline.stages.find(s => s.name === stageName);
  
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
  const stage = pipeline.stages.find(s => s.name === stageName);
  
  if (!stage) {
    return res.status(404).json({ error: 'Stage not found' });
  }
  
  // Check if stage is approved (if required)
  if (stage.requires_approval && !approvalStatus.get(stageName)) {
    return res.status(400).json({ error: 'Stage requires approval' });
  }
  
  // Check if previous stage is completed (except for first stage)
  if (stageName !== 'requirements_ingest') {
    const prevStageIndex = pipeline.stages.findIndex(s => s.name === stageName) - 1;
    const prevStage = pipeline.stages[prevStageIndex];
    
    if (stageStatus.get(prevStage.name) !== 'completed') {
      return res.status(400).json({ error: 'Previous stage not completed' });
    }
  }
  
  // Run stage asynchronously
  stageStatus.set(stageName, 'running');
  res.json({ status: 'running' });
  
  try {
    await stage.operator(stage.input, stage.output);
    stageStatus.set(stageName, 'completed');
    console.log(`Stage ${stageName} completed`);
  } catch (error) {
    stageStatus.set(stageName, 'failed');
    console.error(`Stage ${stageName} failed`, error);
  }
});

// Pipeline endpoints
app.post('/api/pipeline/run', (req, res) => {
  // Approve all stages
  pipeline.stages.forEach(stage => {
    approvalStatus.set(stage.name, true);
  });
  
  // Run pipeline in background
  res.json({ status: 'running' });
  
  // Run each stage sequentially
  (async () => {
    try {
      for (const stage of pipeline.stages) {
        console.log(`Starting stage: ${stage.name}`);
        try {
          await stage.operator(stage.input, stage.output);
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
  const allCompleted = pipeline.stages.every(stage => stageStatus.get(stage.name) === 'completed');
  const anyFailed = pipeline.stages.some(stage => stageStatus.get(stage.name) === 'failed');
  const anyRunning = pipeline.stages.some(stage => stageStatus.get(stage.name) === 'running');
  
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