import WebSocket from 'ws';
import { ChatService } from '../services/chat';
import { ChatMessage, ChatRequest, ChatRole } from '../types/chat';
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
 * WebSocket Chat Service
 */
export class ChatSocketService {
  private wss: WebSocket.Server;
  private static instance: ChatSocketService;
  
  /**
   * Initialize WebSocket service
   * @param server HTTP server instance
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
   * Extract email and Ethereum wallet address from user identity information
   * @param userIdentity Privy user identity information object
   * @returns Object containing email and wallet address
   */
  private extractUserInfo(user: User): { email: string; ethereumWallet: string; name: string } {
    const email = user.linkedAccounts?.find((account) => account.type === 'email')?.address;
    const ethereumWallet = user.linkedAccounts?.find((account) => account.type === 'wallet')?.address;
    const name = email ? email.split('@')[0] : 'Anonymous';
    return { email: email || 'Anonymous', ethereumWallet: ethereumWallet || 'Anonymous', name };
  }
  
  /**
   * Initialize WebSocket connection handling
   */
  private init(): void {
    // Define WebSocket connection parameter validation schema
    const wsParamsSchema = z.object({
      sessionId: z.string()
        .min(1, { message: "Session ID cannot be empty" })
        .uuid({ message: "Session ID must be a valid UUID format" }),
      accessToken: z.string()
        .min(1, { message: "Authentication token cannot be empty" })
        .regex(
          /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*$/,
          { message: "Authentication token must be a valid JWT format" }
        ),
      idToken: z.string()
        .min(1, { message: "ID token cannot be empty" })
        .regex(
          /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*$/,
          { message: "ID token must be a valid JWT format" }
        ),
      nftTokenId: z.string()
        .min(1, { message: "NFT token ID cannot be empty" }),
      nftAccount: z.string()
        .min(1, { message: "NFT account address cannot be empty" })
        .refine((val) => isAddress(val), { 
          message: "NFT account address must be a valid Ethereum address" 
        }),
      nftMetadata: z.string()
        .min(1, { message: "NFT metadata cannot be empty" })
        .refine((val) => {
          try {
            JSON.parse(val);
            return true;
          } catch (e) {
            return false;
          }
        }, { 
          message: "NFT metadata must be a valid JSON format" 
        })
    });

    this.wss.on('connection', async (socket, request) => {
      try {
        console.log('WebSocket connection request received');
        
        // Parse query parameters
        const queryParams = url.parse(request.url || '', true).query;
        
        // Use Zod to validate parameters
        const paramsResult = wsParamsSchema.safeParse(queryParams);
        
        if (!paramsResult.success) {
          const errorMessages = paramsResult.error.errors.map(err => 
            `${err.path.join('.')}: ${err.message}`
          ).join(', ');
          
          console.log(`WebSocket connection request rejected: Parameter validation failed - ${errorMessages}`);
          socket.send(JSON.stringify({
            type: 'error',
            content: `Invalid connection request parameters: ${errorMessages}`
          }));
          socket.close(4003, 'Parameter validation failed');
          return;
        }
        
        // Extract parameters from validated result
        const { sessionId, accessToken, idToken, nftTokenId, nftAccount, nftMetadata } = paramsResult.data;
        
        console.log(`Session ID: ${sessionId}`);
        
        // Authentication logic: Verify Privy token
        let privyUserId: string;
        let userPrivyWallet: string;
        let userName: string;
        try {
          // Verify Privy access token
          const userData = await privyService.verifyAccessToken(accessToken);
          privyUserId = userData.privyUserId;
          console.log(`User authenticated, Privy user ID: ${privyUserId}`);

          const userIdentity = await privyService.getUserFromIdToken(idToken);
          const { ethereumWallet, name } = this.extractUserInfo(userIdentity);
          userPrivyWallet = ethereumWallet;
          userName = name;
          
          // Send authentication success message to client
          socket.send(JSON.stringify({
            type: 'auth_success',
            privyUserId
          }));
          
        } catch (authError) {
          console.error('Authentication failed:', authError);
          socket.send(JSON.stringify({
            type: 'error',
            content: 'Authentication failed, please log in again'
          }));
          socket.close(4001, 'Authentication failed');
          return;
        }

        // Get or create session
        let session;
        let finalSessionId = sessionId;

        const metadata = JSON.parse(nftMetadata);
        const allNadsName = metadata.name;
        const allNadsTokenId = nftTokenId;
        const allNadsAccount = nftAccount;
        
        // Get system prompt
        const systemPrompt = getSystemPrompt(
          allNadsName, 
          allNadsTokenId, 
          allNadsAccount, 
          nftMetadata, 
          userName, 
          userPrivyWallet
        );

        // Try to get existing session
        session = await SessionService.getSession(sessionId, systemPrompt);
        
        // If session doesn't exist, create a new one
        if (!session) {
          console.log(`Session doesn't exist, creating new session: ${sessionId}`);
          session = await SessionService.createSession(sessionId, systemPrompt, privyUserId);
          finalSessionId = session.id;
        }

        const isOwner = await SessionService.validateSessionOwnership(sessionId, privyUserId);
        if (!isOwner) {
          // If user is not the session owner, return error
          console.warn(`User ${privyUserId} attempted to access a session that doesn't belong to them ${sessionId}`);
          socket.send(JSON.stringify({
            type: 'error',
            content: 'You do not have permission to access this session'
          }));
          socket.close(4003, 'Session access denied');
          return;
        }
        
        console.log(`Final session ID: ${finalSessionId}`);
        console.log('History messages', session.messages);
        console.log(`Session history: ${session.messages.length} messages`);
        
        // Determine if session history is empty (also considered empty if only system prompt message exists)
        const historyIsEmpty = session.messages.length <= 1;
        

        // Only send welcome message when session history is empty
        if (historyIsEmpty) {
          // Define multiple welcome messages
          const welcomeMessages = [
            `Hey there ${userName}! I'm ${allNadsName}, your AllNads NFT assistant. What can I help you with today?`,
            `Welcome back ${userName}! Ready to explore the Monad blockchain together?`,
            `Sup ${userName}! Your friendly NFT ${allNadsName} at your service. Let's make some moves!`,
            `Hello ${userName}! I'm ${allNadsName}, your digital companion. How can I assist you today?`,
            `Yo ${userName}! ${allNadsName} here, ready to help with your crypto adventures!`,
            `Greetings ${userName}! This is ${allNadsName} reporting for duty. What's on your mind?`,
            `Hey ${userName}! ${allNadsName} here. Let's make some magic happen on the blockchain!`
          ];
          
          // Randomly select a welcome message
          const randomWelcomeMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
          
          // Send the randomly selected welcome message
          socket.send(JSON.stringify({
            type: 'assistant_message',
            content: randomWelcomeMessage
          }));

          // Save welcome message to database
          const welcomeMessage: ChatMessage = {
            role: ChatRole.ASSISTANT,
            content: randomWelcomeMessage,
            timestamp: new Date(),
            sessionId: finalSessionId
          };
          
          // Add welcome message to session history
          await SessionService.addMessage(finalSessionId, welcomeMessage);
          console.log(`Welcome message saved to database: ${randomWelcomeMessage}`);
        }

        // Handle messages
        socket.on('message', async (data) => {
          try {
            // Parse client message
            const message = JSON.parse(data.toString());
            
            // Validate message format
            if (!message.text) {
              socket.send(JSON.stringify({
                type: 'error',
                content: 'Invalid message format, missing text field'
              }));
              return;
            }
            
            // Build chat request
            const chatRequest: ChatRequest = {
              sessionId: finalSessionId,
              message: message.text,
              enableTools: message.enableTools !== false // Tools enabled by default
            };
            
            // Process chat request
            const session = await SessionService.getSession(finalSessionId);
            await ChatService.streamChat(chatRequest, socket, session!);
            
          } catch (error) {
            console.error('Error processing message:', error);
            socket.send(JSON.stringify({
              type: 'error',
              content: 'Error processing message'
            }));
          }
        });
        
        // Handle connection close
        socket.on('close', (code, reason) => {
          console.log(`WebSocket connection closed: code=${code}, reason=${reason || 'Not provided'}`);
        });
        
        // Handle errors
        socket.on('error', (error) => {
          console.error('WebSocket error:', error);
        });
        
      } catch (error) {
        console.error('Error handling WebSocket connection:', error);
        socket.send(JSON.stringify({
          type: 'error',
          content: 'Connection initialization failed'
        }));
        socket.close(4000, 'Connection error');
      }
    });
  }
  
  /**
   * Close WebSocket server
   */
  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.wss) {
        resolve();
        return;
      }
      
      this.wss.close((err) => {
        if (err) {
          console.error('Error closing WebSocket server:', err);
          reject(err);
        } else {
          console.log('WebSocket server safely closed');
          resolve();
        }
      });
    });
  }
  
  /**
   * Get service instance
   */
  public static getInstance(): ChatSocketService | undefined {
    return this.instance;
  }
}

/**
 * Initialize chat WebSocket service
 * @param server HTTP server instance
 */
export function initializeChatWebSocket(server: http.Server): ChatSocketService {
  const service = new ChatSocketService(server);
  console.log('Chat WebSocket service initialized');
  return service;
}

/**
 * Close chat WebSocket service
 */
export async function closeChatWebSocket(): Promise<void> {
  const instance = ChatSocketService.getInstance();
  if (instance) {
    await instance.close();
  }
}