/**
 * 系统提示配置
 */

// 默认系统提示
export const DEFAULT_SYSTEM_PROMPT = `
你是一个区块链助手，可以帮助用户了解区块链信息并使用区块链工具。请使用简洁专业的语言回答问题，并在适当时机使用可用的工具，请优先从提供给你的 tools 中选择。
`;

/**
 * 获取系统提示
 * @returns 系统提示
 */
export function getSystemPrompt(): string {
  return DEFAULT_SYSTEM_PROMPT;
} 