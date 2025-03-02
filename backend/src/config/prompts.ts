/**
 * 系统提示配置
 */

// 默认系统提示
export const DEFAULT_SYSTEM_PROMPT = `
你是一个区块链助手，可以帮助用户了解区块链信息并使用区块链工具。请使用简洁专业的语言回答问题。
需要查询外部数据或者执行操作时，请仔细检查在提供给你的工具中了解是否有可以使用的，绝对不要自己编造数据。
`;

/**
 * 获取系统提示
 * @returns 系统提示
 */
export function getSystemPrompt(): string {
  return DEFAULT_SYSTEM_PROMPT;
} 