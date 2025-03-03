export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'bot' | 'thinking' | 'system' | 'tool' | 'error' | 'transaction_to_sign';
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  lastActivity: Date;
}

export interface WalletInfo {
  balance: string;
  username: string;
  avatarUrl: string;
} 