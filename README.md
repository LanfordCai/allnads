# WenAds AI Agent

基于 TypeScript 和 LangChain.js 的 AI 聊天 API 服务，支持工具调用(MCP)功能。

## 功能特点

- 基于 TypeScript 和 Express 构建的 API 服务
- 使用 LangChain.js 框架集成 AI 模型
- 支持 OpenRouter 作为 LLM 提供商
- 实现工具调用(MCP)功能

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

- `GET /api/health` - 健康检查端点

## 许可证

[MIT](LICENSE) 