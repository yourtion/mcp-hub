import path from "node:path";
import { JsonStorage } from "./json_storage";
import { DeepReadonly } from "@mcp-core/mcp-hub-share/src/types";
import { McpConfig, GroupConfig, SystemConfig } from "@mcp-core/mcp-hub-share/src/config";

const configDir = process.env.CONFIG_PATH || path.resolve(process.cwd(), "config");

const mcpServerPath = path.resolve(configDir, "mcp_server.json");
const mcpServerInstance = new JsonStorage<McpConfig>(mcpServerPath, { mcpServers: {} }); // Renamed to avoid conflict with imported type

const groupPath = path.resolve(configDir, "group.json");
const groupConfigInstance = new JsonStorage<GroupConfig>(groupPath, {} as GroupConfig); // Renamed and added type assertion for default value

const systemPath = path.resolve(configDir, "system.json");
const systemConfigInstance = new JsonStorage<SystemConfig>(systemPath, {} as SystemConfig); // Renamed and added type assertion for default value

export async function getAllConfig(): Promise<DeepReadonly<{
  mcps: McpConfig;
  groups: GroupConfig;
  system: SystemConfig;
}>> {
  const mcps = await mcpServerInstance.read();
  const groups = await groupConfigInstance.read();
  const system = await systemConfigInstance.read();
  return { mcps, groups, system };
}