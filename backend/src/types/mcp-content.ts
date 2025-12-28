/**
 * MCP 协议内容类型定义
 * 符合 Model Context Protocol 规范
 */

/**
 * MCP 工具执行结果内容项类型
 * 根据 @modelcontextprotocol/sdk 规范定义
 */
export type McpContentItem = TextContent | ImageContent | ResourceContent;

/**
 * 文本内容类型
 */
export interface TextContent {
  type: 'text';
  text: string;
  _meta?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * 图像内容类型
 */
export interface ImageContent {
  type: 'image';
  data: string;
  mimeType: string;
  _meta?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * 资源内容类型
 */
export interface ResourceContent {
  type: 'resource';
  uri: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * 类型守卫：检查是否为 TextContent
 */
export function isTextContent(content: McpContentItem): content is TextContent {
  return content.type === 'text';
}

/**
 * 类型守卫：检查是否为 ImageContent
 */
export function isImageContent(
  content: McpContentItem,
): content is ImageContent {
  return content.type === 'image';
}

/**
 * 类型守卫：检查是否为 ResourceContent
 */
export function isResourceContent(
  content: McpContentItem,
): content is ResourceContent {
  return content.type === 'resource';
}

/**
 * 确保内容项具有正确的类型
 */
export function normalizeMcpContent(item: unknown): McpContentItem {
  if (typeof item === 'object' && item !== null) {
    const content = item as Record<string, unknown>;
    return {
      type: (content.type as McpContentItem['type']) || 'text',
      ...content,
    } as McpContentItem;
  }
  return {
    type: 'text',
    text: String(item),
  };
}
