# Workflow Engine Documentation

## Overview

The workflow engine enables visual automation by connecting nodes in a directed graph. Each node performs an action, and edges define the flow between nodes.

## Concepts

### Workflow

A workflow is a complete automation definition containing:
- **Nodes**: Individual steps or actions
- **Edges**: Connections between nodes
- **Triggers**: Events that start execution
- **Variables**: Dynamic values passed between nodes

### Node Types

| Type | Description | Use Case |
|------|-------------|----------|
| `trigger` | Starts workflow | Schedule, webhook, manual |
| `action` | Performs operation | API call, database write |
| `condition` | Branches flow | If/else logic |
| `ai_agent` | AI processing | Content generation, analysis |
| `webhook` | HTTP requests | External API calls |
| `delay` | Pauses execution | Waiting periods |
| `transform` | Data manipulation | Map, filter, merge |

### Execution States

- `pending`: Queued for execution
- `running`: Currently executing
- `completed`: Finished successfully
- `failed`: Encountered an error
- `cancelled`: Manually stopped

## Workflow Definition

```json
{
  "id": "wf_abc123",
  "name": "Customer Onboarding",
  "nodes": [
    {
      "id": "node_1",
      "type": "trigger",
      "config": { "event": "user.created" }
    },
    {
      "id": "node_2",
      "type": "action",
      "config": { "action": "send_welcome_email" }
    },
    {
      "id": "node_3",
      "type": "condition",
      "config": { "field": "{{user.plan}}", "operator": "equals", "value": "pro" }
    },
    {
      "id": "node_4",
      "type": "ai_agent",
      "config": { "prompt": "Generate onboarding checklist for {{user.name}}" }
    }
  ],
  "edges": [
    { "source": "node_1", "target": "node_2" },
    { "source": "node_2", "target": "node_3" },
    { "source": "node_3", "target": "node_4", "condition": "true" }
  ]
}
```

## Execution Flow

1. **Trigger**: Workflow receives a trigger event
2. **Queue**: Execution job added to BullMQ
3. **Worker**: Picks up job and starts processing
4. **Topological Sort**: Nodes ordered by dependencies
5. **Execute**: Each node runs in order
6. **State Tracking**: Progress saved to database
7. **Completion**: Final status recorded

## Variables

Variables are passed between nodes using template syntax:

```
{{node_1.output.email}}
{{trigger.input.userId}}
{{env.API_KEY}}
```

### Built-in Variables

- `{{trigger.input.*}}` - Trigger payload
- `{{node_*.output.*}}` - Previous node outputs
- `{{env.*}}` - Environment variables
- `{{now}}` - Current timestamp
- `{{uuid}}` - Unique identifier

## Error Handling

- Each node has configurable retry logic
- Failed nodes can trigger error handlers
- Workflows support timeout limits
- Execution logs record all errors

## Creating Workflows

### Via API

```bash
curl -X POST http://localhost:3000/api/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Workflow",
    "nodes": [...],
    "edges": [...]
  }'
```

### Via Dashboard

1. Navigate to Workflows
2. Click "Create Workflow"
3. Use visual editor to add nodes
4. Connect nodes with edges
5. Configure each node
6. Save and activate

## Best Practices

- Keep workflows focused on single tasks
- Use conditions for branching logic
- Add error handlers for critical paths
- Test with small data before production
- Monitor execution logs regularly
