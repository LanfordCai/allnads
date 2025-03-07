import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { ContentResult } from './tools/types';
import { sendMonTool } from './tools/sendMon';
import { transactionSignTool } from './tools/transactionSign';
import { changeTemplateTool } from './tools/changeTemplate';
import { env } from './config/env';
import { mintTemplateComponentTool } from './tools/mintTemplateComponent';
import { templateCache } from './utils/globalCache';
import { getOwnedComponentsTool } from './tools/getOwnedComponents';
import { getErc20TokensTool, transferErc20TokenTool } from './tools/erc20Tools';

// Create a new MCP server instance
const server = new McpServer({
  name: 'allnads_account_tool',
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
  sendMonTool.name,
  sendMonTool.description,
  {
    allnadsAccount: z.string().describe('The allnads account of the sender'),
    address: z.string().describe('The address to send MON to'),
    amount: z.string().describe('The amount of MON to send')
  },
  async (args) => {
    console.log(`⚡ Executing ${sendMonTool.name}...`);
    const result = await sendMonTool.execute(args);
    const adaptedResponse = adaptToolResponse(result);
    logToolActivity(sendMonTool.name, args, result);
    return adaptedResponse;
  }
);

server.tool(
  changeTemplateTool.name,
  changeTemplateTool.description,
  {
    allnadsAccount: z.string().describe('The allnads account of the sender'),
    tokenId: z.number().describe('The token id of the Allnads NFT'),
    templateId: z.number().describe('The template id to change to'),
    componentType: z.string().describe('The component type of the template'),
  },
  async (args) => {
    console.log(`⚡ Executing ${changeTemplateTool.name}...`);
    const result = await changeTemplateTool.execute(args);
    const adaptedResponse = adaptToolResponse(result);
    logToolActivity(changeTemplateTool.name, args, result);
    return adaptedResponse;
  }
);

server.tool(
  mintTemplateComponentTool.name,
  mintTemplateComponentTool.description,
  {
    allnadsAccount: z.string().describe('The allnads account of the sender'),
    templateId: z.number().describe('The template id to mint the component for'),
  },
  async (args) => {
    console.log(`⚡ Executing ${mintTemplateComponentTool.name}...`);
    const result = await mintTemplateComponentTool.execute(args);
    const adaptedResponse = adaptToolResponse(result);
    logToolActivity(mintTemplateComponentTool.name, args, result);
    return adaptedResponse;
  }
);

server.tool(
  transactionSignTool.name,
  transactionSignTool.description,
  {
    to: z.string().describe('The destination address for the transaction'),
    data: z.string().describe('The encoded function data for the transaction'),
    value: z.string().describe('The native token value to send with the transaction (in wei)')
  },
  async (args) => {
    return adaptToolResponse({
      content: [
        {
          type: 'text',
          text: 'transaction request has been sent to the user, waiting for the user to process. You do not have permission to sign, do not falsely claim that you have completed the signature. Only the user has permission to sign. And the transaction is not confirmed yet, do not pretend that you have finished the transaction!'
        }
      ]
    });
  }
);

server.tool(
  getOwnedComponentsTool.name,
  getOwnedComponentsTool.description,
  {
    allnadsAccount: z.string().describe('The allnads account of the sender'),
  },
  async (args) => {
    console.log(`⚡ Executing ${getOwnedComponentsTool.name}...`);
    const result = await getOwnedComponentsTool.execute(args);
    const adaptedResponse = adaptToolResponse(result);
    logToolActivity(getOwnedComponentsTool.name, args, result);
    return adaptedResponse;
  }
);

server.tool(
  transferErc20TokenTool.name,  
  transferErc20TokenTool.description,
  {
    allnadsAccount: z.string().describe('The allnads account of the sender'),
    token: z.string().describe('The token to transfer'),
    to: z.string().describe('The address to transfer the token to'),
    amount: z.string().describe('The amount of tokens to transfer')
  },
  async (args) => {
    console.log(`⚡ Executing ${transferErc20TokenTool.name}...`);
    const result = await transferErc20TokenTool.execute(args);
    const adaptedResponse = adaptToolResponse(result);
    logToolActivity(transferErc20TokenTool.name, args, result);
    return adaptedResponse;
  }
);

server.tool(
  getErc20TokensTool.name,
  getErc20TokensTool.description,
  {
    address: z.string().describe('The address to get the erc20 tokens for'),
  },
  async (args) => {
    console.log(`⚡ Executing ${getErc20TokensTool.name}...`);
    const result = await getErc20TokensTool.execute(args);
    const adaptedResponse = adaptToolResponse(result);
    logToolActivity(getErc20TokensTool.name, args, result);
    return adaptedResponse;
  }
)

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

  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
  app.listen(PORT, '::', () => {
    console.log(`Allnads MCP Server started in HTTP mode on port ${PORT}`);
  }).on('error', (error) => {
    console.error('Error starting server:', error);
  });
} else {
  // Default to stdio transport
  console.log('Starting Allnads MCP Server in stdio mode');
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
  
  // Note: Stdio transport does not provide event listeners for receiving messages, so only outgoing messages can be logged
  console.log('⚠️ Note: Cannot log incoming messages in Stdio mode because StdioServerTransport does not provide an event listening interface');
  
  await server.connect(transport);
} 