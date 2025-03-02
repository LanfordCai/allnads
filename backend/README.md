# WenAds AI Agent

基于 TypeScript 和 LangChain.js 的 AI 聊天 API 服务，支持工具调用(MCP)功能。

## 功能特点

- 基于 TypeScript 和 Express 构建的 API 服务
- 使用 LangChain.js 框架集成 AI 模型
- 支持 OpenRouter 作为 LLM 提供商
- 使用 PostgreSQL 和 Drizzle ORM 持久化聊天会话数据
- 集成 Privy 提供强大的用户认证和管理功能
- 支持多MCP服务器配置和动态管理
- 实现工具调用(MCP)功能，支持调用区块链数据查询等工具
- 为 RAG（检索增强生成）集成做好准备

## 项目结构

```
wenads-agent/
├── src/                  # 源代码目录
│   ├── config/           # 配置文件
│   ├── controllers/      # 控制器
│   ├── middleware/       # 中间件
│   ├── models/           # 数据库模型
│   ├── migrations/       # 数据库迁移
│   ├── routes/           # 路由
│   ├── scripts/          # 脚本文件
│   ├── services/         # 服务
│   ├── types/            # 类型定义
│   ├── utils/            # 工具函数
│   └── index.ts          # 应用入口
├── mcp.json              # MCP服务器配置文件
├── .env                  # 环境变量
├── .env.example          # 环境变量示例
├── .gitignore            # Git 忽略文件
├── drizzle.config.ts     # Drizzle ORM 配置
├── DATABASE.md           # 数据库使用说明
├── package.json          # 项目依赖
├── tsconfig.json         # TypeScript 配置
└── README.md             # 项目说明
```

## 开始使用

### 环境要求

- Node.js 18+
- npm 或 yarn
- PostgreSQL 12+

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

4. 设置数据库
```bash
# 创建数据库
psql -U postgres -c "CREATE DATABASE wenads_agent;"

# 创建表结构
npm run db:create-tables
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

## 数据库

项目使用 PostgreSQL 数据库和 Drizzle ORM 进行数据持久化：

- 会话和消息数据保存在数据库，防止服务重启导致数据丢失
- 使用内存缓存提升读取性能
- 支持未来集成 pgvector 实现 RAG 功能

详细的数据库设置和配置说明请参阅 [DATABASE.md](DATABASE.md)。

## 用户认证与管理

本项目使用 Privy 作为用户认证和管理解决方案：

### 特点

- 支持多种认证方式，包括 Web3 钱包、邮箱、社交账户等
- 集成嵌入式钱包功能，无需用户安装额外软件
- 安全的 Token 验证机制
- 简化的用户管理 API

### 配置 Privy

1. 在 [Privy 官网](https://privy.io/) 注册并创建应用
2. 获取应用 ID、API Key 和 API Secret
3. 在 `.env` 文件中配置 Privy 凭据:
   ```
   PRIVY_APP_ID=your_privy_app_id
   PRIVY_API_SECRET=your_privy_api_secret
   ```

### 认证流程

1. 前端使用 Privy 的客户端 SDK 进行用户认证
2. 用户登录后获得 ID 令牌
3. 令牌随请求发送到后端
4. 后端使用中间件验证令牌并提取用户信息

详细的 Privy 集成文档请参考 [Privy 官方文档](https://docs.privy.io/guide/server/)。

## API 端点

### 健康检查
- `GET /api/health` - 健康检查端点

### 聊天API
- `POST /api/chat` - 发送聊天消息
- `GET /api/chat/sessions` - 获取所有会话
- `GET /api/chat/sessions/:sessionId` - 获取会话历史
- `DELETE /api/chat/sessions/:sessionId` - 删除会话
- `POST /api/chat/tools` - 直接调用工具

### 用户API
- `GET /api/users/me` - 获取当前认证用户信息
- `GET /api/users/:userId` - 获取特定用户信息
- `DELETE /api/users/:userId` - 删除用户

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