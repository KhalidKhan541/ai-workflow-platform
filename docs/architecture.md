# Architecture

## Overview

AI Workflow Platform is a Next.js 14 application using the App Router, with PostgreSQL for persistence and Redis for caching and job queues.

## Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── ai/           # AI agent endpoints
│   │   ├── auth/         # Authentication
│   │   ├── workflows/    # Workflow CRUD
│   │   ├── executions/   # Execution management
│   │   ├── health/       # Health checks
│   │   └── metrics/      # Prometheus metrics
│   └── layout.tsx        # Root layout
├── lib/                    # Shared utilities
│   ├── prisma.ts          # Prisma client
│   ├── monitoring.ts      # Monitoring service
│   ├── ai/                # AI integrations
│   ├── integrations/      # External service connectors
│   └── workflow/          # Workflow engine
├── types/                  # TypeScript types
└── middleware/             # Next.js middleware
```

## Data Flow

1. **Request** arrives at Nginx
2. Nginx applies rate limiting, caching, security headers
3. Request forwarded to Next.js API route
4. Route handler validates input with Zod
5. Prisma executes database queries
6. Response returned as JSON

## Workflow Engine

The workflow engine processes workflows as directed acyclic graphs (DAGs):

1. **Parse** workflow definition from database
2. **Validate** node connections and dependencies
3. **Execute** nodes in topological order
4. **Track** execution state and logs
5. **Handle** errors and retries

### Node Types

- **Trigger**: Starts workflow execution
- **Action**: Executes an operation
- **Condition**: Branches based on logic
- **AI Agent**: Calls OpenAI for processing
- **Webhook**: Makes HTTP requests
- **Delay**: Pauses execution

## Authentication

NextAuth.js handles authentication with:
- Email/password credentials
- Session management
- Organization-based access control

## Database Schema

Key entities:
- **User**: Authenticated users
- **Organization**: Multi-tenant groups
- **Workflow**: Automation definitions
- **WorkflowNode**: Individual workflow steps
- **Execution**: Workflow run records
- **ExecutionLog**: Step-by-step execution logs
- **Integration**: External service connections

## Caching Strategy

- **Redis**: Session store, workflow execution locks, BullMQ job queues
- **Next.js**: Static page generation, ISR for dashboards
- **CDN**: Static assets (via Nginx)

## Monitoring

- `/api/health`: System health with database, Redis, memory, disk checks
- `/api/metrics`: Prometheus-compatible metrics endpoint
- Structured logging via monitoring service
