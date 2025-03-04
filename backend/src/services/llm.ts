import { ChatOpenAI } from '@langchain/openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { env } from '../config/env';

/**
 * Create an OpenRouter-based LLM client
 * OpenRouter allows access to multiple models through an OpenAI-compatible interface
 */
export function createLLM(): BaseChatModel {
  // Check required environment variables
  if (!env.OPENROUTER_API_KEY) {
    throw new Error('Missing OPENROUTER_API_KEY environment variable');
  }
  
  if (!env.OPENROUTER_MODEL) {
    throw new Error('Missing OPENROUTER_MODEL environment variable');
  }

  // Configure OpenRouter LLM
  return new ChatOpenAI({
    openAIApiKey: env.OPENROUTER_API_KEY,
    modelName: env.OPENROUTER_MODEL,
    temperature: 0.7,
    maxTokens: 2000,
    verbose: env.NODE_ENV === 'development',
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'X-Title': 'AllNads',
      },
    },
  });
}

// Export singleton instance
export const llm = createLLM(); 