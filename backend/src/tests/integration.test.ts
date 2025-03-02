import { MCPChatService } from '../services/mcpChatService';
import { LLMService } from '../services/llmService';
import { Message, ToolCall } from '../types/chat';
import { TextContent, ImageContent, EmbeddedResource } from '../types/mcp';
import { MCPError, MCPErrorType } from '../services/mcpManager';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { dirname, resolve } from 'path';
import assert from 'assert';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载根目录的.env文件
dotenv.config({ path: resolve(__dirname, '../../.env') });

/**
 * 等待指定时间
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

// 测试配置
const TEST_CONFIG = {
  model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
  timeoutMs: 60000,
  mcpServerUrl: 'http://localhost:8080/sse'
};

// 颜色代码，便于在终端中显示测试结果
const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m"
};

/**
 * 完整集成测试：API聊天与MCP工具调用
 */
async function runIntegrationTest() {
  console.log(`${COLORS.bright}${COLORS.blue}开始API集成测试...${COLORS.reset}\n`);
  
  // 测试计数
  let passed = 0;
  let failed = 0;
  
  async function runTest(name: string, testFn: () => Promise<void>) {
    try {
      console.log(`${COLORS.yellow}[TEST] ${name}${COLORS.reset}`);
      await testFn();
      console.log(`${COLORS.green}[PASS] ${name}${COLORS.reset}\n`);
      passed++;
    } catch (error) {
      console.error(`${COLORS.red}[FAIL] ${name}${COLORS.reset}`);
      console.error(`${COLORS.red}Error: ${error instanceof Error ? error.message : String(error)}${COLORS.reset}\n`);
      failed++;
    }
  }
  
  // 创建服务
  const mcpService = new MCPChatService({
    toolCallTimeout: 30000,
    serverConnectionTimeout: 15000,
    maxRetries: 1,
    retryInterval: 1000
  });
  
  const llmService = new LLMService();
  
  // 测试MCP服务器连接
  await runTest('MCP服务器连接', async () => {
    const tools = await mcpService.registerServer({
      name: 'evm_tool',
      url: TEST_CONFIG.mcpServerUrl,
      description: 'EVM 区块链工具集'
    });
    
    assert(Array.isArray(tools), 'tools应该是数组');
    assert(tools.length > 0, '应该返回至少一个工具');
    assert(tools[0].name, '工具应该有名称');
    console.log(`- 已连接MCP服务器，发现 ${tools.length} 个工具`);
  });
  
  // 测试获取LLM工具格式
  await runTest('工具格式转换', async () => {
    const llmTools = mcpService.getAvailableToolsForLLM();
    
    assert(Array.isArray(llmTools), 'llmTools应该是数组');
    assert(llmTools.length > 0, '应该返回至少一个工具');
    assert(llmTools[0].function, '工具应该有function属性');
    assert(llmTools[0].function.name, '工具应该有名称');
    assert(llmTools[0].function.name.startsWith('mcp__evm_tool__'), '工具名称格式应该正确');
    
    // 打印工具列表
    console.log(`- 成功转换 ${llmTools.length} 个工具为LLM格式:`);
    llmTools.forEach(tool => {
      console.log(`  - ${tool.function.name}`);
    });
  });
  
  // 测试基本聊天（无工具调用）
  await runTest('基本聊天功能', async () => {
    const messages: Message[] = [
      {
        role: 'system',
        content: '你是一个简洁的助手。请用一句话回答问题。'
      },
      {
        role: 'user',
        content: '你好，今天天气怎么样？'
      }
    ];
    
    const response = await withTimeout(
      llmService.sendChatRequest({
        model: TEST_CONFIG.model,
        messages,
      }),
      TEST_CONFIG.timeoutMs,
      'LLM调用超时'
    );
    
    assert(response.choices && response.choices.length > 0, '应该返回至少一个回复选项');
    assert(response.choices[0].message, '应该返回消息');
    assert(response.choices[0].message.content, '消息应该有内容');
    
    console.log(`- LLM响应: "${response.choices[0].message.content.slice(0, 50)}${response.choices[0].message.content.length > 50 ? '...' : ''}"`);
  });
  
  // 测试MCP工具调用 - gas价格查询
  await runTest('MCP工具调用 - Gas价格查询', async () => {
    // 创建会话
    const messages: Message[] = [
      {
        role: 'system',
        content: '你是一个区块链工具助手。请使用可用的工具来回答用户问题。'
      },
      {
        role: 'user',
        content: '请查询以太坊主网当前的gas价格'
      }
    ];
    
    // 获取工具定义
    const tools = mcpService.getAvailableToolsForLLM();
    
    // 发送请求给LLM
    const response = await withTimeout(
      llmService.sendChatRequest({
        model: TEST_CONFIG.model,
        messages,
        tools,
        tool_choice: 'auto'
      }),
      TEST_CONFIG.timeoutMs,
      'LLM调用超时'
    );
    
    assert(response.choices && response.choices.length > 0, '应该返回至少一个回复选项');
    const assistantMessage = response.choices[0].message;
    assert(assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0, '应该返回工具调用');
    
    // 验证工具调用是gas价格工具
    const toolCall = assistantMessage.tool_calls[0];
    console.log(`- LLM请求调用工具: ${toolCall.function.name}`);
    assert(toolCall.function.name.includes('gas_price'), '应该调用gas价格相关工具');
    
    // 解析工具调用
    const toolCalls = mcpService.parseToolCallsFromMessage(assistantMessage);
    assert(toolCalls.length > 0, '应该解析出至少一个工具调用');
    
    // 执行工具调用
    const result = await mcpService.executeToolCall(
      toolCalls[0].name,
      toolCalls[0].args
    );
    
    assert(result.content && result.content.length > 0, '工具响应应该有内容');
    assert(!result.isError, '工具调用不应出错');
    
    // 验证结果格式
    const content = result.content[0];
    assert(content.type === 'text', '应该返回文本内容');
    const textContent = content as TextContent;
    
    // 检查gas价格信息是否存在
    const gasInfo = textContent.text;
    assert(gasInfo.includes('gasPrice') || gasInfo.includes('Gas Price'), '应该包含gas价格信息');
    console.log(`- Gas价格工具调用成功: ${gasInfo.slice(0, 100)}...`);
    
    // 将工具响应发回LLM
    messages.push(assistantMessage);
    messages.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: textContent.text
    });
    
    // 获取LLM的最终回复
    const finalResponse = await withTimeout(
      llmService.sendChatRequest({
        model: TEST_CONFIG.model,
        messages,
      }),
      TEST_CONFIG.timeoutMs,
      'LLM调用超时'
    );
    
    // 验证最终回复
    assert(finalResponse.choices && finalResponse.choices.length > 0, '应该返回最终回复');
    const finalMessage = finalResponse.choices[0].message;
    assert(finalMessage.content, '最终回复应该有内容');
    assert(finalMessage.content.includes('gas') || finalMessage.content.includes('Gas'), '最终回复应该包含gas相关信息');
    
    console.log(`- LLM最终回复: "${finalMessage.content.slice(0, 100)}..."`);
  });
  
  // 测试错误处理 - 不存在的工具调用
  await runTest('错误处理 - 不存在的工具', async () => {
    const result = await mcpService.executeToolCall(
      'mcp__evm_tool__non_existent_tool',
      {}
    );
    
    assert(result.isError, '应该标记为错误');
    assert(result.content && result.content.length > 0, '应该返回错误内容');
    assert(result.content[0].type === 'text', '错误应该是文本内容');
    
    const errorText = (result.content[0] as TextContent).text;
    assert(errorText.includes('TOOL_NOT_FOUND') || errorText.includes('工具未找到'), '应该包含正确的错误类型');
    
    console.log(`- 正确处理不存在的工具调用: ${errorText}`);
  });
  
  // 测试错误处理 - 无效参数
  await runTest('错误处理 - 无效参数', async () => {
    // 找到余额查询工具
    const tools = mcpService.getAvailableToolsForLLM();
    const balanceTool = tools.find(t => t.function.name.includes('account_balance'));
    assert(balanceTool, '应该找到余额查询工具');
    
    // 尝试调用，但不提供必要的address参数
    const result = await mcpService.executeToolCall(
      balanceTool?.function.name || '',
      { chain: 'ethereum' } // 缺少address参数
    );
    
    assert(result.isError, '应该标记为错误');
    assert(result.content && result.content.length > 0, '应该返回错误内容');
    
    const errorText = (result.content[0] as TextContent).text;
    assert(
      errorText.includes('INVALID_ARGUMENTS') || 
      errorText.includes('Invalid arguments') || 
      errorText.includes('无效参数'), 
      '应该包含正确的错误类型'
    );
    
    console.log(`- 正确处理无效参数调用: ${errorText}`);
  });
  
  // 测试解析工具调用
  await runTest('解析工具调用消息', async () => {
    // 模拟一个工具调用消息
    const mockMessage: Message = {
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'call_123',
          type: 'function',
          function: {
            name: 'mcp__evm_tool__evm_gas_price',
            arguments: JSON.stringify({
              chain: 'ethereum'
            })
          }
        }
      ]
    };
    
    const parsedCalls = mcpService.parseToolCallsFromMessage(mockMessage);
    
    assert(parsedCalls.length === 1, '应该解析出一个工具调用');
    assert(parsedCalls[0].name === 'mcp__evm_tool__evm_gas_price', '工具名称应该正确');
    assert(parsedCalls[0].args.chain === 'ethereum', '参数应该正确解析');
    
    console.log(`- 正确解析工具调用消息: ${parsedCalls[0].name} 参数: ${JSON.stringify(parsedCalls[0].args)}`);
  });
  
  // 测试完整聊天流程（一次工具调用）
  await runTest('完整聊天流程', async () => {
    const messages: Message[] = [
      {
        role: 'system',
        content: '你是一个区块链工具助手。请使用可用的工具来回答用户问题。'
      },
      {
        role: 'user',
        content: '请查询Polygon网络的当前gas价格'
      }
    ];
    
    // 获取工具定义
    const tools = mcpService.getAvailableToolsForLLM();
    
    // 第一次调用LLM
    const firstResponse = await withTimeout(
      llmService.sendChatRequest({
        model: TEST_CONFIG.model,
        messages,
        tools,
        tool_choice: 'auto'
      }),
      TEST_CONFIG.timeoutMs,
      'LLM调用超时'
    );
    
    const assistantMessage = firstResponse.choices[0].message;
    messages.push(assistantMessage);
    
    // 验证是否请求工具调用
    assert(assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0, 'LLM应该请求工具调用');
    
    // 解析工具调用
    const toolCalls = mcpService.parseToolCallsFromMessage(assistantMessage);
    
    // 对每个工具调用执行操作
    for (const call of toolCalls) {
      // 执行工具调用
      const result = await mcpService.executeToolCall(call.name, call.args);
      
      // 创建工具响应消息
      const toolResponse: Message = {
        role: 'tool',
        tool_call_id: assistantMessage.tool_calls?.find(tc => tc.function.name === call.name)?.id || '',
        content: result.content[0].type === 'text' ? (result.content[0] as TextContent).text : ''
      };
      
      // 添加到消息历史
      messages.push(toolResponse);
    }
    
    // 第二次调用LLM
    const secondResponse = await withTimeout(
      llmService.sendChatRequest({
        model: TEST_CONFIG.model,
        messages,
      }),
      TEST_CONFIG.timeoutMs,
      'LLM调用超时'
    );
    
    const finalMessage = secondResponse.choices[0].message;
    assert(finalMessage.content, '最终消息应该有内容');
    
    console.log(`- 完整聊天流程成功执行`);
    console.log(`- 工具调用: ${toolCalls[0].name} 使用参数: ${JSON.stringify(toolCalls[0].args)}`);
    console.log(`- 最终AI回复: "${finalMessage.content.slice(0, 100)}..."`);
  });
  
  // 清理资源
  try {
    mcpService.close();
  } catch (error) {
    console.warn('关闭MCP服务失败:', error);
  }
  
  // 显示测试结果
  console.log(`\n${COLORS.bright}测试完成:${COLORS.reset}`);
  console.log(`${COLORS.green}通过: ${passed}${COLORS.reset}`);
  console.log(`${COLORS.red}失败: ${failed}${COLORS.reset}`);
  
  // 返回测试状态码
  return failed > 0 ? 1 : 0;
}

// 直接运行
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runIntegrationTest()
    .then(exitCode => {
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('测试执行失败:', error);
      process.exit(1);
    });
}

export { runIntegrationTest }; 