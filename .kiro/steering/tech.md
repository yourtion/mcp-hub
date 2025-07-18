# Technology Stack

## Build System & Package Management
- **pnpm** - Package manager with workspace support
- **pnpm workspaces** - Monorepo structure with shared dependencies
- **TypeScript** - Primary language for type safety

## Backend Stack
- **Node.js** with TypeScript
- **Hono** - Web framework for API endpoints
- **@hono/node-server** - Node.js adapter for Hono
- **@modelcontextprotocol/sdk** - MCP protocol implementation
- **Zod** - Runtime type validation
- **tsx** - TypeScript execution for development

## Frontend Stack
- **Vue 3** - Frontend framework
- **Rsbuild** - Build tool and bundler
- **TypeScript** - Type-safe frontend development

## Code Quality & Formatting
- **Biome** - Linting and formatting (primary)
- **Prettier** - Additional formatting support
- **ESLint** - JavaScript/TypeScript linting

## Common Commands

### Development
```bash
# Start backend development server
pnpm dev:api

# Start frontend development server  
pnpm dev:fe

# Run MCP inspector
pnpm inspector
```

### Building
```bash
# Build backend
cd backend && pnpm build

# Build frontend
cd frontend && pnpm build
```

### Code Quality
```bash
# Format and lint with Biome
pnpm --filter <package> check
```

## Configuration Files
- `biome.json` - Biome configuration for linting/formatting
- `tsconfig.json` - TypeScript configuration per package
- `pnpm-workspace.yaml` - Workspace configuration