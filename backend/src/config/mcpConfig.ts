import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { env } from './env';

const MCPServerSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  description: z.string().optional()
});

const MCPSettingsSchema = z.object({
  defaultServer: z.string(),
  connectionTimeout: z.number().positive().default(30000),
  callTimeout: z.number().positive().default(30000),
  maxRetries: z.number().nonnegative().default(2),
  retryInterval: z.number().positive().default(1000)
});

const MCPConfigSchema = z.object({
  servers: z.array(MCPServerSchema),
  settings: MCPSettingsSchema
});

export type MCPConfig = z.infer<typeof MCPConfigSchema>;
export type MCPServerConfig = z.infer<typeof MCPServerSchema>;
export type MCPSettings = z.infer<typeof MCPSettingsSchema>;

export function loadMCPConfig(): MCPConfig {
  return {
    servers: [
      {
        name: 'evm_tool',
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

export const mcpConfig = loadMCPConfig(); 