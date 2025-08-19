import { McpServiceManager } from '@mcp-core/mcp-hub-core';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { join } from 'path';

// 读取 package.json
const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
import { getAllConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { McpHubService } from './mcp_hub_service.js';

// Create the MCP server instance
export const mcpServer = new McpServer({
  name: pkg.name,
  version: pkg.version,
});

// Global hub service instance
let hubService: McpHubService | null = null;
// Global core service manager instance
let coreServiceManager: McpServiceManager | null = null;

/**
 * Initialize the MCP Hub Service and register dynamic tools
 */
export async function initializeMcpService(): Promise<void> {
  try {
    logger.info(
      'Initializing MCP Service with Hub integration and Core package',
    );

    // Load configurations
    const config = await getAllConfig();

    // Create and initialize core service manager
    coreServiceManager = new McpServiceManager();
    // 转换配置格式以匹配核心包期望的格式
    const coreConfig = {
      servers: config.mcps.mcpServers as Record<string, any>,
      groups: config.groups as Record<string, any>,
    };
    await coreServiceManager.initializeFromConfig(coreConfig);

    // Create and initialize hub service (for backward compatibility)
    hubService = new McpHubService(
      config.mcps.mcpServers as Record<string, any>,
      config.groups as any,
    );

    await hubService.initialize();

    // Register hub management tools
    await registerHubTools();

    // Register dynamic tools from external MCP servers
    await registerDynamicTools();

    logger.info('MCP Service initialization completed successfully');
  } catch (error) {
    logger.error('Failed to initialize MCP Service', error as Error);
    throw error;
  }
}

/**
 * Register hub management and utility tools
 */
async function registerHubTools(): Promise<void> {
  // Hub status tool
  mcpServer.tool(
    'hub_status',
    {
      groupId: z.string().optional().describe('Group ID to check status for'),
    },
    async ({ groupId }) => {
      try {
        if (!hubService) {
          throw new Error('Hub service not initialized');
        }

        const status = hubService.getServiceStatus();
        const groups = hubService.getAllGroups();

        let result = `MCP Hub Status:
- Initialized: ${status.isInitialized}
- Connected Servers: ${status.connectedServers}/${status.serverCount}
- Groups: ${status.groupCount}
- Available Groups: ${Array.from(groups.keys()).join(', ')}`;

        if (groupId) {
          const groupInfo = hubService.getGroupInfo(groupId);
          if (groupInfo) {
            result += `\n\nGroup '${groupId}' Details:
- Name: ${groupInfo.name}
- Description: ${groupInfo.description || 'N/A'}
- Servers: ${groupInfo.servers.join(', ')}
- Tools: ${groupInfo.tools.length > 0 ? groupInfo.tools.join(', ') : 'All tools from servers'}`;
          } else {
            result += `\n\nGroup '${groupId}' not found.`;
          }
        }

        return {
          content: [{ type: 'text', text: result }],
        };
      } catch (error) {
        logger.error('Error getting hub status', error as Error);
        return {
          content: [
            {
              type: 'text',
              text: `Error getting hub status: ${(error as Error).message}`,
            },
          ],
        };
      }
    },
  );

  // List tools by group
  mcpServer.tool(
    'list_tools',
    {
      groupId: z
        .string()
        .optional()
        .describe('Group ID to list tools for (defaults to "default")'),
    },
    async ({ groupId }) => {
      try {
        if (!hubService) {
          throw new Error('Hub service not initialized');
        }

        const tools = await hubService.listTools(groupId);

        const toolList = tools.map((tool) => ({
          name: tool.name,
          description: tool.description || 'No description available',
          serverId: tool.serverId,
          schema: tool.inputSchema,
        }));

        return {
          content: [
            {
              type: 'text',
              text: `Available tools in group '${groupId || 'default'}': ${tools.length} tools found\n\n${toolList.map((t) => `- ${t.name} (from ${t.serverId}): ${t.description}`).join('\n')}`,
            },
          ],
        };
      } catch (error) {
        logger.error('Error listing tools', error as Error);
        return {
          content: [
            {
              type: 'text',
              text: `Error listing tools: ${(error as Error).message}`,
            },
          ],
        };
      }
    },
  );

  // Execute tool with group context
  mcpServer.tool(
    'execute_tool',
    {
      toolName: z.string().describe('Name of the tool to execute'),
      args: z.record(z.any()).describe('Arguments to pass to the tool'),
      groupId: z
        .string()
        .optional()
        .describe(
          'Group ID context for tool execution (defaults to "default")',
        ),
    },
    async ({ toolName, args, groupId }) => {
      try {
        if (!hubService) {
          throw new Error('Hub service not initialized');
        }

        const result = await hubService.callTool(toolName, args, groupId);

        if (result.isError) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Tool execution failed: ${JSON.stringify(result.content, null, 2)}`,
              },
            ],
          };
        }

        // Ensure content has proper typing
        const typedContent = result.content.map((item: any) => {
          if (typeof item === 'object' && item !== null) {
            return {
              type: item.type || ('text' as const),
              ...item,
            };
          }
          return {
            type: 'text' as const,
            text: String(item),
          };
        });

        return {
          content: typedContent,
        };
      } catch (error) {
        logger.error('Error executing tool', error as Error);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error executing tool '${toolName}': ${(error as Error).message}`,
            },
          ],
        };
      }
    },
  );

  // Get service diagnostics
  mcpServer.tool('hub_diagnostics', {}, async () => {
    try {
      if (!hubService) {
        throw new Error('Hub service not initialized');
      }

      const diagnostics = await hubService.getServiceDiagnostics();

      return {
        content: [
          {
            type: 'text',
            text: `MCP Hub Diagnostics:\n\n${JSON.stringify(diagnostics, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      logger.error('Error getting diagnostics', error as Error);
      return {
        content: [
          {
            type: 'text',
            text: `Error getting diagnostics: ${(error as Error).message}`,
          },
        ],
      };
    }
  });

  logger.info('Hub management tools registered successfully');
}

/**
 * Register tools dynamically from external MCP servers
 */
async function registerDynamicTools(): Promise<void> {
  try {
    if (!hubService) {
      throw new Error('Hub service not initialized');
    }

    // Get all groups and their tools
    const groups = hubService.getAllGroups();
    const registeredTools = new Set<string>();

    for (const [groupId, _group] of groups) {
      try {
        const tools = await hubService.listTools(groupId);

        for (const tool of tools) {
          // Avoid registering duplicate tools (same name from different groups)
          const toolKey = `${tool.name}_${tool.serverId}`;
          if (registeredTools.has(toolKey)) {
            continue;
          }
          registeredTools.add(toolKey);

          // Create a dynamic tool registration
          const toolName = `${tool.serverId}_${tool.name}`;

          // Convert the tool's input schema to Zod schema
          const zodSchema = convertToZodSchema(tool.inputSchema);

          mcpServer.tool(toolName, zodSchema, async (args) => {
            try {
              if (!hubService) {
                throw new Error('Hub service not initialized');
              }

              const result = await hubService.callTool(
                tool.name,
                args,
                groupId,
              );

              if (result.isError) {
                return {
                  content: [
                    {
                      type: 'text' as const,
                      text: `Tool execution failed: ${JSON.stringify(result.content, null, 2)}`,
                    },
                  ],
                };
              }

              // Ensure content has proper typing
              const typedContent = result.content.map((item: any) => {
                if (typeof item === 'object' && item !== null) {
                  return {
                    type: item.type || ('text' as const),
                    ...item,
                  };
                }
                return {
                  type: 'text' as const,
                  text: String(item),
                };
              });

              return {
                content: typedContent,
              };
            } catch (error) {
              logger.error(
                `Error executing dynamic tool ${toolName}`,
                error as Error,
              );
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `Error executing tool: ${(error as Error).message}`,
                  },
                ],
              };
            }
          });
        }

        logger.info(`Registered ${tools.length} tools from group '${groupId}'`);
      } catch (error) {
        logger.warn(`Failed to register tools from group '${groupId}'`, {
          error: (error as Error).message,
        });
      }
    }

    logger.info(
      `Dynamic tool registration completed. Total unique tools registered: ${registeredTools.size}`,
    );
  } catch (error) {
    logger.error('Failed to register dynamic tools', error as Error);
    // Don't throw here, allow service to continue with hub tools only
  }
}

/**
 * Convert JSON schema to Zod schema (simplified conversion)
 */
function convertToZodSchema(inputSchema: any): Record<string, any> {
  if (!inputSchema || !inputSchema.properties) {
    return {};
  }

  const zodSchema: Record<string, any> = {};

  for (const [propName, propDef] of Object.entries(inputSchema.properties)) {
    const prop = propDef as any;

    // Basic type conversion
    switch (prop.type) {
      case 'string':
        zodSchema[propName] = z.string();
        if (prop.description) {
          zodSchema[propName] = zodSchema[propName].describe(prop.description);
        }
        break;
      case 'number':
        zodSchema[propName] = z.number();
        if (prop.description) {
          zodSchema[propName] = zodSchema[propName].describe(prop.description);
        }
        break;
      case 'boolean':
        zodSchema[propName] = z.boolean();
        if (prop.description) {
          zodSchema[propName] = zodSchema[propName].describe(prop.description);
        }
        break;
      case 'object':
        zodSchema[propName] = z.record(z.any());
        if (prop.description) {
          zodSchema[propName] = zodSchema[propName].describe(prop.description);
        }
        break;
      case 'array':
        zodSchema[propName] = z.array(z.any());
        if (prop.description) {
          zodSchema[propName] = zodSchema[propName].describe(prop.description);
        }
        break;
      default:
        zodSchema[propName] = z.any();
        if (prop.description) {
          zodSchema[propName] = zodSchema[propName].describe(prop.description);
        }
    }

    // Handle optional properties
    if (!inputSchema.required || !inputSchema.required.includes(propName)) {
      zodSchema[propName] = zodSchema[propName].optional();
    }
  }

  return zodSchema;
}

/**
 * Shutdown the MCP service and hub
 */
export async function shutdownMcpService(): Promise<void> {
  try {
    if (hubService) {
      logger.info('Shutting down MCP Hub Service');
      await hubService.shutdown();
      hubService = null;
    }

    if (coreServiceManager) {
      logger.info('Shutting down Core Service Manager');
      await coreServiceManager.shutdown();
      coreServiceManager = null;
    }

    logger.info('MCP Service shutdown completed');
  } catch (error) {
    logger.error('Error during MCP Service shutdown', error as Error);
    throw error;
  }
}
