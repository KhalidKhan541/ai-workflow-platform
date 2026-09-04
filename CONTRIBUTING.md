# Contributing to AI Workflow Platform

Thank you for considering contributing to AI Workflow Platform!

## Getting Started

1. Fork the repository
2. Clone your fork
3. Create a feature branch: `git checkout -b feature/my-feature`
4. Install dependencies: `npm install`
5. Make your changes
6. Run tests: `npm test`
7. Run linting: `npm run lint`
8. Commit: `git commit -m "feat: add my feature"`
9. Push: `git push origin feature/my-feature`
10. Open a Pull Request

## Development Setup

```bash
# Start services
docker compose up -d postgres redis

# Setup database
npx prisma db push
npx prisma db seed

# Start dev server
npm run dev
```

## Code Style

- Use TypeScript for all new code
- Follow the existing code patterns
- Run `npx prettier --write .` before committing
- All components should be in `src/components`
- All API routes should be in `src/app/api`

## Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance

## Pull Request Process

1. Update documentation if needed
2. Add tests for new features
3. Ensure all checks pass
4. Request review from maintainers

## Questions?

Open an issue or start a discussion.
