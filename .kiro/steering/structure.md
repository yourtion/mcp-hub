# Project Structure

## Monorepo Organization
This is a pnpm workspace monorepo with three main packages:

```
├── backend/           # API server (@mcp-core/mcp-hub-api)
├── frontend/          # Vue.js web interface  
├── packages/share/    # Shared types and utilities (@mcp-core/mcp-hub-share)
└── .kiro/            # Kiro AI assistant configuration
```

## Backend Structure (`backend/`)
```
backend/
├── src/
│   ├── api/           # API route handlers
│   ├── services/      # Business logic and MCP service management
│   ├── types/         # TypeScript type definitions
│   ├── utils/         # Utility functions and helpers
│   ├── validation/    # Input validation schemas
│   ├── app.ts         # Hono app configuration
│   ├── index.ts       # Server entry point
│   ├── mcp.ts         # MCP protocol handlers
│   └── sse.ts         # Server-Sent Events implementation
├── config/            # Configuration files (JSON)
└── dist/             # Compiled TypeScript output
```

## Frontend Structure (`frontend/`)
```
frontend/
├── src/
│   ├── App.vue        # Main Vue component
│   ├── index.ts       # Application entry point
│   ├── index.css      # Global styles
│   └── env.d.ts       # TypeScript environment declarations
└── .vscode/          # VS Code configuration
```

## Shared Package (`packages/share/`)
```
packages/share/src/
├── config.d.ts        # Configuration type definitions
├── mcp.d.ts          # MCP-related type definitions  
├── types.d.ts        # General shared types
└── index.ts          # Package exports
```

## Configuration Conventions
- **JSON configs** in `backend/config/` for runtime configuration
- **TypeScript configs** per package for build settings
- **Biome config** at root for consistent code formatting
- **Package-specific** scripts and dependencies

## Naming Conventions
- **Packages**: `@mcp-core/mcp-hub-*` scoped naming
- **Files**: kebab-case for configs, camelCase for TypeScript
- **Directories**: lowercase with underscores for separation
- **Types**: PascalCase interfaces, camelCase for properties

## Import Patterns
- Use workspace references: `@mcp-core/mcp-hub-share`
- Relative imports within packages: `./services/config`
- Absolute imports from node_modules: `@hono/node-server`