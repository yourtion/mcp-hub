# MCP Hub

English | [中文版](README.zh.md)

A centralized hub server engineered to consolidate multiple MCP servers into dedicated Streamable HTTP or SSE endpoints, each tailored to specific use scenarios.

## Features

- **Multi-server MCP Integration**: Support for multiple MCP servers with centralized management
- **Group-based Routing**: Access MCP services through group-specific endpoints (`/:group/mcp`)
- **CLI MCP Server**: Standalone command-line MCP server for tool aggregation
- **Streamable Endpoints**: Support for both HTTP and SSE endpoints
- **Tool Filtering**: Groups support tool filtering and screening capabilities
- **Validation Support**: Groups can set separate validation keys for security
- **Modular Architecture**: Clean separation between core logic, API, and CLI packages

## Architecture

MCP Hub follows a modular monorepo architecture with the following packages:

### Core Packages

- **`@mcp-core/mcp-hub-core`** - Core MCP service management, connection handling, and tool execution
- **`@mcp-core/mcp-hub-api`** - Web API server with group-based routing and HTTP endpoints  
- **`@mcp-core/mcp-hub-cli`** - Command-line MCP server for standalone tool aggregation
- **`@mcp-core/mcp-hub-share`** - Shared types and utilities across packages
- **`@mcp-core/mcp-hub-web`** - Vue.js frontend interface (optional)

### Package Structure

```
├── backend/              # API server (@mcp-core/mcp-hub-api)
├── frontend/             # Vue.js web interface
├── packages/
│   ├── core/            # Core MCP logic (@mcp-core/mcp-hub-core)
│   ├── cli/             # CLI package (@mcp-core/mcp-hub-cli)
│   └── share/           # Shared types (@mcp-core/mcp-hub-share)
└── docs/                # Documentation
```

## Installation

### Prerequisites

- Node.js 18+ 
- pnpm package manager

### Install Dependencies

```bash
# Install all dependencies
pnpm install

# Build all packages
pnpm build
```

## Quick Start

### 1. API Server (Web Interface)

Start the API server for web-based MCP hub functionality:

```bash
# Development mode
pnpm dev:api

# Production build and start
pnpm build
cd backend && pnpm start
```

The API server will be available at `http://localhost:3000` with the following endpoints:

- `/mcp` - Global MCP endpoint (legacy, for management)
- `/:group/mcp` - Group-specific MCP endpoints
- `/api/groups` - Group management API
- `/api/config` - System configuration management API
- `/api/servers` - MCP server management API
- `/api/tools` - Tool management and execution API
- `/api/debug` - Debugging and monitoring API

### 2. CLI MCP Server

Use the CLI package as a standalone MCP server:

```bash
# Install CLI globally (optional)
npm install -g @mcp-core/mcp-hub-cli

# Or run directly from workspace
cd packages/cli
pnpm build
node dist/cli.js

# Or use the executable
./bin/mcp-hub.js
```

The CLI server communicates via stdin/stdout using the MCP protocol, perfect for integration with MCP clients like Claude Desktop.

### 3. Frontend Interface (Optional)

Start the web interface for visual management:

```bash
pnpm dev:fe
```

The frontend provides a comprehensive web-based management interface with:

- **JWT Authentication**: Secure login system with token-based authentication
- **Server Management**: Visual interface for managing MCP servers
- **Tool Management**: Browse and test available MCP tools
- **Group Management**: Configure and manage server groups
- **Configuration Management**: System configuration with validation, testing, and backup/restore
- **Real-time Monitoring**: Live status updates and system monitoring
- **API to MCP Integration**: Convert REST APIs to MCP tools
- **Debug Tools**: MCP protocol debugging and performance analysis

#### Authentication

The frontend uses JWT-based authentication. Default credentials can be configured in the backend authentication service. The system includes:

- Secure login with username/password
- Automatic token refresh
- Route guards for protected pages
- Persistent authentication state

## Configuration

### MCP Server Configuration

Create a `mcp_service.json` file in the `backend/config/` directory:

```json
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/directory"],
      "env": {}
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Group Configuration

Configure groups in `backend/config/group.json`:

```json
{
  "groups": {
    "development": {
      "name": "Development Tools",
      "description": "Tools for software development",
      "servers": ["filesystem", "git"],
      "allowedTools": ["read_file", "write_file", "git_status"],
      "validationKey": "dev-key-123"
    },
    "research": {
      "name": "Research Tools", 
      "description": "Tools for research and information gathering",
      "servers": ["brave-search", "wikipedia"],
      "allowedTools": ["search", "lookup"],
      "validationKey": "research-key-456"
    }
  }
}
```

## Usage Examples

### Group-based MCP Access

Access tools through group-specific endpoints:

```bash
# List tools for development group
curl http://localhost:3000/development/mcp/list_tools

# Call a tool in the research group
curl -X POST http://localhost:3000/research/mcp/call_tool \
  -H "Content-Type: application/json" \
  -d '{
    "name": "search",
    "arguments": {
      "query": "MCP protocol documentation"
    }
  }'
```

### CLI MCP Server Integration

Configure the CLI server in your MCP client (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "mcp-hub": {
      "command": "/path/to/mcp-hub/packages/cli/bin/mcp-hub.js",
      "args": ["--config", "/path/to/mcp_service.json"]
    }
  }
}
```

## Development

### Available Scripts

```bash
# Development
pnpm dev:api          # Start API server in development mode
pnpm dev:fe           # Start frontend in development mode

# Building
pnpm build            # Build all packages
pnpm check            # Run linting and formatting

# Testing  
pnpm test             # Run all tests
pnpm test:coverage    # Run tests with coverage
pnpm test:e2e         # Run end-to-end tests

# Utilities
pnpm inspector        # Launch MCP inspector for debugging
```

### Package Development

Each package can be developed independently:

```bash
# Core package
cd packages/core
pnpm dev              # Watch mode compilation
pnpm test:watch       # Watch mode testing

# CLI package  
cd packages/cli
pnpm dev              # Watch mode compilation
pnpm test:e2e         # End-to-end testing

# API package
cd backend
pnpm dev              # Development server
pnpm test:mcp         # MCP protocol tests
```

## Documentation

- [CLI Usage Guide](docs/CLI_USAGE.md) - Detailed CLI usage and configuration
- [Group Routing Guide](docs/GROUP_ROUTING.md) - Group-based routing documentation
- [Migration Guide](docs/MIGRATION.md) - Upgrading from previous versions
- [API Reference](docs/API_REFERENCE.md) - Complete API documentation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run `pnpm check` to ensure code quality
5. Submit a pull request

## License

ISC License - see LICENSE file for details.