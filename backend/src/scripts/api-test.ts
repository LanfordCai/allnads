import { MCPChatService } from '../services/mcpChatService';
import { LLMService } from '../services/llmService';
import { Message } from '../types/chat';
import { TextContent } from '../types/mcp';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';
import readline from 'readline';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载根目录的.env文件
dotenv.config({ path: resolve(__dirname, '../../.env') });

// 颜色代码，便于在终端中显示
const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m"
};

// 创建readline接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 配置
const CONFIG = {
  model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
  mcpUrl: process.env.MCP_SERVER_URL || 'http://localhost:8080/sse',
  mcpName: process.env.MCP_SERVER_NAME || 'evm_tool'
};

/**
 * 主函数
 */
async function main() {
  console.log(`${COLORS.bright}${COLORS.cyan}=== API 测试工具 ===${COLORS.reset}`);
  
  // 创建服务
  const mcpService = new MCPChatService();
  const llmService = new LLMService();
  
  console.log(`${COLORS.yellow}连接到MCP服务器 ${CONFIG.mcpUrl}...${COLORS.reset}`);
  
  try {
    // 连接到MCP服务器
    const tools = await mcpService.registerServer({
      name: CONFIG.mcpName,
      url: CONFIG.mcpUrl,
      description: 'EVM区块链工具集'
    });
    
    console.log(`${COLORS.green}✓ 连接成功，发现 ${tools.length} 个工具${COLORS.reset}`);
    console.log(`${COLORS.dim}可用工具: ${tools.map(t => t.name).join(', ')}${COLORS.reset}`);
    
    // 获取LLM格式的工具
    const llmTools = mcpService.getAvailableToolsForLLM();
    
    // 聊天历史
    const messages: Message[] = [
      {
        role: 'system',
        content: '你是一个区块链助手，可以帮助用户了解区块链信息并使用区块链工具。你可以使用可用的工具来回答用户问题。'
      }
    ];
    
    // 运行聊天循环
    await chatLoop(messages, llmService, mcpService, llmTools);
  } catch (error) {
    console.error(`${COLORS.red}错误: ${error instanceof Error ? error.message : String(error)}${COLORS.reset}`);
  } finally {
    mcpService.close();
    rl.close();
  }
}

/**
 * 聊天循环
 */
async function chatLoop(
  messages: Message[], 
  llmService: LLMService, 
  mcpService: MCPChatService, 
  tools: any[]
) {
  while (true) {
    try {
      // 获取用户输入
      const userInput = await prompt(`\n${COLORS.bright}${COLORS.green}你${COLORS.reset}: `);
      
      // 检查退出命令
      if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
        console.log(`${COLORS.yellow}再见！${COLORS.reset}`);
        break;
      }
      
      // 添加用户消息
      messages.push({
        role: 'user',
        content: userInput
      });
      
      // 显示等待提示
      process.stdout.write(`${COLORS.bright}${COLORS.blue}AI${COLORS.reset}: `);
      
      // 发送请求到LLM
      const response = await llmService.sendChatRequest({
        model: CONFIG.model,
        messages,
        tools,
        tool_choice: 'auto'
      });
      
      const assistantMessage = response.choices[0].message;
      messages.push(assistantMessage);
      
      // 检查是否需要调用工具
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // 显示工具调用
        console.log(`${COLORS.dim}(调用工具...)${COLORS.reset}`);
        
        // 解析工具调用
        const toolCalls = mcpService.parseToolCallsFromMessage(assistantMessage);
        
        // 对每个工具调用执行
        for (const call of toolCalls) {
          try {
            console.log(`${COLORS.dim}> 执行: ${call.name}(${JSON.stringify(call.args)})${COLORS.reset}`);
            
            // 执行工具调用
            const result = await mcpService.executeToolCall(call.name, call.args);
            
            // 将结果格式化为工具响应
            const toolContent = result.content[0].type === 'text' 
              ? (result.content[0] as TextContent).text 
              : JSON.stringify(result.content[0]);
            
            // 创建工具响应消息
            const toolResponse: Message = {
              role: 'tool',
              tool_call_id: assistantMessage.tool_calls?.find(tc => tc.function.name === call.name)?.id || '',
              content: toolContent
            };
            
            // 添加工具响应到消息历史
            messages.push(toolResponse);
            
            console.log(`${COLORS.dim}> 结果: ${toolContent.substring(0, 100)}${toolContent.length > 100 ? '...' : ''}${COLORS.reset}`);
          } catch (error) {
            console.error(`${COLORS.red}工具调用错误: ${error instanceof Error ? error.message : String(error)}${COLORS.reset}`);
            
            // 创建错误工具响应
            const errorResponse: Message = {
              role: 'tool',
              tool_call_id: assistantMessage.tool_calls?.find(tc => tc.function.name === call.name)?.id || '',
              content: `错误: ${error instanceof Error ? error.message : String(error)}`
            };
            
            // 添加错误响应到消息历史
            messages.push(errorResponse);
          }
        }
        
        // 获取最终回复
        console.log(`${COLORS.dim}(获取AI回复...)${COLORS.reset}`);
        
        const finalResponse = await llmService.sendChatRequest({
          model: CONFIG.model,
          messages
        });
        
        const finalMessage = finalResponse.choices[0].message;
        messages.push(finalMessage);
        
        // 显示最终回复
        console.log(`${finalMessage.content}`);
      } else {
        // 直接显示回复
        console.log(`${assistantMessage.content}`);
      }
    } catch (error) {
      console.error(`${COLORS.red}错误: ${error instanceof Error ? error.message : String(error)}${COLORS.reset}`);
    }
  }
}

/**
 * 提示用户输入
 */
function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// 运行主函数
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('执行失败:', error);
    process.exit(1);
  });
} 