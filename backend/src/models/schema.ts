import { pgTable, serial, uuid, timestamp, text, json, varchar, jsonb, boolean } from 'drizzle-orm/pg-core';
import { ChatRole } from '../types/chat';

// Define session table structure
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().notNull(),
  privyUserId: varchar('privy_user_id', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Define message table structure
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  role: text('role').notNull().$type<ChatRole>(),
  content: text('content').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  toolCallId: varchar('tool_call_id', { length: 255 }),
  toolName: varchar('tool_name', { length: 255 }),
  // Add index to improve query performance
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Add a vector table for future RAG preparation (currently commented out, requires pgvector extension to be enabled)
/*
export const chatEmbeddings = pgTable('chat_embeddings', {
  id: serial('id').primaryKey(),
  messageId: integer('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  embedding: vector('embedding', { dimensions: 1536 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
*/

// User address book table - stores addresses saved by users
export const addressBook = pgTable('address_book', {
  id: serial('id').primaryKey(),
  privyUserId: varchar('privy_user_id', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  address: varchar('address', { length: 255 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// User reward claim records table - tracks the claim status of user NFTs and MON tokens
export const userClaims = pgTable('user_claims', {
  id: serial('id').primaryKey(),
  privyUserId: varchar('privy_user_id', { length: 255 }).notNull(),
  address: varchar('address', { length: 255 }).notNull(),
  hasClaimedNFT: boolean('has_claimed_nft').notNull().default(false),
  nftClaimTxId: varchar('nft_claim_tx_id', { length: 255 }),
  nftClaimDate: timestamp('nft_claim_date'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}); 