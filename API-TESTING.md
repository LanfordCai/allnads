# API 测试文档

本文档提供有关API测试工具的使用说明和API接口的预期格式。

## 测试工具使用

我们提供了多种测试方式，可以通过以下命令运行：

```bash
# 运行服务层集成测试
./test-api.sh integration

# 运行交互式API测试（命令行聊天界面）
./test-api.sh interactive

# 运行API路由测试（HTTP API测试）
./test-api.sh api-routes
```

### 环境配置

测试工具会自动检查并创建`.env`文件，包含以下配置项：

```
LLM_MODEL=anthropic/claude-3.5-sonnet  # 使用的LLM模型
MCP_SERVER_URL=http://localhost:8080/sse  # MCP服务器URL
MCP_SERVER_NAME=evm_tool  # MCP服务器名称
API_BASE_URL=http://localhost:3000/api  # API基础URL
SERVICE_API_KEY=test-api-key  # API密钥
```

请根据您的环境修改这些配置。

## API接口说明

以下是API接口的预期格式和使用方法。

### 1. 健康检查

**请求:**
```
GET /api/health
```

**响应示例:**
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

### 2. 获取可用工具

**请求:**
```
GET /api/tools
```

**响应示例:**
```json
{
  "tools": [
    {
      "name": "mcp__evm_tool__evm_gas_price",
      "description": "获取EVM区块链的当前gas价格",
      "parameters": {
        "chain": {
          "type": "string",
          "description": "区块链名称，如ethereum, polygon等"
        }
      }
    },
    // 更多工具...
  ]
}
```

### 3. 聊天接口

**请求:**
```
POST /api/chat
```

**请求体:**
```json
{
  "messages": [
    {
      "role": "system",
      "content": "你是一个有用的助手"
    },
    {
      "role": "user",
      "content": "你好，今天天气怎么样？"
    }
  ],
  "tools": true,       // 可选，是否启用工具调用
  "stream": false,     // 可选，是否使用流式响应
  "sessionId": "xxx"   // 可选，会话ID
}
```

**响应示例 (非流式):**
```json
{
  "response": {
    "role": "assistant",
    "content": "我无法查看实时天气，因为我没有联网能力。请您查看天气预报或看看窗外了解今天的天气情况。"
  }
}
```

**响应示例 (带工具调用):**
```json
{
  "response": {
    "role": "assistant",
    "content": "以太坊当前的gas价格为..."
  },
  "toolCalls": [
    {
      "name": "mcp__evm_tool__evm_gas_price",
      "args": {
        "chain": "ethereum"
      },
      "result": "{ ... gas价格信息 ... }"
    }
  ]
}
```

**流式响应:**
返回`text/event-stream`类型的数据流，格式如下：
```
data: {"delta": {"content": "我无法"}, "finish_reason": null}

data: {"delta": {"content": "查看实时天气"}, "finish_reason": null}

...

data: {"delta": {}, "finish_reason": "stop"}
```

### 4. 直接工具调用

**请求:**
```
POST /api/chat/tools
```

**请求体:**
```json
{
  "toolName": "mcp__evm_tool__evm_gas_price",
  "args": {
    "chain": "ethereum"
  }
}
```

**响应示例:**
```json
{
  "result": {
    // 工具调用结果
    "gasPrice": "1.5 Gwei",
    "maxFeePerGas": "2.3 Gwei",
    "maxPriorityFeePerGas": "0.1 Gwei"
  },
  "isError": false
}
```

### 5. 会话管理

**创建会话:**
```
POST /api/sessions
```

**请求体:**
```json
{
  "name": "测试会话"
}
```

**响应示例:**
```json
{
  "sessionId": "sess_12345",
  "name": "测试会话",
  "createdAt": "2023-06-15T10:30:00Z"
}
```

**获取会话历史:**
```
GET /api/sessions/{sessionId}/history
```

**响应示例:**
```json
{
  "sessionId": "sess_12345",
  "messages": [
    {
      "role": "user",
      "content": "你好",
      "timestamp": "2023-06-15T10:31:00Z"
    },
    {
      "role": "assistant",
      "content": "你好！有什么我可以帮助你的吗？",
      "timestamp": "2023-06-15T10:31:02Z"
    }
    // 更多消息...
  ]
}
```

## 错误处理

API返回标准HTTP状态码：

- 200 OK: 请求成功
- 400 Bad Request: 请求参数错误
- 401 Unauthorized: 未授权（API密钥无效）
- 404 Not Found: 资源不存在
- 500 Internal Server Error: 服务器内部错误

错误响应格式示例：

```json
{
  "error": "Invalid arguments: 'address' is required",
  "errorType": "INVALID_ARGUMENTS",
  "statusCode": 400
}
```

## 测试注意事项

1. **API测试前提**：确保API服务已启动并正在监听对应端口
2. **MCP服务依赖**：确保MCP服务器已启动并可访问，否则工具调用测试将失败
3. **超时设置**：长时间运行的测试可能需要调整超时参数（在`.env`中）
4. **授权测试**：确保`SERVICE_API_KEY`配置正确，否则授权测试将无法模拟实际情况

## 自定义测试

如需自定义测试，可以修改以下文件：

- `src/tests/api-routes.test.ts`: HTTP API测试
- `src/tests/integration.test.ts`: 服务层集成测试
- `src/scripts/api-test.ts`: 交互式测试工具 