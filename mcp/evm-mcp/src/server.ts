import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import cors from 'cors';
import { evmAccountBalanceTool } from './tools/accountBalance.js';
import { evmBlockInfoTool } from './tools/blockInfo.js';
import { evmContractCallTool } from './tools/contractCall.js';
import { evmTransactionInfoTool } from './tools/transactionInfo.js';
import { evmGasPriceTool } from './tools/gasPrice.js';
import { z } from 'zod';
import { ContentResult } from './tools/types.js';
import dotenv from 'dotenv';

dotenv.config()

// Create a new MCP server instance
const server = new McpServer({
  name: 'evm_tool',
  version: '1.0.0',
});

// Helper function to log tool requests and responses
function logToolActivity(toolName: string, request: any, response: any) {
  console.log('\n==============================================');
  console.log(`🔧 TOOL: ${toolName}`);
  console.log('📥 REQUEST:');
  console.log(JSON.stringify(request, null, 2));
  console.log('📤 RESPONSE:');
  console.log(JSON.stringify(response, null, 2));
  console.log('==============================================\n');
}

// Helper function to adapt our tool responses to the MCP SDK format
function adaptToolResponse(result: ContentResult) {
  // Convert our ContentResult to the format expected by MCP SDK
  return {
    content: result.content.map(item => ({
      type: item.type,
      text: item.text,
      // Add any other required properties with index signature
      [Symbol.for('any')]: undefined
    }))
  };
}

// Register all tools with proper parameter schemas
server.tool(
  evmAccountBalanceTool.name,
  evmAccountBalanceTool.description,
  {
    address: z.string().describe('The Ethereum address to check'),
    chain: z.string().default('ethereum').describe('The blockchain to check (e.g., ethereum, optimism, arbitrum, polygon)'),
    customRpcUrl: z.string().optional().describe('Optional custom RPC URL for the chain'),
  },
  async (args) => {
    console.log(`⚡ Executing ${evmAccountBalanceTool.name}...`);
    const result = await evmAccountBalanceTool.execute(args);
    const adaptedResponse = adaptToolResponse(result);
    logToolActivity(evmAccountBalanceTool.name, args, result);
    return adaptedResponse;
  }
);

server.tool(
  evmBlockInfoTool.name,
  evmBlockInfoTool.description,
  {
    blockNumber: z.string().default('latest').describe('The block number to get info for, or "latest"'),
    chain: z.string().default('ethereum').describe('The blockchain to check (e.g., ethereum, optimism, arbitrum, polygon)'),
    customRpcUrl: z.string().optional().describe('Optional custom RPC URL for the chain'),
  },
  async (args) => {
    console.log(`⚡ Executing ${evmBlockInfoTool.name}...`);
    const result = await evmBlockInfoTool.execute(args);
    const adaptedResponse = adaptToolResponse(result);
    logToolActivity(evmBlockInfoTool.name, args, result);
    return adaptedResponse;
  }
);

server.tool(
  evmContractCallTool.name,
  evmContractCallTool.description,
  {
    contractAddress: z.string().describe('The address of the contract to call'),
    abi: z.string().describe('The ABI of the function to call (JSON string or fragment)'),
    functionName: z.string().describe('The name of the function to call'),
    args: z.array(z.string()).optional().describe('Arguments to pass to the function'),
    chain: z.string().default('ethereum').describe('The blockchain to use (e.g., ethereum, optimism, arbitrum, polygon)'),
    customRpcUrl: z.string().optional().describe('Optional custom RPC URL for the chain'),
  },
  async (args) => {
    console.log(`⚡ Executing ${evmContractCallTool.name}...`);
    const result = await evmContractCallTool.execute(args);
    const adaptedResponse = adaptToolResponse(result);
    logToolActivity(evmContractCallTool.name, args, result);
    return adaptedResponse;
  }
);

