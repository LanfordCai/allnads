import { pgTable, serial, uuid, timestamp, text, json, varchar, jsonb, boolean } from 'drizzle-orm/pg-core';
import { ChatRole } from '../types/chat';

// 定义会话表结构
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().notNull(),
  privyUserId: varchar('privy_user_id', { length: 255 }),
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
  toolCallId: varchar('tool_call_id', { length: 255 }),
  toolName: varchar('tool_name', { length: 255 }),
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

// 用户引用表 - 关联 Privy 用户和应用内数据
export const userReferences = pgTable('user_references', {
  id: serial('id').primaryKey(),
  privyUserId: varchar('privy_user_id', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 255 }),
  email: varchar('email', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
  metadata: jsonb('metadata'),
});

// 用户地址簿表 - 存储用户保存的地址
export const addressBook = pgTable('address_book', {
  id: serial('id').primaryKey(),
  privyUserId: varchar('privy_user_id', { length: 255 }).notNull().references(() => userReferences.privyUserId, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  address: varchar('address', { length: 255 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 用户奖励领取记录表 - 记录用户NFT和MON代币的领取状态
export const userClaims = pgTable('user_claims', {
  id: serial('id').primaryKey(),
  privyUserId: varchar('privy_user_id', { length: 255 }).notNull().references(() => userReferences.privyUserId, { onDelete: 'cascade' }),
  address: varchar('address', { length: 255 }).notNull(),
  hasClaimedNFT: boolean('has_claimed_nft').notNull().default(false),
  nftClaimTxId: varchar('nft_claim_tx_id', { length: 255 }),
  nftClaimDate: timestamp('nft_claim_date'),
  hasClaimedMON: boolean('has_claimed_mon').notNull().default(false),
  monClaimTxId: varchar('mon_claim_tx_id', { length: 255 }),
  monClaimDate: timestamp('mon_claim_date'),
  monClaimAmount: varchar('mon_claim_amount', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}); 