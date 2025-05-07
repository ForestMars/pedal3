const express = require('express');
const app = express();
const PORT = 5000;

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>PEDAL - Pipeline for Enhanced Domain Artifact Logic</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          h1 { color: #2c3e50; }
          h2 { color: #3498db; }
          .stage {
            border: 1px solid #ddd;
            border-radius: 5px;
            padding: 15px;
            margin-bottom: 20px;
            background-color: #f9f9f9;
          }
          .complete { border-left: 5px solid #2ecc71; }
          .pending { border-left: 5px solid #f39c12; }
          .button {
            display: inline-block;
            background-color: #3498db;
            color: white;
            padding: 8px 16px;
            text-decoration: none;
            border-radius: 4px;
            margin-top: 10px;
          }
          .approve { background-color: #2ecc71; }
        </style>
      </head>
      <body>
        <h1>PEDAL - Pipeline for Enhanced Domain Artifact Logic</h1>
        <p>An Apache Airflow application that automates a multi-stage artifact generation pipeline for domain-driven design workflows.</p>
        
        <div class="stage complete">
          <h2>1. Requirements Ingest</h2>
          <p>Parses and validates requirements YAML against schema definition.</p>
          <a href="#" class="button">Run</a>
        </div>
        
        <div class="stage pending">
          <h2>2. Domain Model Generator</h2>
          <p>Creates structured domain model from requirements.</p>
          <a href="#" class="button approve">Approve</a>
          <a href="#" class="button">Run</a>
        </div>
        
        <div class="stage pending">
          <h2>3. Action Model Generator</h2>
          <p>Defines domain actions as CRUD operations on entities.</p>
          <a href="#" class="button approve">Approve</a>
          <a href="#" class="button">Run</a>
        </div>
        
        <div class="stage pending">
          <h2>4. OpenAPI Generator</h2>
          <p>Generates OpenAPI specification from action model.</p>
          <a href="#" class="button approve">Approve</a>
          <a href="#" class="button">Run</a>
        </div>
        
        <div class="stage pending">
          <h2>5. Zod Schema Generator</h2>
          <p>Creates Zod validators from OpenAPI specification.</p>
          <a href="#" class="button approve">Approve</a>
          <a href="#" class="button">Run</a>
        </div>
        
        <div class="stage pending">
          <h2>6. Database Schema Generator</h2>
          <p>Generates Drizzle ORM schema from Zod validators.</p>
          <a href="#" class="button approve">Approve</a>
          <a href="#" class="button">Run</a>
        </div>
        
        <div class="stage pending">
          <h2>7. Artifact Persist</h2>
          <p>Packages all artifacts with manifest for distribution.</p>
          <a href="#" class="button approve">Approve</a>
          <a href="#" class="button">Run</a>
        </div>
        
        <a href="#" class="button" style="background-color: #9b59b6;">Run Full Pipeline</a>
        
        <div style="margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
          <h2>Project Description</h2>
          <p>PEDAL is a production-ready Apache Airflow application that automates a multi-stage artifact generation pipeline for domain-driven design workflows.</p>
          <p>The pipeline includes:</p>
          <ul>
            <li>Requirements ingestion and validation</li>
            <li>Domain model generation</li>
            <li>Action model creation</li>
            <li>OpenAPI specification generation</li>
            <li>Zod schema creation</li>
            <li>Database schema generation</li>
            <li>Artifact persistence with manifest</li>
          </ul>
          <p>Each stage includes approval gates and detailed error handling, with a focus on modularity and testability.</p>
        </div>
      </body>
    </html>
  `);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
});