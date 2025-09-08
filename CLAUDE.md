# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `pnpm dev:api` - Start API server in development mode with hot reload
- `pnpm dev:fe` - Start frontend in development mode
- `pnpm dev:cli` - Start CLI package in development mode
- `pnpm build` - Build all packages
- `pnpm build:production` - Build all packages for production deployment

### Testing & Quality
- `pnpm test` - Run all tests across packages
- `pnpm test:coverage` - Run tests with coverage reports
- `pnpm test:debug` - Run tests in debug mode (VITEST_DEBUG=true)
- `pnpm check` - Run linting and formatting with Biome
- `pnpm check:all` - Run Biome check on entire codebase

### Package-specific Commands
- `pnpm --filter @mcp-core/mcp-hub-core dev` - Watch mode compilation for core package
- `pnpm --filter @mcp-core/mcp-hub-cli test:e2e` - End-to-end tests for CLI package
- `pnpm --filter @mcp-core/mcp-hub-api test:mcp` - MCP protocol tests for API package

### Deployment
- `pnpm start:api` - Start API server in production
- `pnpm start:cli` - Start CLI server in production

## Architecture Overview

MCP Hub is a modular monorepo that provides a centralized hub for managing multiple MCP (Model Context Protocol) servers through different interfaces.

### Core Architecture

The project follows a modular architecture with clear separation of concerns:

1. **Core Package** (`packages/core/`) - Provides the foundational MCP service management, connection handling, and tool execution capabilities
2. **API Package** (`backend/`) - Web API server built with Hono that exposes HTTP/SSE endpoints
3. **CLI Package** (`packages/cli/`) - Standalone MCP server that communicates via stdin/stdout
4. **Share Package** (`packages/share/`) - Shared types and utilities
5. **Frontend** (`frontend/`) - Vue.js web interface for management

### Key Design Patterns

#### Service Layer Architecture
- **MCP Service Manager**: Centralized management of MCP server connections
- **Server Connection Manager**: Handles connection pooling and lifecycle management
- **Tool Registry**: Manages tool discovery, validation, and execution
- **Group Manager**: Handles group-based routing and access control

#### Configuration System
- **Multi-layer Configuration**: Supports both legacy config files and new validated configuration
- **Environment-based Overrides**: Supports environment variable overrides for deployment
- **Validation**: Uses Zod schemas for comprehensive configuration validation

#### Error Handling
- **Unified Error System**: Centralized error handling with proper error codes and categories
- **Graceful Degradation**: Services continue operating even when some MCP servers fail
- **Error Recovery**: Automatic reconnection and retry mechanisms

### Package Structure

```
packages/
├── core/                    # @mcp-core/mcp-hub-core
│   ├── src/
│   │   ├── api-to-mcp/     # API to MCP conversion services
│   │   ├── config/         # Configuration management
│   │   ├── errors/         # Error handling system
│   │   ├── services/       # Core services (MCP, tools, connections)
│   │   ├── types/          # Type definitions
│   │   └── utils/          # Utility functions
├── cli/                     # @mcp-core/mcp-hub-cli
│   ├── src/
│   │   ├── config/         # CLI-specific configuration
│   │   ├── protocol/       # MCP protocol handling
│   │   ├── server/         # CLI server implementation
│   │   ├── transport/      # Transport layer (stdin/stdout)
│   │   └── utils/          # CLI utilities
└── share/                   # @mcp-core/mcp-hub-share
    └── src/
        ├── types/          # Shared types
        └── utils/          # Shared utilities
```

### API Endpoints Structure

The API server provides two main endpoint patterns:

1. **Global Endpoint** (`/mcp`) - Legacy endpoint for all tools
2. **Group-based Endpoints** (`/:group/mcp`) - Group-specific endpoints with access control

Key API routes:
- `/api/groups` - Group management
- `/api/servers` - MCP server management  
- `/api/tools` - Tool discovery and testing
- `/api/auth` - Authentication endpoints

### MCP Protocol Integration

The project implements the Model Context Protocol in multiple ways:

1. **HTTP/SSE Transport**: For web-based clients with streaming capabilities
2. **CLI Transport**: For integration with MCP clients like Claude Desktop
3. **Internal Transport**: For inter-service communication

### Authentication & Security

- **JWT-based Authentication**: Token-based authentication for web interface
- **Group-level Security**: Each group can have separate validation keys
- **Tool Filtering**: Groups support allow/deny lists for tools
- **Rate Limiting**: Built-in rate limiting for API endpoints

### Configuration Management

Configuration is handled through multiple layers:

1. **MCP Service Configuration** (`mcp_service.json`) - Defines MCP servers
2. **Group Configuration** (`group.json`) - Defines server groups and access rules
3. **System Configuration** - General system settings
4. **Environment Variables** - Override any configuration value

### Testing Strategy

The project uses a comprehensive testing approach:

- **Unit Tests**: Individual component testing with Vitest
- **Integration Tests**: Service interaction testing
- **E2E Tests**: Full MCP protocol testing with mock servers
- **Coverage Reports**: Code coverage tracking and reporting

### Development Workflow

1. **Local Development**: Use `pnpm dev:*` commands for hot reload
2. **Testing**: Run `pnpm test` and `pnpm test:coverage` before commits
3. **Code Quality**: Use `pnpm check` for linting and formatting
4. **Building**: Use `pnpm build` to verify compilation
5. **API Testing**: Use `pnpm inspector` for MCP protocol debugging

### Package Dependencies

The project uses workspace dependencies with clear boundaries:

- **core** depends on **share**
- **cli** depends on **core** and **share**
- **api** depends on **core** and **share**
- **frontend** depends on **share**

This ensures proper dependency management and avoids circular dependencies.