import { MCPChatService } from '../services/mcpChatService';
import { MCPManager, MCPErrorType } from '../services/mcpManager';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { dirname, resolve } from 'path';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载根目录的.env文件
dotenv.config({ path: resolve(__dirname, '../../.env') });

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 测试MCP的错误处理功能
 */
async function testMCPErrorHandling() {
  console.log('开始测试MCP错误处理...');
  
  // 1. 测试连接到不存在的服务器
  console.log('\n测试 1: 连接到不存在的服务器');
  const mcpService = new MCPChatService({
    serverConnectionTimeout: 5000, // 5秒超时，加快测试速度
    maxRetries: 1
  });
  
  try {
    await mcpService.registerServer({
      name: 'non_existent_server',
      url: 'http://localhost:9999/sse', // 这个端口应该没有服务器运行
      description: '不存在的服务器'
    });
    console.log('❌ 测试失败: 应该抛出连接错误');
  } catch (error: any) {
    console.log(`✅ 测试通过: 正确捕获连接错误: ${error.message} (${error.type || 'unknown type'})`);
  }
  
  // 2. 测试连接超时
  console.log('\n测试 2: 连接超时');
  const timeoutService = new MCPChatService({
    serverConnectionTimeout: 1, // 1毫秒，肯定会超时
    maxRetries: 0
  });
  
  try {
    await timeoutService.registerServer({
      name: 'timeout_server',
      url: 'http://example.com:8080/sse', // 一个可能很慢的响应
      description: '超时测试服务器'
    });
    console.log('❌ 测试失败: 应该抛出超时错误');
  } catch (error: any) {
    console.log(`✅ 测试通过: 正确捕获超时错误: ${error.message} (${error.type || 'unknown type'})`);
  }
  
  // 3. 测试调用不存在的工具
  console.log('\n测试 3: 调用不存在的工具');
  
  // 先创建一个有效连接
  const validService = new MCPChatService();
  
  try {
    // 注册到实际可用的MCP服务器
    await validService.registerServer({
      name: 'evm_tool',
      url: 'http://localhost:8080/sse', // 本地测试 SSE 服务器
      description: 'EVM 区块链工具集'
    });
    
    // 然后尝试调用一个不存在的工具
    const result = await validService.executeToolCall(
      'mcp__evm_tool__non_existent_tool', 
      {}
    );
    
    if (result.isError) {
      console.log(`✅ 测试通过: 正确处理了不存在工具的调用: ${result.content[0].type === 'text' ? (result.content[0] as any).text : 'non-text content'}`);
    } else {
      console.log('❌ 测试失败: 应该返回错误结果');
    }
  } catch (error: any) {
    console.log(`❌ 测试失败: 应该返回错误结果而不是抛出异常: ${error.message}`);
  }
  
  // 4. 测试带有无效参数的工具调用
  console.log('\n测试 4: 带有无效参数的工具调用');
  
  try {
    // 尝试调用一个存在的工具，但参数无效
    const result = await validService.executeToolCall(
      'mcp__evm_tool__evm_account_balance', 
      { invalid_param: 'value' } // 缺少必要的address参数
    );
    
    if (result.isError) {
      console.log(`✅ 测试通过: 正确处理了无效参数的调用: ${result.content[0].type === 'text' ? (result.content[0] as any).text : 'non-text content'}`);
    } else {
      console.log('❌ 测试失败: 应该返回错误结果');
    }
  } catch (error: any) {
    console.log(`❌ 测试失败: 应该返回错误结果而不是抛出异常: ${error.message}`);
  }
  
  // 5. 测试解析无效的工具调用名称
  console.log('\n测试 5: 解析无效的工具调用名称');
  
  try {
    // 尝试使用无效的工具名格式
    const result = await validService.executeToolCall(
      'invalid_tool_name_format', 
      {}
    );
    
    if (result.isError) {
      console.log(`✅ 测试通过: 正确处理了无效工具名: ${result.content[0].type === 'text' ? (result.content[0] as any).text : 'non-text content'}`);
    } else {
      console.log('❌ 测试失败: 应该返回错误结果');
    }
  } catch (error: any) {
    console.log(`❌ 测试失败: 应该返回错误结果而不是抛出异常: ${error.message}`);
  }
  
  // 清理资源
  validService.close();
  
  console.log('\n所有测试完成');
}

// 如果直接运行此文件，则执行测试
// 在 ESM 中检测主模块
const currentFilePath = fileURLToPath(import.meta.url);
const importCallerFilePath = process?.argv[1] ? fileURLToPath(new URL(process.argv[1], 'file:')) : '';
if (currentFilePath === importCallerFilePath) {
  testMCPErrorHandling().catch(error => {
    console.error('运行测试时出错:', error);
    process.exit(1);
  });
}

export { testMCPErrorHandling }; 