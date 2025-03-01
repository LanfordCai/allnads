import { MCPChatService } from '../services/mcpChatService';
import { LLMService } from '../services/llmService';
import { Message, ToolCall } from '../types/chat';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { dirname, resolve } from 'path';
import { TextContent, ImageContent, EmbeddedResource } from '../types/mcp';
import { MCPError, MCPErrorType } from '../services/mcpManager';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载根目录的.env文件
dotenv.config({ path: resolve(__dirname, '../../.env') });

/**
 * LLM调用重试配置
 */
const LLM_RETRY_CONFIG = {
  maxRetries: 3,         // 最大重试次数
  initialDelay: 1000,    // 初始延迟时间(毫秒)
  maxDelay: 10000,       // 最大延迟时间(毫秒)
  timeoutMs: 60000,      // 超时时间(毫秒)
};

/**
 * MCP服务配置
 */
const MCP_SERVICE_CONFIG = {
  toolCallTimeout: 30000,      // 30秒工具调用超时
  serverConnectionTimeout: 15000, // 15秒连接超时
  maxRetries: 2,               // 最多重试2次
  retryInterval: 1000          // 1秒重试间隔
};

/**
 * 错误类型枚举
 */
enum ErrorType {
  NETWORK = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT_ERROR',
  API = 'API_ERROR',
  RESPONSE_FORMAT = 'RESPONSE_FORMAT_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR',
}

/**
 * 判断错误类型
 */
