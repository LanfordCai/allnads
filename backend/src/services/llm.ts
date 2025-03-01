import { ChatOpenAI } from '@langchain/openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { env } from '../config/env';

/**
 * 创建一个基于 OpenRouter 的 LLM 客户端
 * OpenRouter 允许通过 OpenAI 兼容接口访问多种模型
 */
export function createLLM(): BaseChatModel {
  // 检查必要的环境变量
  if (!env.OPENROUTER_API_KEY) {
    throw new Error('Missing OPENROUTER_API_KEY environment variable');
  }
  
  if (!env.OPENROUTER_MODEL) {
    throw new Error('Missing OPENROUTER_MODEL environment variable');
  }

  // 配置 OpenRouter LLM
  return new ChatOpenAI({
    openAIApiKey: env.OPENROUTER_API_KEY,
    modelName: env.OPENROUTER_MODEL,
    temperature: 0.7,
    maxTokens: 2000,
    verbose: env.NODE_ENV === 'development',
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://wenads-agent',
        'X-Title': 'WenAds Agent',
      },
    },
  });
}

// 导出单例实例
export const llm = createLLM(); 