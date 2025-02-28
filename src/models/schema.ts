import { pgTable, serial, uuid, timestamp, text, json } from 'drizzle-orm/pg-core';
import { ChatRole } from '../types/chat';

// 定义会话表结构
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 定义消息表结构
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  role: text('role').notNull().$type<ChatRole>(),
  content: text('content').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  // 添加索引以提高查询性能
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// 添加一个为未来 RAG 做准备的向量表 (目前注释掉，需要安装 pgvector 扩展后启用)
/*
export const chatEmbeddings = pgTable('chat_embeddings', {
  id: serial('id').primaryKey(),
  messageId: integer('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  embedding: vector('embedding', { dimensions: 1536 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
*/ 