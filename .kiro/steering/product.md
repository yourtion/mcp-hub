# MCP Hub Product Overview

MCP Hub is a centralized hub server that consolidates multiple Model Context Protocol (MCP) servers into dedicated HTTP or Server-Sent Events (SSE) endpoints.

## Core Purpose
- Aggregate multiple MCP servers into a single access point
- Transform HTTP requests into MCP service calls
- Provide streamable endpoints for real-time communication

## Key Features
- Multi-server MCP integration through configurable groups
- Tool filtering and screening capabilities per group
- Validation functionality with separate validation keys per group
- Support for both HTTP and SSE endpoints
- Request transformation layer between HTTP and MCP protocols

## Architecture
The system follows a hub-and-spoke model where the central hub manages connections to multiple MCP servers and exposes them through standardized web endpoints.