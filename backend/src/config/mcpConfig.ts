import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { env } from './env';

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
  return {
    servers: [
      {
        name: 'default',
        url: env.EMV_TOOL_URL,
        description: 'EVM Blockchain Query Tool'
      },
      {
        name: 'allnads_tool',
        url: env.ALLNADS_TOOL_URL,
        description: 'AllNads Account Management Tool'
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

// 导出加载好的配置
export const mcpConfig = loadMCPConfig(); 