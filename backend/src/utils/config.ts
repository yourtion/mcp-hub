import path from "node:path";
import { JsonStorage } from "./json_storage";
import { mpcServer, groupConfig, systemConfig } from "@mcp-core/mcp-hub-share/src/config"

const configDir = process.env.CONFIG_PATH || path.resolve(process.cwd(), "config");

const mcpServerPath = path.resolve(configDir, "mcp_server.json");
const mcpServer = new JsonStorage<mpcServer>(mcpServerPath, {});

const groupPath = path.resolve(configDir, "group.json");
const groupConfig = new JsonStorage<groupConfig>(groupPath, {});

const systemPath = path.resolve(configDir, "system.json");
const systemConfig = new JsonStorage<systemConfig>(systemPath, {});

export async function getAllConfig() {
  return {
    mcpServer: await mcpServer.read(),
    groupConfig: await groupConfig.read(),
    systemConfig: await systemConfig.read(),
  }
}