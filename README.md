# WenAds AI Agent

基于 TypeScript 和 LangChain.js 的 AI 聊天 API 服务，支持工具调用(MCP)功能。

## 功能特点

- 基于 TypeScript 和 Express 构建的 API 服务
- 使用 LangChain.js 框架集成 AI 模型
- 支持 OpenRouter 作为 LLM 提供商
- 支持多MCP服务器配置和动态管理
- 实现工具调用(MCP)功能，支持调用区块链数据查询等工具

## 项目结构

```
wenads-agent/
├── src/                  # 源代码目录
│   ├── config/           # 配置文件
│   ├── controllers/      # 控制器
│   ├── routes/           # 路由
│   ├── services/         # 服务
│   ├── types/            # 类型定义
│   ├── utils/            # 工具函数
│   └── index.ts          # 应用入口
├── mcp.json              # MCP服务器配置文件
├── .env                  # 环境变量
├── .env.example          # 环境变量示例
├── .gitignore            # Git 忽略文件
├── package.json          # 项目依赖
├── tsconfig.json         # TypeScript 配置
└── README.md             # 项目说明
```

## 开始使用

### 环境要求

- Node.js 18+
- npm 或 yarn

### 安装

1. 克隆仓库
```bash
git clone <repository-url>
cd wenads-agent
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，填写必要的配置
```

### 开发

```bash
npm run dev
```

### 构建

```bash
npm run build
```

### 生产环境运行

```bash
npm start
```

## API 端点

### 健康检查
- `GET /api/health` - 健康检查端点

### 聊天API
- `POST /api/chat` - 发送聊天消息
- `GET /api/chat/sessions` - 获取所有会话
- `GET /api/chat/sessions/:sessionId` - 获取会话历史
- `DELETE /api/chat/sessions/:sessionId` - 删除会话
- `POST /api/chat/tools` - 直接调用工具

### MCP服务管理API
- `GET /api/mcp/servers` - 获取所有MCP服务器
- `GET /api/mcp/tools` - 获取所有工具（可选参数server）
- `POST /api/mcp/servers` - 添加MCP服务器
- `DELETE /api/mcp/servers/:id` - 删除MCP服务器

## MCP 多服务器配置

### 配置文件

MCP服务器配置存储在项目根目录的 `mcp.json` 文件中。该文件包含两个主要部分：

1. `servers`: 服务器列表
2. `settings`: 全局设置

### 服务器配置示例

```json
{
  "servers": [
    {
      "name": "ethereum",
      "url": "https://ethereum-mcp.example.com",
      "description": "以太坊主网MCP服务器"
    },
    {
      "name": "optimism",
      "url": "https://optimism-mcp.example.com",
      "description": "Optimism L2网络MCP服务器"
    }
  ],
  "settings": {
    "defaultServer": "ethereum",
    "connectionTimeout": 30000,
    "callTimeout": 30000,
    "maxRetries": 2,
    "retryInterval": 1000
  }
}
```

### 服务器配置字段

每个服务器配置包含以下字段：

- `name`: 服务器ID，用于在工具调用中引用（格式：`serverId__toolName`）
- `url`: 服务器URL
- `description`: 可选，服务器描述

### 全局设置字段

- `defaultServer`: 默认服务器ID
- `connectionTimeout`: 连接超时时间（毫秒）
- `callTimeout`: 调用超时时间（毫秒）
- `maxRetries`: 最大重试次数
- `retryInterval`: 重试间隔时间（毫秒）

### 工具调用方式

调用工具时，使用`serverId__toolName`格式指定工具:

```json
{
  "toolName": "ethereum__evm_gas_price",
  "args": {
    "chain": "ethereum"
  }
}
```

## 许可证

[MIT](LICENSE) 