// NFT service to handle NFT-related API requests
import { usePrivyTokens } from '../hooks/usePrivyTokens';

/**
 * API response interface for standardized server responses
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code?: string;
    details?: unknown;
  };
}

/**
 * Custom error for authentication issues
 */
export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Service to handle NFT-related operations
 */
export class NFTService {
  private static BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  private static getTokens: () => Promise<{ accessToken: string | null; identityToken: string | null }>;

  /**
   * Initialize the service with the token getter
   */
  static initialize(tokenGetter: () => Promise<{ accessToken: string | null; identityToken: string | null }>) {
    this.getTokens = tokenGetter;
  }

  /**
   * Get authentication headers
   * @throws {AuthenticationError} If user is not authenticated
   */
  private static async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.getTokens) {
      throw new AuthenticationError('NFTService not initialized');
    }

    const { accessToken, identityToken } = await this.getTokens();
    if (!accessToken || !identityToken) {
      throw new AuthenticationError();
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'x-privy-token': identityToken
    };
  }

  /**
   * Fetch all NFT templates
   * @returns Promise with API response containing templates data
   * @throws {AuthenticationError} If user is not authenticated
   */
  static async fetchTemplates(): Promise<ApiResponse<{ templates: Record<string, any[]> }>> {
    console.log('Fetching templates from API');
    
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${this.BASE_URL}/nft/templates`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        console.error(`Templates fetch failed with status: ${response.status} ${response.statusText}`);
        throw new Error(`Error fetching templates: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Templates fetch response:', data);
      return data;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return {
          success: false,
          message: 'Please log in to view templates',
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            details: error.message
          }
        };
      }
      console.error('Error fetching templates:', error);
      throw error;
    }
  }

  /**
   * Check if a user has an NFT
   * @param address Ethereum address to check
   * @returns Promise with API response containing hasNFT data
   * @throws {AuthenticationError} If user is not authenticated
   */
  static async checkNFT(address: string): Promise<ApiResponse<{ hasNFT: boolean }>> {
    console.log(`Checking NFT for address: ${address}`);
    console.log(`API URL: ${this.BASE_URL}/nft/check/${address}`);

    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${this.BASE_URL}/nft/check/${address}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        console.error(`NFT check failed with status: ${response.status} ${response.statusText}`);
        throw new Error(`Error checking NFT: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('NFT check response:', data);
      return data;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return {
          success: false,
          message: 'Please log in to check NFT ownership',
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            details: error.message
          }
        };
      }
      console.error('Error checking NFT:', error);
      throw error;
    }
  }

  /**
   * Request an NFT airdrop
   * @param walletAddress User's wallet address
   * @param nftName Optional name for the NFT (default: 'AllNads Avatar')
   * @returns Promise with the airdrop result
   * @throws {AuthenticationError} If user is not authenticated
   */
  static async airdropNFT(
    walletAddress: string,
    nftName: string = 'AllNads Avatar'
  ): Promise<ApiResponse<{ success: boolean, message: string }>> {
    console.log(`Requesting airdrop for address: ${walletAddress}`);
    console.log(`API URL: ${this.BASE_URL}/nft/airdrop`);
    console.log(`NFT Name: ${nftName}`);

    try {
      const headers = await this.getAuthHeaders();

      const requestBody = { 
        address: walletAddress,
        name: nftName
      };
      console.log('Request body:', requestBody);

      const response = await fetch(`${this.BASE_URL}/nft/airdrop`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      console.log('Airdrop response status:', response.status, response.statusText);

      if (!response.ok) {
        let errorMessage = `Error requesting airdrop: ${response.statusText}`;
        try {
          const errorData = await response.json();
          console.error('Error data:', errorData);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          console.error('Could not parse error response as JSON', e);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Airdrop response data:', data);
      return data;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return {
          success: false,
          message: 'Please log in to request an airdrop',
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            details: error.message
          }
        };
      }
      console.error('Error requesting NFT airdrop:', error);
      throw error;
    }
  }
} 