import { MCPChatService } from '../services/mcpChatService';
import { LLMService } from '../services/llmService';
import { Message, ToolCall } from '../types/chat';
import { v4 as uuidv4 } from 'uuid';

/**
 * MCP 聊天示例
 * 展示如何将 MCP 工具集成到 LLM 聊天中
 */
async function runMCPChatExample() {
  try {
    // 初始化服务
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
    const response = await llmService.sendChatRequest({
      model: 'gpt-4o',
      messages,
      tools: mcpTools,
      tool_choice: 'auto'
    });
    
    // 处理 LLM 响应
    const assistantMessage = response.choices[0].message;
    messages.push(assistantMessage);
    
    console.log('\n助手: ' + (assistantMessage.content || ''));
    
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
          const result = await mcpService.executeToolCall(call.name, call.args);
          
          // 创建工具响应消息
          const toolMessage: Message = {
            role: 'tool',
            tool_call_id: assistantMessage.tool_calls?.find((tc: ToolCall) => tc.function.name === call.name)?.id || '',
            content: result.content
          };
          
          console.log(`工具响应: ${result.content}`);
          
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
        model: 'gpt-4o',
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
if (require.main === module) {
  runMCPChatExample().catch(console.error);
}

export { runMCPChatExample }; 