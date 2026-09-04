# API Documentation

## Base URL

```
http://localhost:3000/api
```

## Authentication

All protected routes require a valid session cookie from NextAuth.js.

## Endpoints

### Health & Metrics

#### GET /api/health

Returns system health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "0.1.0",
  "uptime": 3600,
  "checks": {
    "database": { "status": "up", "latencyMs": 2 },
    "redis": { "status": "up", "latencyMs": 1 },
    "memory": { "status": "up", "heapUsed": 50000000 },
    "disk": { "status": "up" }
  }
}
```

#### GET /api/metrics

Returns Prometheus-format metrics.

### Workflows

#### GET /api/workflows

List all workflows.

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `status` (string): Filter by status

#### POST /api/workflows

Create a new workflow.

**Body:**
```json
{
  "name": "My Workflow",
  "description": "Workflow description",
  "nodes": [],
  "edges": []
}
```

#### GET /api/workflows/[id]

Get workflow by ID.

#### PUT /api/workflows/[id]

Update workflow.

#### DELETE /api/workflows/[id]

Delete workflow.

#### POST /api/workflows/[id]/execute

Execute a workflow.

**Body:**
```json
{
  "input": { "key": "value" }
}
```

#### POST /api/workflows/[id]/duplicate

Duplicate a workflow.

#### GET /api/workflows/[id]/versions

List workflow versions.

### Executions

#### GET /api/executions

List executions.

**Query Parameters:**
- `workflowId` (string): Filter by workflow
- `status` (string): Filter by status
- `page` (number): Page number
- `limit` (number): Items per page

#### GET /api/executions/[id]

Get execution details.

#### GET /api/executions/[id]/logs

Get execution logs.

### AI

#### POST /api/ai/chat

Send chat message to AI agent.

**Body:**
```json
{
  "message": "Hello",
  "agentId": "agent-123",
  "context": {}
}
```

#### GET /api/ai/agents

List available AI agents.

#### POST /api/ai/prompts

Manage prompt templates.

### Integrations

#### GET /api/integrations

List integrations.

#### POST /api/integrations

Create integration.

#### GET /api/integrations/[id]

Get integration details.

#### PUT /api/integrations/[id]/config

Update integration configuration.

#### POST /api/integrations/[id]/test

Test integration connection.

### Webhooks

#### GET /api/webhooks

List webhooks.

#### POST /api/webhooks

Create webhook.

#### POST /api/webhooks/[id]/trigger

Manually trigger webhook.

### Data

#### GET /api/data/schemas

List data schemas.

#### POST /api/data/schemas

Create data schema.

#### GET /api/data/sources

List data sources.

#### POST /api/data/sources

Create data source.

#### GET /api/data/records

List data records.

#### POST /api/data/records

Create data record.

### Organizations

#### GET /api/orgs

List organizations.

#### POST /api/orgs

Create organization.

#### GET /api/orgs/[id]

Get organization details.

#### GET /api/orgs/[id]/members

List organization members.

### Dashboard

#### GET /api/dashboard/stats

Get dashboard statistics.

#### GET /api/dashboard/activity

Get recent activity.
