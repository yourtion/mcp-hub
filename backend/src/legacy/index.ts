/**
 * Legacy 兼容模块
 *
 * @deprecated 此模块包含旧版兼容端点，计划在 v2.0 移除。
 *
 * 包含的 legacy 端点：
 * - POST /mcp - 全局 MCP 协议端点（替代：使用 /:group/mcp 组路由）
 * - GET /mcp/status - 服务状态（替代：GET /api/servers）
 * - GET /mcp/tools - 工具列表（替代：GET /api/tools）
 * - GET /mcp/servers/:serverId - 服务器详情（替代：GET /api/servers/:id）
 * - POST /mcp/execute - 工具执行（替代：POST /api/debug/tool-test）
 * - GET /mcp/health - 健康检查（替代：GET /api/hub/health）
 */

export { mcp, shutdownMcpService } from './mcp-legacy.js';
