import { MCPManager } from './mcpManager';
import { mcpConfig } from '../config/mcpConfig';

/**
 * 共享的MCP管理器实例
 * 整个应用程序中使用同一实例，确保一致性
 */
export const mcpManager = new MCPManager({
  maxRetries: mcpConfig.settings.maxRetries,
  retryInterval: mcpConfig.settings.retryInterval,
  timeout: mcpConfig.settings.connectionTimeout
});

/**
 * 初始化MCP服务器连接
 * 应在应用启动时调用此函数
 */
export async function initializeMCPServers() {
  // 连接所有配置的MCP服务器
  const connectionPromises = mcpConfig.servers.map(async (server) => {
    try {
      const tools = await mcpManager.addServer({
        name: server.name,
        url: server.url
      });
      
      console.log(`✅ 已连接到MCP服务器 '${server.name}' - ${server.description || ''}`);
      console.log(`   可用工具 (${tools.length}): ${tools.map(t => t.name).join(', ')}`);
      return { success: true, server: server.name, toolCount: tools.length };
    } catch (error) {
      console.error(`❌ 连接MCP服务器 '${server.name}' 失败:`, error instanceof Error ? error.message : String(error));
      return { success: false, server: server.name, error };
    }
  });
  
  // 等待所有连接完成
  const results = await Promise.allSettled(connectionPromises);
  
  // 统计连接结果
  const succeeded = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
  const failed = results.filter(r => r.status === 'fulfilled' && !(r.value as any).success).length;
  
  console.log(`MCP服务器连接结果: ${succeeded}个成功, ${failed}个失败`);
  
  // 如果所有服务器都连接失败，可能需要抛出错误或返回失败状态
  if (succeeded === 0 && failed > 0) {
    console.error('❌ 所有MCP服务器连接失败，服务可能无法正常工作');
    return false;
  }
  
  return true;
}

/**
 * 获取所有可用MCP工具
 * 包括所有已连接服务器的工具
 */
export function getAllAvailableTools() {
  return mcpManager.getAllTools();
}

/**
 * 获取特定服务器的工具
 */
export function getServerTools(serverId: string) {
  return mcpManager.getServerTools(serverId);
}

/**
 * 获取所有已连接的服务器
 */
export function getConnectedServers() {
  return mcpManager.getServers();
}

/**
 * 关闭所有MCP服务器连接
 * 应在应用关闭时调用此函数
 */
export function closeAllConnections() {
  mcpManager.closeAll();
  console.log('已关闭所有MCP服务器连接');
} 