function determineErrorType(error: unknown): ErrorType {
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return ErrorType.TIMEOUT;
    } else if (
      errorMessage.includes('network') || 
      errorMessage.includes('connection') || 
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('econnreset')
    ) {
      return ErrorType.NETWORK;
    } else if (
      errorMessage.includes('status code') || 
      errorMessage.includes('rate limit') || 
      errorMessage.includes('api')
    ) {
      return ErrorType.API;
    } else if (
      errorMessage.includes('format') || 
      errorMessage.includes('invalid') || 
      errorMessage.includes('parse')
    ) {
      return ErrorType.RESPONSE_FORMAT;
    }
  }
  
  return ErrorType.UNKNOWN;
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 带超时的Promise
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${message} (timeout after ${timeoutMs}ms)`));
    }, timeoutMs);
    
    promise
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * 带重试和超时的LLM调用
 */
async function callLLMWithRetry(llmService: LLMService, requestData: any): Promise<any> {
  let lastError: Error | null = null;
  let retryCount = 0;
  
  while (retryCount < LLM_RETRY_CONFIG.maxRetries) {
    try {
      if (retryCount > 0) {
        console.log(`重试 LLM 调用 (${retryCount}/${LLM_RETRY_CONFIG.maxRetries})...`);
      }
      
      // 带超时的LLM调用
      const response = await withTimeout(
        llmService.sendChatRequest(requestData),
        LLM_RETRY_CONFIG.timeoutMs,
        'LLM 调用超时'
      );
      
      // 验证响应格式
      if (!response || !response.choices || !response.choices.length) {
        throw new Error('LLM 返回了无效的响应格式');
      }
      
      const message = response.choices[0].message;
      if (!message) {
        throw new Error('LLM 响应中没有助手消息');
      }
      
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorType = determineErrorType(error);
      
      console.error(`LLM 调用失败 (${errorType}): ${lastError.message}`);
      
      // 对于不同类型的错误采取不同的重试策略
      if (errorType === ErrorType.TIMEOUT || errorType === ErrorType.NETWORK) {
        // 网络错误和超时可以重试
        retryCount++;
        
        // 指数退避延迟
        const delayMs = Math.min(
          LLM_RETRY_CONFIG.initialDelay * Math.pow(2, retryCount - 1),
          LLM_RETRY_CONFIG.maxDelay
        );
        
        console.log(`等待 ${delayMs}ms 后重试...`);
        await delay(delayMs);
      } else if (errorType === ErrorType.API && lastError.message.includes('rate limit')) {
        // 速率限制，等待更长时间
        retryCount++;
        const delayMs = Math.min(
          LLM_RETRY_CONFIG.initialDelay * Math.pow(3, retryCount - 1), // 更长的等待
          LLM_RETRY_CONFIG.maxDelay * 2
        );
        
        console.log(`遇到速率限制，等待 ${delayMs}ms 后重试...`);
        await delay(delayMs);
      } else {
        // 其他错误类型（格式错误、API错误等）直接失败
        break;
      }
    }
  }
  
  // 达到最大重试次数或者非可重试错误
  if (lastError) {
    throw lastError;
  }
  
  throw new Error('LLM 调用失败，但没有捕获到具体错误');
}

/**
 * 处理MCP异常，确保返回用户友好的消息
 */
function handleMCPException(error: unknown): string {
  if (error instanceof MCPError) {
    switch (error.type) {
      case MCPErrorType.CONNECTION:
        return '无法连接到MCP服务器。请检查网络连接和服务器状态。';
      case MCPErrorType.TIMEOUT:
        return 'MCP服务器响应超时。请稍后再试。';
      case MCPErrorType.TOOL_NOT_FOUND:
        return `工具未找到: ${error.toolName || '未知工具'}`;
      case MCPErrorType.INVALID_ARGS:
        return '工具调用参数无效。请检查参数格式和必填项。';
      case MCPErrorType.SERVER_ERROR:
        return 'MCP服务器内部错误。请联系系统管理员。';
      default:
        return `MCP错误: ${error.message}`;
    }
  } else if (error instanceof Error) {
    return `发生错误: ${error.message}`;
  } else {
    return '发生未知错误';
  }
}

/**
 * MCP 聊天示例
 * 展示如何将 MCP 工具集成到 LLM 聊天中
 */
async function runMCPChatExample() {
  let mcpService: MCPChatService | null = null;
  
  try {
    // 初始化服务
    const model = 'anthropic/claude-3.5-sonnet'
    mcpService = new MCPChatService(MCP_SERVICE_CONFIG);
    const llmService = new LLMService();
    
    console.log('正在连接 MCP 服务器...');
    
    try {
      // 注册 MCP 服务器 (evm_tool 工具服务)
      await mcpService.registerServer({
        name: 'evm_tool',
        url: 'http://localhost:8080/sse', // 本地测试 SSE 服务器
        description: 'EVM 区块链工具集'
      });
      
      console.log('MCP 服务器连接成功!');
    } catch (error) {
      // 处理MCP服务器连接错误
      const errorMessage = handleMCPException(error);
      console.error(`MCP服务器连接失败: ${errorMessage}`);
      
      // 创建一个用户友好的错误消息
      console.log('\n无法连接到区块链工具服务。将继续但没有工具可用。');
      
      // 继续执行，但没有工具可用
    }
    
    // 获取可用工具
    const mcpTools = mcpService.getAvailableToolsForLLM();
    if (mcpTools.length > 0) {
      console.log(`发现 ${mcpTools.length} 个可用工具:`);
      mcpTools.forEach(tool => {
        console.log(`- ${tool.function.name}: ${tool.function.description}`);
      });
    } else {
      console.log('未发现可用工具');
    }
    
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
      content: '请查询 Polygon 的当前 gas 价格'
    };
    messages.push(userMessage);
    
    console.log('\n用户: ' + userMessage.content);
    
    // 发送请求给 LLM，包含工具定义
    console.log(`\n发送请求给模型 ${model}...`);
    
    // 预定义助手消息变量
    let assistantMessage;
    
    try {
      // 使用带重试和超时的LLM调用
      const response = await callLLMWithRetry(llmService, {
        model: model,
        messages,
        tools: mcpTools.length > 0 ? mcpTools : undefined, // 只有当有工具可用时才包含工具定义
        tool_choice: mcpTools.length > 0 ? 'auto' : undefined
      });
      
      // 处理 LLM 响应
      assistantMessage = response.choices[0].message;
      messages.push(assistantMessage);
      
      console.log('\n助手: ' + (assistantMessage.content || ''));
    } catch (error) {
      console.error('LLM 调用最终失败:', error);
      console.log('\n告知用户 LLM 服务暂时不可用...');
      
      // 创建一个错误消息给用户
      assistantMessage = {
        role: 'assistant' as const,
        content: '很抱歉，我目前无法处理您的请求。AI服务遇到了技术问题，请稍后再试。'
      };
      messages.push(assistantMessage);
      
      // 出错后继续执行，尝试正常关闭资源
    }
    
    // 检查是否有工具调用
    if (assistantMessage && assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
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
          
          // 从结果中提取内容
          let resultContent = '';
          if (result.content && result.content.length > 0) {
            // 遍历所有内容项
            for (const contentItem of result.content) {
              // 根据内容类型处理
              if (contentItem.type === 'text') {
                // 处理文本内容
                resultContent += (contentItem as TextContent).text;
              } else if (contentItem.type === 'image') {
                // 处理图像内容
                const imageContent = contentItem as ImageContent;
                resultContent += `[图像: MIME类型 ${imageContent.mimeType}, base64数据长度: ${imageContent.data.length}]`;
              } else if (contentItem.type === 'embedded_resource') {
                // 处理嵌入资源
                const resourceContent = contentItem as EmbeddedResource;
                resultContent += `[嵌入资源: ${JSON.stringify(resourceContent.resource)}]`;
              }
            }
          }
          
          console.log(`工具响应: ${resultContent}`);
          
          // 创建工具响应消息
          const toolMessage: Message = {
            role: 'tool',
            tool_call_id: assistantMessage.tool_calls?.find((tc: ToolCall) => tc.function.name === call.name)?.id || '',
            content: resultContent
          };
          
          // 添加到消息历史
          messages.push(toolMessage);
          
          // 如果工具调用出错，记录错误信息
          if (result.isError) {
            console.error(`工具调用返回错误: ${resultContent}`);
          }
        } catch (error) {
          // 处理工具调用异常
          const errorMessage = handleMCPException(error);
          console.error(`工具调用失败: ${errorMessage}`);
          
          // 创建错误响应
          const errorContent = `Error: ${errorMessage}`;
          const errorMessage2: Message = {
            role: 'tool',
            tool_call_id: assistantMessage.tool_calls?.find((tc: ToolCall) => tc.function.name === call.name)?.id || '',
            content: errorContent
          };
          
          // 添加到消息历史
          messages.push(errorMessage2);
        }
      }
      
      // 再次发送请求，包含工具调用结果
      console.log('\n发送工具响应给 LLM...');
      
      try {
        // 使用带重试和超时的LLM调用
        const followUpResponse = await callLLMWithRetry(llmService, {
          model: model,
          messages,
        });
        
        const followUpMessage = followUpResponse.choices[0].message;
        messages.push(followUpMessage);
        
        console.log('\n助手: ' + (followUpMessage.content || ''));
      } catch (error) {
        console.error('处理工具结果的 LLM 调用失败:', error);
        
        // 创建一个简单的回退消息
        const fallbackMessage: Message = {
          role: 'assistant',
          content: '很抱歉，我在处理工具调用结果时遇到了问题。我已收到数据，但无法为您生成完整回应。请稍后再试。'
        };
        
        messages.push(fallbackMessage);
        console.log('\n助手 (fallback): ' + fallbackMessage.content);
      }
    }
    
  } catch (error) {
    console.error('运行示例时出错:', error);
  } finally {
    // 确保始终清理资源
    if (mcpService) {
      try {
        mcpService.close();
      } catch (error) {
        console.warn('关闭MCP服务失败:', error);
      }
    }
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