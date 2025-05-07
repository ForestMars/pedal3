# PEDAL - Pipeline for Enhanced Domain Artifact Logic

A production-ready application that automates a multi-stage artifact generation pipeline for domain-driven design workflows.

## Pipeline Stages

1. **Requirements Ingest**: Parses and validates requirements YAML against schema definition
2. **Domain Model Generator**: Creates structured domain model from requirements
3. **Action Model Generator**: Defines domain actions as CRUD operations on entities
4. **OpenAPI Generator**: Generates OpenAPI specification from action model
5. **Zod Schema Generator**: Creates Zod validators from OpenAPI specification
6. **Database Schema Generator**: Generates Drizzle ORM schema from Zod validators
7. **Artifact Persist**: Packages all artifacts with manifest for distribution

## Project Structure

```
.
├── app.js                     # Main web app implementation
├── index.js                   # Simple server implementation
├── package.json               # Project dependencies
├── pedal/                     # Main PEDAL application
│   ├── config/                # Configuration files
│   ├── operators/             # Pipeline stage operators
│   │   ├── requirements_ingest.ts
│   │   ├── domain_model_generator.ts
│   │   ├── action_model_generator.ts
│   │   ├── openapi_generator.ts
│   │   ├── zod_schema_generator.ts
│   │   ├── database_schema_generator.ts
│   │   └── artifact_persist.ts
│   ├── types/                 # TypeScript type definitions
│   ├── utils/                 # Utility functions
│   ├── tests/                 # Test cases
│   ├── server.js              # Pipeline server
│   └── pipeline.js            # Pipeline orchestration
└── server/                    # Server configurations
    └── db.ts                  # Database connection
```

## Running Locally

1. Make sure you have Node.js installed
2. Run `npm install` to install dependencies
3. Set up a PostgreSQL database and update connection details
4. Run with `node app.js` or `node index.js`