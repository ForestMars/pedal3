const express = require('express');

const app = express();
const PORT = 5000;

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>PEDAL Dashboard</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        .stage { margin-bottom: 15px; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
      </style>
    </head>
    <body>
      <h1>PEDAL Dashboard</h1>
      <p>Pipeline for Enhanced Domain Artifact Logic</p>
      
      <div class="stage">
        <h2>Requirements Ingest</h2>
        <p>Parses and validates requirements YAML against schema definition.</p>
      </div>
      
      <div class="stage">
        <h2>Domain Model Generator</h2>
        <p>Creates structured domain model from requirements.</p>
      </div>
      
      <div class="stage">
        <h2>Action Model Generator</h2>
        <p>Defines domain actions as CRUD operations on entities.</p>
      </div>
      
      <div class="stage">
        <h2>OpenAPI Generator</h2>
        <p>Generates OpenAPI specification from action model.</p>
      </div>
      
      <div class="stage">
        <h2>Zod Schema Generator</h2>
        <p>Creates Zod validators from OpenAPI specification.</p>
      </div>
      
      <div class="stage">
        <h2>Database Schema Generator</h2>
        <p>Generates Drizzle ORM schema from Zod validators.</p>
      </div>
      
      <div class="stage">
        <h2>Artifact Persist</h2>
        <p>Packages all artifacts with manifest for distribution.</p>
      </div>
    </body>
    </html>
  `);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`PEDAL server running on port ${PORT}`);
});