# AI Workflow Platform

An AI-powered enterprise workflow automation platform built with Next.js, Prisma, and TypeScript.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Nginx                                 │
│                   (Reverse Proxy)                            │
│              Rate Limiting / SSL / Cache                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                  Next.js Application                         │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│   │   API    │  │  Auth    │  │Workflow  │  │Dashboard │  │
│   │  Routes  │  │ Handler  │  │  Engine  │  │  Views   │  │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────────┘  │
│        │              │              │                       │
└────────┼──────────────┼──────────────┼──────────────────────┘
         │              │              │
    ┌────▼────┐    ┌────▼────┐    ┌───▼────┐
    │Prisma  │    │ NextAuth│    │BullMQ  │
    │ Client │    │ Session │    │ Worker │
    └────┬────┘    └─────────┘    └───┬────┘
         │                            │
    ┌────▼──────────────────────────▼────┐
    │           PostgreSQL                │
    │         (Primary DB)               │
    └────────────────────────────────────┘
              │                    │
         ┌────▼────┐          ┌───▼────┐
         │  Redis  │          │  Redis │
         │  Cache  │          │  Queue │
         └─────────┘          └────────┘
```

## Features

- **Workflow Engine**: Visual workflow builder with node-based execution
- **AI Integration**: OpenAI-powered agents for automation
- **Real-time Dashboard**: Live monitoring of workflow executions
- **Authentication**: Secure auth with NextAuth.js
- **Multi-tenant**: Organization-based access control
- **Webhooks**: Incoming and outgoing webhook support
- **Integrations**: Connect with external services

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Redis 7+
- Docker (optional)

### Setup

```bash
# Clone the repository
git clone <repo-url>
cd ai-workflow-platform

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Start services with Docker
docker compose up -d postgres redis

# Run database migrations
npx prisma db push

# Seed the database
npx prisma db seed

# Start development server
npm run dev
```

### Using Docker Compose

```bash
# Start all services
docker compose up

# Access at http://localhost:3000
```

## Development

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npx prisma studio    # Open Prisma Studio
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| GET | `/api/workflows` | List workflows |
| POST | `/api/workflows` | Create workflow |
| POST | `/api/workflows/[id]/execute` | Execute workflow |
| GET | `/api/executions` | List executions |
| GET | `/api/health` | Health check |
| GET | `/api/metrics` | Prometheus metrics |

## Deployment

See [Deployment Guide](docs/deployment.md).

```bash
# Production build
docker compose -f docker-compose.prod.yml up -d

# Run migrations
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
```

## Documentation

- [Architecture](docs/architecture.md)
- [API Reference](docs/api.md)
- [Deployment Guide](docs/deployment.md)
- [Workflow Engine](docs/workflows.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT License - see [LICENSE](LICENSE)