server.tool(
  evmTransactionInfoTool.name,
  evmTransactionInfoTool.description,
  {
    txHash: z.string().describe('The transaction hash to get info for'),
    chain: z.string().default('ethereum').describe('The blockchain to check (e.g., ethereum, optimism, arbitrum, polygon)'),
    customRpcUrl: z.string().optional().describe('Optional custom RPC URL for the chain'),
  },
  async (args) => {
    console.log(`⚡ Executing ${evmTransactionInfoTool.name}...`);
    const result = await evmTransactionInfoTool.execute(args);
    const adaptedResponse = adaptToolResponse(result);
    logToolActivity(evmTransactionInfoTool.name, args, result);
    return adaptedResponse;
  }
);

server.tool(
  evmGasPriceTool.name,
  evmGasPriceTool.description,
  {
    chain: z.string().default('ethereum').describe('The blockchain to check (e.g., ethereum, optimism, arbitrum, polygon)'),
    customRpcUrl: z.string().optional().describe('Optional custom RPC URL for the chain'),
  },
  async (args) => {
    console.log(`⚡ Executing ${evmGasPriceTool.name}...`);
    const result = await evmGasPriceTool.execute(args);
    const adaptedResponse = adaptToolResponse(result);
    logToolActivity(evmGasPriceTool.name, args, result);
    return adaptedResponse;
  }
);

// Check if we should run in HTTP server mode
const USE_HTTP = process.env.USE_HTTP === 'true';

if (USE_HTTP) {
  // Create Express app for SSE transport
  const app = express();
  app.use(cors());

  // Add request logging middleware
  app.use((req, res, next) => {
    console.log(`\n🌐 HTTP ${req.method} ${req.url}`);
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        if (body) {
          try {
            console.log('📝 Request Body:');
            console.log(JSON.stringify(JSON.parse(body), null, 2));
          } catch (e) {
            console.log('📝 Request Body: (raw)');
            console.log(body);
          }
        }
      });
    }
    
    // Capture response data
    const originalSend = res.send;
    res.send = function(body) {
      console.log('📤 Response:');
      try {
        if (typeof body === 'string') {
          console.log(JSON.stringify(JSON.parse(body), null, 2));
        } else {
          console.log(JSON.stringify(body, null, 2));
        }
      } catch (e) {
        console.log(body);
      }
      return originalSend.call(this, body);
    };
    
    next();
  });

  // Create a single transport instance that will be shared across connections
  let sseTransport: SSEServerTransport | null = null;

  app.get('/sse', async (req, res) => {
    console.log('New SSE connection established');
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Create the transport with the SSE response
    sseTransport = new SSEServerTransport('/messages', res);
    
    // Set up connection close handler
    res.on('close', () => {
      console.log('Client disconnected');
      sseTransport = null;
    });
    
    await server.connect(sseTransport);
  });

  // Handle client messages
  app.post('/messages', async (req, res) => {
    try {
      if (sseTransport) {
        await sseTransport.handlePostMessage(req, res);
      } else {
        res.status(400).json({ error: 'No active connection' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`EVM MCP Server started in HTTP mode on port ${PORT}`);
  }).on('error', (error) => {
    console.error('Error starting server:', error);
  });
} else {
  // Default to stdio transport
  console.log('Starting EVM MCP Server in stdio mode');
  const transport = new StdioServerTransport();
  
  // Log stdio messages
  console.log('📡 Stdio transport initialized');
  
  // Add logging to the transport
  const originalSend = transport.send;
  transport.send = function(message) {
    console.log('\n📤 Outgoing Message:');
    console.log(JSON.stringify(message, null, 2));
    return originalSend.call(this, message);
  };
  
  // 注：Stdio传输不提供接收消息的事件监听，所以只能记录发送的消息
  console.log('⚠️ 注意: 无法记录Stdio模式下的传入消息，因为StdioServerTransport不提供事件监听接口');
  
  await server.connect(transport);
} 