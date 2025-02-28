import { MCPChatService } from '../services/mcpChatService';
import { LLMService } from '../services/llmService';
import { Message, ToolCall } from '../types/chat';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { dirname, resolve } from 'path';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载根目录的.env文件
dotenv.config({ path: resolve(__dirname, '../../.env') });

/**
 * MCP 聊天示例
 * 展示如何将 MCP 工具集成到 LLM 聊天中
 */
async function runMCPChatExample() {
  try {
    // 初始化服务
    const model = 'anthropic/claude-3.5-sonnet'
    const mcpService = new MCPChatService();
    const llmService = new LLMService();
    
    console.log('正在连接 MCP 服务器...');
    
    // 注册 MCP 服务器 (evm_tool 工具服务)
    await mcpService.registerServer({
      name: 'evm_tool',
      url: 'http://localhost:8080/sse', // 本地测试 SSE 服务器
      description: 'EVM 区块链工具集'
    });
    
    console.log('MCP 服务器连接成功!');
    
    // 获取可用工具
    const mcpTools = mcpService.getAvailableToolsForLLM();
    console.log(`发现 ${mcpTools.length} 个可用工具:`);
    mcpTools.forEach(tool => {
      console.log(`- ${tool.function.name}: ${tool.function.description}`);
    });
    
    // 创建聊天历史
    const messages: Message[] = [
      {
        role: 'system',
        content: '你是一个具有区块链工具访问能力的智能助手。你可以帮助用户查询以太坊区块链上的信息和执行相关操作。'
      }
    ];
    
    // 用户输入
    const userMessage: Message = {
      role: 'user',
      content: '请查询以太坊主网的当前 gas 价格'
    };
    messages.push(userMessage);
    
    console.log('\n用户: ' + userMessage.content);
    
    // 发送请求给 LLM，包含工具定义
    console.log(`\n发送请求给模型 ${model}...`);
    
    // 预定义助手消息变量
    let assistantMessage;
    
    try {
      const response = await llmService.sendChatRequest({
        model: model,
        messages,
        tools: mcpTools,
        tool_choice: 'auto'
      });
      
      // 检查响应格式
      if (!response || !response.choices || !response.choices.length) {
        throw new Error('LLM 返回了无效的响应格式');
      }
      
      // 处理 LLM 响应
      assistantMessage = response.choices[0].message;
      if (!assistantMessage) {
        throw new Error('LLM 响应中没有助手消息');
      }
      
      messages.push(assistantMessage);
      
      console.log('\n助手: ' + (assistantMessage.content || ''));
    } catch (error) {
      console.error('处理 LLM 响应时出错:', error);
      // 出错后结束执行
      return;
    }
    
    // 检查是否有工具调用
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      console.log(`\n检测到 ${assistantMessage.tool_calls.length} 个工具调用请求`);
      
      // 解析工具调用
      const toolCalls = mcpService.parseToolCallsFromMessage(assistantMessage);
      
      // 执行每个工具调用
      for (const call of toolCalls) {
        console.log(`\n执行工具调用: ${call.name}`);
        console.log(`参数: ${JSON.stringify(call.args, null, 2)}`);
        
        try {
          // 执行工具调用
          console.log('call',call);
          const result = await mcpService.executeToolCall(call.name, call.args);
          
          // 创建工具响应消息
          const toolMessage: Message = {
            role: 'tool',
            tool_call_id: assistantMessage.tool_calls?.find((tc: ToolCall) => tc.function.name === call.name)?.id || '',
            content: result.content
          };

          console.log('toolMessage',toolMessage);
          
          console.log(`工具响应: ${result.content}`);

          console.log('result',result);
          return
          
          // 添加到消息历史
          messages.push(toolMessage);
        } catch (error) {
          console.error(`工具调用失败: ${error}`);
          
          // 创建错误响应
          const errorMessage: Message = {
            role: 'tool',
            tool_call_id: assistantMessage.tool_calls?.find((tc: ToolCall) => tc.function.name === call.name)?.id || '',
            content: `Error: ${error}`
          };
          
          // 添加到消息历史
          messages.push(errorMessage);
        }
      }
      
      // 再次发送请求，包含工具调用结果
      console.log('\n发送工具响应给 LLM...');
      const followUpResponse = await llmService.sendChatRequest({
        model: model,
        messages,
      });
      
      const followUpMessage = followUpResponse.choices[0].message;
      messages.push(followUpMessage);
      
      console.log('\n助手: ' + (followUpMessage.content || ''));
    }
    
    // 清理资源
    mcpService.close();
    
  } catch (error) {
    console.error('运行示例时出错:', error);
  }
}

// 如果直接运行此文件，则执行示例
// 在 ESM 中检测主模块
const currentFilePath = fileURLToPath(import.meta.url);
const importCallerFilePath = process?.argv[1] ? fileURLToPath(new URL(process.argv[1], 'file:')) : '';
if (currentFilePath === importCallerFilePath) {
  runMCPChatExample().catch(console.error);
}

export { runMCPChatExample }; 