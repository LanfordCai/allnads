import { MCPManager } from './mcpManager';
import { mcpConfig } from '../config/mcpConfig';

/**
 * Shared MCP Manager instance
 * Used throughout the application to ensure consistency
 */
export const mcpManager = new MCPManager({
  maxRetries: mcpConfig.settings.maxRetries,
  retryInterval: mcpConfig.settings.retryInterval,
  timeout: mcpConfig.settings.connectionTimeout
});

/**
 * Initialize MCP server connections
 * This function should be called at application startup
 */
export async function initializeMCPServers() {
  // Connect to all configured MCP servers
  const connectionPromises = mcpConfig.servers.map(async (server) => {
    try {
      const tools = await mcpManager.addServer({
        name: server.name,
        url: server.url
      });
      
      console.log(`✅ Connected to MCP server '${server.name}' - ${server.description || ''}`);
      console.log(`   Available tools (${tools.length}): ${tools.map(t => t.name).join(', ')}`);
      return { success: true, server: server.name, toolCount: tools.length };
    } catch (error) {
      console.error(`❌ Failed to connect to MCP server '${server.name}':`, error instanceof Error ? error.message : String(error));
      return { success: false, server: server.name, error };
    }
  });
  
  // Wait for all connections to complete
  const results = await Promise.allSettled(connectionPromises);
  
  // Count connection results
  const succeeded = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
  const failed = results.filter(r => r.status === 'fulfilled' && !(r.value as any).success).length;
  
  console.log(`MCP server connection results: ${succeeded} successful, ${failed} failed`);
  
  // If all servers failed to connect, may need to throw error or return failure status
  if (succeeded === 0 && failed > 0) {
    console.error('❌ All MCP server connections failed, service may not function properly');
    return false;
  }
  
  return true;
}

/**
 * Get all available MCP tools
 * Includes tools from all connected servers
 */
export function getAllAvailableTools() {
  return mcpManager.getAllTools();
}

/**
 * Get tools for a specific server
 */
export function getServerTools(serverId: string) {
  return mcpManager.getServerTools(serverId);
}

/**
 * Get all connected servers
 */
export function getConnectedServers() {
  return mcpManager.getServers();
}

/**
 * Close all MCP server connections
 * This function should be called at application shutdown
 */
export function closeAllConnections() {
  mcpManager.closeAll();
  console.log('Closed all MCP server connections');
} 