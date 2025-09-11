import { Hono } from 'hono';
import { McpHubService } from '../../services/mcp_hub_service.js';
import { getHubService } from '../hub.js';
import { logger } from '../../utils/logger.js';

export const debugApi = new Hono();

// GET /api/debug/mcp-messages - Get MCP protocol messages
debugApi.get('/mcp-messages', async (c) => {
  try {
    const service = await getHubService();
    
    // Get query parameters for filtering
    const limit = parseInt(c.req.query('limit') || '50');
    const serverId = c.req.query('serverId');
    const type = c.req.query('type') as 'request' | 'response' | 'notification' || undefined;
    
    // Get MCP messages from the service
    const messages = service.getMcpMessages(limit, serverId, type);
    
    return c.json({
      success: true,
      data: {
        messages,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get MCP messages', error as Error);
    return c.json({
      success: false,
      error: {
        code: 'DEBUG_ERROR',
        message: 'Failed to get MCP messages',
        details: (error as Error).message,
      },
      timestamp: new Date().toISOString(),
      path: c.req.path,
    }, { status: 500 });
  }
});

// POST /api/debug/tool-test - Test tool execution
debugApi.post('/tool-test', async (c) => {
  try {
    const service = await getHubService();
    const body = await c.req.json();
    
    const { toolName, serverId, groupId, arguments: args } = body;
    
    if (!toolName) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'toolName is required',
        },
        timestamp: new Date().toISOString(),
        path: c.req.path,
      }, { status: 400 });
    }
    
    // Execute the tool
    const startTime = Date.now();
    const result = await service.callTool(toolName, args || {}, groupId);
    const executionTime = Date.now() - startTime;
    
    return c.json({
      success: true,
      data: {
        toolName,
        serverId,
        groupId,
        arguments: args,
        result,
        executionTime,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to test tool', error as Error);
    return c.json({
      success: false,
      error: {
        code: 'DEBUG_ERROR',
        message: 'Failed to test tool',
        details: (error as Error).message,
      },
      timestamp: new Date().toISOString(),
      path: c.req.path,
    }, { status: 500 });
  }
});

// GET /api/debug/performance-stats - Get performance statistics
debugApi.get('/performance-stats', async (c) => {
  try {
    const service = await getHubService();
    
    // Get performance stats from the service
    const stats = service.getPerformanceStats();
    
    return c.json({
      success: true,
      data: {
        stats,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get performance stats', error as Error);
    return c.json({
      success: false,
      error: {
        code: 'DEBUG_ERROR',
        message: 'Failed to get performance stats',
        details: (error as Error).message,
      },
      timestamp: new Date().toISOString(),
      path: c.req.path,
    }, { status: 500 });
  }
});

// GET /api/debug/error-analysis - Get error analysis
debugApi.get('/error-analysis', async (c) => {
  try {
    const service = await getHubService();
    
    // Get error messages from the tracked messages
    const allMessages = service.getMcpMessages(1000);
    const errorMessages = allMessages.filter(msg => 
      msg.type === 'response' && 
      typeof msg.content === 'object' && 
      msg.content !== null && 
      (msg.content as { isError?: boolean }).isError === true
    );
    
    // Simple error analysis
    const errorAnalysis = {
      totalErrors: errorMessages.length,
      errorRate: allMessages.length > 0 ? (errorMessages.length / allMessages.length) * 100 : 0,
      mostCommonErrors: errorMessages
        .map(msg => {
          const content = msg.content as { error?: string };
          return content.error || 'Unknown error';
        })
        .reduce((acc: Record<string, number>, error: string) => {
          acc[error] = (acc[error] || 0) + 1;
          return acc;
        }, {}),
      recentErrors: errorMessages.slice(0, 10),
    };
    
    return c.json({
      success: true,
      data: {
        errors: errorMessages,
        analysis: errorAnalysis,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to analyze errors', error as Error);
    return c.json({
      success: false,
      error: {
        code: 'DEBUG_ERROR',
        message: 'Failed to analyze errors',
        details: (error as Error).message,
      },
      timestamp: new Date().toISOString(),
      path: c.req.path,
    }, { status: 500 });
  }
});