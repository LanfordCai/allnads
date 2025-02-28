import { z } from 'zod';
import fs from 'fs';
import path from 'path';

// 定义MCP服务器配置模式
const MCPServerSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  description: z.string().optional()
});

// 定义MCP设置模式
const MCPSettingsSchema = z.object({
  defaultServer: z.string(),
  connectionTimeout: z.number().positive().default(30000),
  callTimeout: z.number().positive().default(30000),
  maxRetries: z.number().nonnegative().default(2),
  retryInterval: z.number().positive().default(1000)
});

// 定义配置文件模式
const MCPConfigSchema = z.object({
  servers: z.array(MCPServerSchema),
  settings: MCPSettingsSchema
});

// 配置类型
export type MCPConfig = z.infer<typeof MCPConfigSchema>;
export type MCPServerConfig = z.infer<typeof MCPServerSchema>;
export type MCPSettings = z.infer<typeof MCPSettingsSchema>;

/**
 * 加载MCP配置
 */
export function loadMCPConfig(): MCPConfig {
  try {
    // 解析配置文件路径（直接从项目根目录加载）
    const configPath = path.resolve(process.cwd(), 'mcp.json');
    
    // 检查文件是否存在
    if (!fs.existsSync(configPath)) {
      console.warn(`⚠️ MCP配置文件不存在: ${configPath}`);
      console.warn('将使用默认配置');
      
      // 返回默认配置
      return {
        servers: [
          {
            name: 'default',
            url: 'http://localhost:3001',
            description: '默认本地MCP服务器'
          }
        ],
        settings: {
          defaultServer: 'default',
          connectionTimeout: 30000,
          callTimeout: 30000,
          maxRetries: 2,
          retryInterval: 1000
        }
      };
    }
    
    // 读取配置文件
    const configData = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configData);
    
    // 验证配置
    const result = MCPConfigSchema.safeParse(config);
    
    if (!result.success) {
      console.error('❌ 无效的MCP配置:', result.error.format());
      throw new Error('无效的MCP配置');
    }
    
    return result.data;
  } catch (error) {
    console.error('❌ 加载MCP配置失败:', error instanceof Error ? error.message : String(error));
    throw new Error('加载MCP配置失败');
  }
}

// 导出加载好的配置
export const mcpConfig = loadMCPConfig(); 