import WebSocket from 'ws';
import { ChatService } from '../services/chat';
import { ChatRequest } from '../types/chat';
import http from 'http';
import url from 'url';
import { getSystemPrompt } from '../config/prompts';
import { SessionService } from '../services/session';
import { v4 as uuidv4 } from 'uuid';
import { privyService } from '../services/PrivyService';
import { z } from 'zod';
import { isAddress } from 'viem';
import { User } from '@privy-io/server-auth';
/**
 * WebSocket聊天服务
 */
export class ChatSocketService {
  private wss: WebSocket.Server;
  private static instance: ChatSocketService;
  
  /**
   * 初始化WebSocket服务
   * @param server HTTP服务器实例
   */
  constructor(server: http.Server) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/ws'
    });
    this.init();
    ChatSocketService.instance = this;
  }

  /**
   * 从用户身份信息中提取电子邮件和以太坊钱包地址
   * @param userIdentity Privy用户身份信息对象
   * @returns 包含电子邮件和钱包地址的对象
   */
  private extractUserInfo(user: User): { email: string; ethereumWallet: string; name: string } {
    const email = user.linkedAccounts?.find((account) => account.type === 'email')?.address;
    const ethereumWallet = user.linkedAccounts?.find((account) => account.type === 'wallet')?.address;
    const name = email ? email.split('@')[0] : 'Anonymous';
    return { email: email || 'Anonymous', ethereumWallet: ethereumWallet || 'Anonymous', name };
  }
  
  /**
   * 初始化WebSocket连接处理
   */
  private init(): void {
    // 定义WebSocket连接参数验证模式
    const wsParamsSchema = z.object({
      sessionId: z.string()
        .min(1, { message: "会话ID不能为空" })
        .uuid({ message: "会话ID必须是有效的UUID格式" }),
      accessToken: z.string()
        .min(1, { message: "认证令牌不能为空" })
        .regex(
          /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*$/,
          { message: "认证令牌必须是有效的JWT格式" }
        ),
      idToken: z.string()
        .min(1, { message: "ID令牌不能为空" })
        .regex(
          /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*$/,
          { message: "ID令牌必须是有效的JWT格式" }
        ),
      nftTokenId: z.string()
        .min(1, { message: "NFT令牌ID不能为空" }),
      nftAccount: z.string()
        .min(1, { message: "NFT账户地址不能为空" })
        .refine((val) => isAddress(val), { 
          message: "NFT账户地址必须是有效的以太坊地址" 
        }),
      nftMetadata: z.string()
        .min(1, { message: "NFT元数据不能为空" })
        .refine((val) => {
          try {
            JSON.parse(val);
            return true;
          } catch (e) {
            return false;
          }
        }, { 
          message: "NFT元数据必须是有效的JSON格式" 
        })
    });

    this.wss.on('connection', async (socket, request) => {
      try {
        console.log('WebSocket连接请求已接收');
        
        // 解析查询参数
        const queryParams = url.parse(request.url || '', true).query;
        
        // 使用Zod验证参数
        const paramsResult = wsParamsSchema.safeParse(queryParams);
        
        if (!paramsResult.success) {
          const errorMessages = paramsResult.error.errors.map(err => 
            `${err.path.join('.')}: ${err.message}`
          ).join(', ');
          
          console.log(`WebSocket连接请求被拒绝：参数验证失败 - ${errorMessages}`);
          socket.send(JSON.stringify({
            type: 'error',
            content: `连接请求参数无效: ${errorMessages}`
          }));
          socket.close(4003, '参数验证失败');
          return;
        }
        
        // 从验证后的结果中提取参数
        const { sessionId, accessToken, idToken, nftTokenId, nftAccount, nftMetadata } = paramsResult.data;
        
        console.log(`会话ID: ${sessionId}`);
        
        // 鉴权逻辑：验证Privy令牌
        let privyUserId: string;
        let userPrivyWallet: string;
        let userName: string;
        try {
          // 验证Privy访问令牌
          const userData = await privyService.verifyAccessToken(accessToken);
          privyUserId = userData.privyUserId;
          console.log(`用户已认证，Privy用户ID: ${privyUserId}`);

          const userIdentity = await privyService.getUserFromIdToken(idToken);
          const { ethereumWallet, name } = this.extractUserInfo(userIdentity);
          userPrivyWallet = ethereumWallet;
          userName = name;
          
          // 向客户端发送认证成功消息
          socket.send(JSON.stringify({
            type: 'auth_success',
            privyUserId
          }));
          
        } catch (authError) {
          console.error('认证失败:', authError);
          socket.send(JSON.stringify({
            type: 'error',
            content: '认证失败，请重新登录'
          }));
          socket.close(4001, '认证失败');
          return;
        }

        // 获取或创建会话
        let session;
        let finalSessionId = sessionId;

        const metadata = JSON.parse(nftMetadata);
        const allNadsName = metadata.name;
        const allNadsTokenId = nftTokenId;
        const allNadsAccount = nftAccount;
        
        // 获取系统提示词
        const systemPrompt = getSystemPrompt(
          allNadsName, 
          allNadsTokenId, 
          allNadsAccount, 
          nftMetadata, 
          userName, 
          userPrivyWallet
        );

        // 尝试获取现有会话
        session = await SessionService.getSession(sessionId, systemPrompt);
        
        // 如果会话不存在，则创建一个新会话
        if (!session) {
          console.log(`会话不存在，创建新会话: ${sessionId}`);
          session = await SessionService.createSession(sessionId, systemPrompt, privyUserId);
          finalSessionId = session.id;
        }

        const isOwner = await SessionService.validateSessionOwnership(sessionId, privyUserId);
        if (!isOwner) {
          // 如果用户不是会话所有者，返回错误
          console.warn(`用户 ${privyUserId} 尝试访问不属于他的会话 ${sessionId}`);
          socket.send(JSON.stringify({
            type: 'error',
            content: '您无权访问此会话'
          }));
          socket.close(4003, '会话访问被拒绝');
          return;
        }
        
        console.log(`最终会话ID: ${finalSessionId}`);
        console.log('历史消息', session.messages);
        console.log(`会话历史: ${session.messages.length} 条消息`);
        
        // 判断会话历史是否为空(只有系统提示消息时也视为空)
        const historyIsEmpty = session.messages.length <= 1;
        
        // 只在会话历史为空时发送欢迎消息
        if (historyIsEmpty) {
          console.log('sent welcome message');
          socket.send(JSON.stringify({
            type: 'connected',
            sessionId: finalSessionId,
            content: `👋 欢迎使用聊天服务！您已登录。您的会话ID是: ${finalSessionId}。现在可以开始聊天了，请在输入框中输入您的问题。服务器将使用区块链工具帮助您解答疑问。`
          }));
        }

        // 处理消息
        socket.on('message', async (data) => {
          try {
            // 解析客户端消息
            const message = JSON.parse(data.toString());
            
            // 验证消息格式
            if (!message.text) {
              socket.send(JSON.stringify({
                type: 'error',
                content: '无效的消息格式，缺少text字段'
              }));
              return;
            }
            
            // 构建聊天请求
            const chatRequest: ChatRequest = {
              sessionId: finalSessionId,
              message: message.text,
              enableTools: message.enableTools !== false // 默认启用工具
            };
            
            // 处理聊天请求
            const session = await SessionService.getSession(finalSessionId);
            await ChatService.streamChat(chatRequest, socket, session!);
            
          } catch (error) {
            console.error('处理消息时出错:', error);
            socket.send(JSON.stringify({
              type: 'error',
              content: '处理消息时出错'
            }));
          }
        });
        
        // 处理关闭连接
        socket.on('close', (code, reason) => {
          console.log(`WebSocket连接已关闭: 代码=${code}, 原因=${reason || '未提供'}`);
        });
        
        // 处理错误
        socket.on('error', (error) => {
          console.error('WebSocket错误:', error);
        });
        
      } catch (error) {
        console.error('WebSocket连接处理出错:', error);
        socket.send(JSON.stringify({
          type: 'error',
          content: '连接初始化失败'
        }));
        socket.close(4000, '连接错误');
      }
    });
  }
  
  /**
   * 关闭WebSocket服务器
   */
  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.wss) {
        resolve();
        return;
      }
      
      this.wss.close((err) => {
        if (err) {
          console.error('关闭WebSocket服务器时出错:', err);
          reject(err);
        } else {
          console.log('WebSocket服务器已安全关闭');
          resolve();
        }
      });
    });
  }
  
  /**
   * 获取服务实例
   */
  public static getInstance(): ChatSocketService | undefined {
    return this.instance;
  }
}

/**
 * 初始化聊天WebSocket服务
 * @param server HTTP服务器实例
 */
export function initializeChatWebSocket(server: http.Server): ChatSocketService {
  const service = new ChatSocketService(server);
  console.log('聊天WebSocket服务已初始化');
  return service;
}

/**
 * 关闭聊天WebSocket服务
 */
export async function closeChatWebSocket(): Promise<void> {
  const instance = ChatSocketService.getInstance();
  if (instance) {
    await instance.close();
  }
}