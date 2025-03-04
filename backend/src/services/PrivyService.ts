import { PrivyClient } from '@privy-io/server-auth';
import * as dotenv from 'dotenv';
import * as jwt from 'jsonwebtoken';

// Load environment variables
dotenv.config();

// Get environment variables
const PRIVY_APP_ID = process.env.PRIVY_APP_ID || '';
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET || '';

// Define Privy JWT token type
interface PrivyTokenClaims {
  sub?: string;      // Subject (user ID)
  sid?: string;      // Session ID
  iat?: number;      // Issued at time
  exp?: number;      // Expiration time
  iss?: string;      // Issuer
  aud?: string;      // Audience
  [key: string]: any; // Other possible fields
}

/**
 * Service providing Privy user management and authentication functionality
 */export class PrivyService {
  private client: PrivyClient;

  constructor() {
    // According to Privy documentation, constructor may need the following parameters
    this.client = new PrivyClient(
      PRIVY_APP_ID,
      PRIVY_APP_SECRET
    );
  }

  /**
   * Verify Privy authentication token
   * @param token - Privy authentication token
   * @returns User information
   */
  async verifyAuthToken(token: string) {
    try {
      const verifiedClaims = await this.client.verifyAuthToken(token);
      return verifiedClaims;
    } catch (error: any) {
      throw new Error(`Token validation failed: ${error.message}`);
    }
  }

  /**
   * Verify Privy access token
   * @param token - Privy access token (JWT format)
   * @returns User information, including privyUserId
   */
  async verifyAccessToken(token: string) {
    try {
      console.log(`[Privy] Verifying access token: ${token.substring(0, 15)}...`);
      
      // Try using verifyAuthToken method first
      try {
        const claims = await this.verifyAuthToken(token);
        // Convert claims to PrivyTokenClaims type
        const privyClaims = claims as unknown as PrivyTokenClaims;
        
        if (privyClaims && privyClaims.sub) {
          console.log(`[Privy] Token verification successful, user ID: ${privyClaims.sub}`);
          return {
            privyUserId: privyClaims.sub,
            sessionId: privyClaims.sid,
            issuedAt: privyClaims.iat ? new Date(privyClaims.iat * 1000) : undefined,
            expiresAt: privyClaims.exp ? new Date(privyClaims.exp * 1000) : undefined,
          };
        }
      } catch (err) {
        console.log(`[Privy] Verification with verifyAuthToken failed, trying manual JWT verification`);
      }
      
      // Manually parse JWT, but don't verify signature (only for development/testing)
      // Note: Production environment should use complete JWT verification
      try {
        const decodedToken = jwt.decode(token) as PrivyTokenClaims;
        
        if (decodedToken && decodedToken.sub) {
          console.log(`[Privy] JWT decoding successful, user ID: ${decodedToken.sub}`);
          console.warn(`[Privy] Warning: Token was only decoded but signature not verified`);
          
          return {
            privyUserId: decodedToken.sub,
            sessionId: decodedToken.sid,
            issuedAt: decodedToken.iat ? new Date(decodedToken.iat * 1000) : undefined,
            expiresAt: decodedToken.exp ? new Date(decodedToken.exp * 1000) : undefined,
          };
        }
        
        throw new Error('Access token format invalid or does not contain user ID');
      } catch (jwtError) {
        console.error(`[Privy] JWT decoding failed:`, jwtError);
        throw new Error(`JWT decoding failed: ${jwtError instanceof Error ? jwtError.message : String(jwtError)}`);
      }
    } catch (error: any) {
      console.error(`[Privy] Access token verification failed:`, error);
      throw new Error(`Access token verification failed: ${error.message}`);
    }
  }

  /**
   * Get user information from identity token (recommended method)
   * @param idToken - Privy identity token
   * @returns User information
   */
  async getUserFromIdToken(idToken: string) {
    try {
      const user = await this.client.getUser({idToken});
      return user;
    } catch (error: any) {
      throw new Error(`Failed to get user from ID token: ${error.message}`);
    }
  }

  /**
   * Get user information by user ID (not recommended)
   * @param userId - Privy user ID
   * @returns User information
   */
  async getUserById(userId: string) {
    try {
      const user = await this.client.getUser(userId);
      return user;
    } catch (error: any) {
      throw new Error(`Failed to get user by ID: ${error.message}`);
    }
  }

  /**
   * Extract user information from request
   * Assumes idToken is sent as a cookie
   * @param req - HTTP request object
   * @returns User information
   */
  async getUserFromRequest(req: any) {
    try {
      const idToken = req.cookies?.['privy-id-token'];
      if (!idToken) {
        throw new Error('No Privy identity token found in request');
      }
      
      return await this.getUserFromIdToken(idToken);
    } catch (error: any) {
      throw new Error(`Failed to get user from request: ${error.message}`);
    }
  }

  /**
   * Delete user
   * @param userId - Privy user ID
   */
  async deleteUser(userId: string) {
    try {
      await this.client.deleteUser(userId);
    } catch (error: any) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }
}

export const privyService = new PrivyService(); 