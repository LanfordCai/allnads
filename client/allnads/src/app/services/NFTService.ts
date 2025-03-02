// NFT service to handle NFT-related API requests

/**
 * API response interface for standardized server responses
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code?: string;
    details?: any;
  };
}

/**
 * Service to handle NFT-related operations
 */
export class NFTService {
  private static BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

  /**
   * Check if a user has an NFT
   * @param address Ethereum address to check
   * @returns Promise with API response containing hasNFT data
   */
  static async checkNFT(address: string): Promise<ApiResponse<{ hasNFT: boolean }>> {
    console.log(`Checking NFT for address: ${address}`);
    console.log(`API URL: ${this.BASE_URL}/nft/check/${address}`);

    try {
      const response = await fetch(`${this.BASE_URL}/nft/check/${address}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`NFT check failed with status: ${response.status} ${response.statusText}`);
        throw new Error(`Error checking NFT: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('NFT check response:', data);
      return data;
    } catch (error: any) {
      console.error('Error checking NFT:', error);
      throw error;
    }
  }

  /**
   * Request an NFT airdrop - requires authentication
   * @param walletAddress User's wallet address
   * @param identityToken Privy identity token from useIdentityToken hook
   * @param nftName Optional name for the NFT (default: 'AllNads Avatar')
   * @returns Promise with the airdrop result
   */
  static async airdropNFT(
    walletAddress: string, 
    identityToken?: string,
    nftName: string = 'AllNads Avatar'
  ): Promise<ApiResponse<{ success: boolean, message: string }>> {
    console.log(`Requesting airdrop for address: ${walletAddress}`);
    console.log(`API URL: ${this.BASE_URL}/nft/airdrop`);
    console.log(`NFT Name: ${nftName}`);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add identity token if provided
      if (identityToken) {
        console.log('Using provided identity token');
        headers['x-privy-token'] = identityToken;
      }

      const requestBody = { 
        address: walletAddress,
        name: nftName
      };
      console.log('Request body:', requestBody);

      // Make the request
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
    } catch (error: any) {
      console.error('Error requesting NFT airdrop:', error);
      throw error;
    }
  }
} 