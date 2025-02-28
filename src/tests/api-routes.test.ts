import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';
import assert from 'assert';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载根目录的.env文件
dotenv.config({ path: resolve(__dirname, '../../.env') });

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

// 测试配置
const TEST_CONFIG = {
  // 从.env加载或使用默认值
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000/api',
  apiKey: process.env.API_KEY || 'test-api-key',
  timeoutMs: 60000,
};

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

// 安全的JSON格式化，处理循环引用
function safeStringify(obj: any): string {
  try {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    }, 2);
  } catch (err) {
    return '[无法序列化的对象]';
  }
}

/**
 * API路由测试
 */
async function runApiRoutesTest() {
  console.log(`${COLORS.bright}${COLORS.blue}开始API路由测试...${COLORS.reset}\n`);
  console.log(`${COLORS.yellow}API基础URL: ${TEST_CONFIG.apiBaseUrl}${COLORS.reset}`);
  
  // 测试计数
  let passed = 0;
  let failed = 0;
  
  // 创建HTTP客户端
  const apiClient = axios.create({
    baseURL: TEST_CONFIG.apiBaseUrl,
    timeout: TEST_CONFIG.timeoutMs,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TEST_CONFIG.apiKey}`
    }
  });
  
  async function runTest(name: string, testFn: () => Promise<void>) {
    try {
      console.log(`${COLORS.yellow}[TEST] ${name}${COLORS.reset}`);
      await testFn();
      console.log(`${COLORS.green}[PASS] ${name}${COLORS.reset}\n`);
      passed++;
    } catch (error) {
      console.error(`${COLORS.red}[FAIL] ${name}${COLORS.reset}`);
      if (axios.isAxiosError(error)) {
        if (error.response) {
          console.error(`${COLORS.red}HTTP状态: ${error.response.status}${COLORS.reset}`);
          console.error(`${COLORS.red}错误详情: ${safeStringify(error.response.data)}${COLORS.reset}`);
        } else if (error.request) {
          console.error(`${COLORS.red}请求错误: 未收到响应${COLORS.reset}`);
        } else {
          console.error(`${COLORS.red}错误: ${error.message}${COLORS.reset}`);
        }
      } else {
        console.error(`${COLORS.red}错误: ${error instanceof Error ? error.message : String(error)}${COLORS.reset}`);
      }
      console.error(`\n`);
      failed++;
    }
  }
  
  // 测试1: 健康检查
  await runTest('健康检查 (ping)', async () => {
    const response = await apiClient.get('/health');
    assert(response.status === 200, '健康检查应返回200状态码');
    assert(response.data.status === 'success', '健康检查应返回success状态');
    console.log(`- 服务健康状态: ${safeStringify(response.data)}`);
  });
  
  // 测试2: 基本聊天功能
  await runTest('基本聊天功能', async () => {
    const response = await apiClient.post('/chat', {
      message: "你好，今天天气怎么样？"
    });
    
    assert(response.status === 200, '聊天请求应返回200状态码');
    assert(response.data.status === 'success', '应返回success状态');
    assert(response.data.data, '应返回data对象');
    assert(response.data.data.sessionId, '应返回会话ID');
    assert(response.data.data.message, '应返回消息对象');
    assert(response.data.data.message.content, '消息应包含内容');
    
    console.log(`- 聊天响应: ${safeStringify(response.data)}`);
    console.log(`- 会话ID: ${response.data.data.sessionId}`);
    console.log(`- 回复内容: "${response.data.data.message.content}"`);
  });
  
  // 测试3: 聊天功能 - 带系统提示
  await runTest('聊天功能 - 带系统提示', async () => {
    const response = await apiClient.post('/chat', {
      message: "你能做什么？",
      systemPrompt: "你是一个简洁的助手，请用简短的语言回答问题。"
    });
    
    assert(response.status === 200, '带系统提示的聊天请求应返回200状态码');
    assert(response.data.status === 'success', '应返回success状态');
    assert(response.data.data.message.content, '消息应包含内容');
    
    console.log(`- 聊天响应: ${safeStringify(response.data)}`);
    console.log(`- 带系统提示的回复: "${response.data.data.message.content}"`);
  });
  
  // 测试4: 聊天功能 - 会话连续性
  await runTest('聊天功能 - 会话连续性', async () => {
    // 第一条消息
    const firstResponse = await apiClient.post('/chat', {
      message: "我叫张三"
    });
    
    assert(firstResponse.status === 200, '第一条消息应返回200状态码');
    assert(firstResponse.data.data.sessionId, '应返回会话ID');
    
    const sessionId = firstResponse.data.data.sessionId;
    console.log(`- 创建会话ID: ${sessionId}`);
    
    // 第二条消息，使用相同会话ID
    const secondResponse = await apiClient.post('/chat', {
      sessionId,
      message: "你还记得我的名字吗？"
    });
    
    assert(secondResponse.status === 200, '第二条消息应返回200状态码');
    assert(secondResponse.data.data.sessionId === sessionId, '应返回相同的会话ID');
    assert(secondResponse.data.data.history.length >= 4, '历史记录应至少包含4条消息');
    
    console.log(`- 第二条消息响应: ${safeStringify(secondResponse.data)}`);
    console.log(`- 历史记录长度: ${secondResponse.data.data.history.length}`);
    console.log(`- 第二条回复: "${secondResponse.data.data.message.content}"`);
  });
  
  // 测试5: 错误处理 - 空消息
  await runTest('错误处理 - 空消息', async () => {
    try {
      await apiClient.post('/chat', {
        message: "" // 空消息
      });
      
      // 如果请求成功，则测试失败
      assert(false, '空消息应该被拒绝');
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        assert(error.response.status === 400, '空消息应返回400状态码');
        assert(error.response.data.status === 'error', '应返回error状态');
        console.log(`- 正确拒绝空消息: ${safeStringify(error.response.data)}`);
      } else {
        throw error; // 重新抛出非预期的错误
      }
    }
  });
  
  // 测试6: 错误处理 - 无效的会话ID
  await runTest('错误处理 - 无效的会话ID', async () => {
    try {
      await apiClient.post('/chat', {
        sessionId: "invalid-session-id", // 非UUID格式
        message: "测试消息"
      });
      
      // 如果请求成功，则测试失败
      assert(false, '无效的会话ID应该被拒绝');
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        assert(error.response.status === 400, '无效会话ID应返回400状态码');
        assert(error.response.data.status === 'error', '应返回error状态');
        console.log(`- 正确拒绝无效会话ID: ${safeStringify(error.response.data)}`);
      } else {
        throw error; // 重新抛出非预期的错误
      }
    }
  });
  
  // 显示测试结果
  console.log(`\n${COLORS.bright}测试完成:${COLORS.reset}`);
  console.log(`${COLORS.green}通过: ${passed}${COLORS.reset}`);
  console.log(`${COLORS.red}失败: ${failed}${COLORS.reset}`);
  
  return failed > 0 ? 1 : 0;
}

// 直接运行
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runApiRoutesTest()
    .then(exitCode => {
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('测试执行失败:', error);
      process.exit(1);
    });
}

export { runApiRoutesTest }; 