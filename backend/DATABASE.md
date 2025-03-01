# 数据库配置与使用指南

本项目使用 PostgreSQL 数据库和 Drizzle ORM 来持久化聊天会话数据。以下是设置和使用说明。

## 数据库设置

### 1. 安装 PostgreSQL

如果您尚未安装 PostgreSQL，请按照以下步骤安装：

- **MacOS**:
  ```bash
  brew install postgresql@15
  brew services start postgresql@15
  ```

- **Linux (Ubuntu/Debian)**:
  ```bash
  sudo apt update
  sudo apt install postgresql postgresql-contrib
  sudo systemctl start postgresql
  ```

- **Windows**:
  从 [PostgreSQL官网](https://www.postgresql.org/download/windows/) 下载安装包

### 2. 创建数据库

创建用于存储聊天数据的数据库：

```bash
# 连接到PostgreSQL
psql -U postgres

# 在PostgreSQL命令行中
CREATE DATABASE wenads_agent;
```

### 3. 配置环境变量

在项目根目录的 `.env` 文件中配置数据库连接信息（已经添加了默认配置）：

```
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres  # 修改为您的实际密码
POSTGRES_DB=wenads_agent
```

## 数据库初始化

项目包含创建必要表结构的脚本。运行以下命令初始化数据库：

```bash
npm run db:create-tables
```

这将创建以下表：
- `sessions` - 存储聊天会话
- `messages` - 存储聊天消息，与会话关联

## 数据库操作命令

项目提供了以下与数据库相关的命令：

- **创建表结构**:
  ```bash
  npm run db:create-tables
  ```

- **生成迁移文件** (用于模式变更):
  ```bash
  npm run db:generate
  ```

- **执行迁移**:
  ```bash
  npm run db:migrate
  ```

- **启动数据库管理界面**:
  ```bash
  npm run db:studio
  ```

## 未来的 RAG 集成

该数据库设计已为未来集成检索增强生成 (RAG) 做好准备。要启用向量存储功能，您需要：

1. 在 PostgreSQL 中安装 pgvector 扩展：
   ```sql
   CREATE EXTENSION vector;
   ```

2. 取消注释 `src/models/schema.ts` 中的向量表定义：
   ```typescript
   export const chatEmbeddings = pgTable('chat_embeddings', {
     id: serial('id').primaryKey(),
     messageId: integer('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
     embedding: vector('embedding', { dimensions: 1536 }).notNull(),
     createdAt: timestamp('created_at').notNull().defaultNow(),
   });
   ```

3. 运行初始化表结构的命令。

## 数据库模型

### 会话表 (sessions)
- `id`: UUID - 主键
- `created_at`: 创建时间戳
- `updated_at`: 更新时间戳

### 消息表 (messages)
- `id`: 自增整数 - 主键
- `session_id`: UUID - 外键，关联到会话表
- `role`: 文本 - 消息角色 (用户/系统/助手)
- `content`: 文本 - 消息内容
- `timestamp`: 时间戳 - 消息时间
- `created_at`: 时间戳 - 记录创建时间 