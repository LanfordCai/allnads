import { createPublicClient, createWalletClient, http, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';

dotenv.config();

// Simplified ABIs with only the functions we need
const AllNadsABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

const AllNadsAirdropperABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "backgroundTemplateId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "hairstyleTemplateId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "eyesTemplateId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "mouthTemplateId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "accessoryTemplateId",
        "type": "uint256"
      }
    ],
    "name": "mintTo",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
];

// Network configurations
const NETWORKS = {
  monadTestnet: {
    chain: {
      id: 10143,
      name: 'Monad Testnet',
      network: 'monadTestnet',
      nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
      rpcUrls: {
        default: { http: [process.env.MONAD_TESTNET_RPC as string] }
      }
    },
    allnadsAddress: process.env.MONAD_TESTNET_ALLNADS_CONTRACT_ADDRESS as Address,
    airdropperAddress: process.env.MONAD_TESTNET_AIRDROPPER_CONTRACT_ADDRESS as Address,
    privateKey: process.env.MONAD_AIRDROPPER_PRIVATE_KEY
  }
};

// Component types mapping
const COMPONENT_TYPES = {
  BACKGROUND: 0,
  HAIRSTYLE: 1,
  EYES: 2,
  MOUTH: 3,
  ACCESSORY: 4
};

// Class to handle blockchain interactions
export class BlockchainService {
  private publicClient;
  private walletClient;
  private account;
  private allnadsAddress: Address;
  private airdropperAddress: Address;

  constructor(network = 'monadTestnet') {
    // Validate network selection
    if (!NETWORKS[network as keyof typeof NETWORKS]) {
      throw new Error(`Unsupported network: ${network}`);
    }
    
    const networkConfig = NETWORKS[network as keyof typeof NETWORKS];
    
    // Check required environment variables
    if (!networkConfig.privateKey) {
      throw new Error(`Private key not found for ${network}. Check your environment variables.`);
    }

    // Create account from private key
    this.account = privateKeyToAccount(`0x${networkConfig.privateKey}`);
    
    // Create public client
    this.publicClient = createPublicClient({
      chain: networkConfig.chain,
      transport: http(),
    });
    
    // Create wallet client
    this.walletClient = createWalletClient({
      chain: networkConfig.chain,
      transport: http(),
      account: this.account,
    });
    
    this.allnadsAddress = networkConfig.allnadsAddress;
    this.airdropperAddress = networkConfig.airdropperAddress;
  }
  
  /**
   * Check if an address owns any AllNads NFTs
   * @param address The address to check
   * @returns A boolean indicating if the address owns any NFTs
   */
  async hasAllNadsNFT(address: Address): Promise<boolean> {
    try {
      const balance = await this.publicClient.readContract({
        address: this.allnadsAddress,
        abi: AllNadsABI,
        functionName: 'balanceOf',
        args: [address],
      });
      
      return Number(balance) > 0;
    } catch (error) {
      console.error(`Error checking if address ${address} has AllNads NFT:`, error);
      throw error;
    }
  }
  
  /**
   * Airdrop an AllNads NFT to an address
   * @param to The address to receive the NFT
   * @param name The name for the NFT
   * @param backgroundId The background component ID
   * @param hairstyleId The hairstyle component ID
   * @param eyesId The eyes component ID
   * @param mouthId The mouth component ID
   * @param accessoryId The accessory component ID
   * @returns The transaction hash
   */
  async airdropNFT(
    to: Address,
    name: string,
    backgroundId: bigint,
    hairstyleId: bigint,
    eyesId: bigint,
    mouthId: bigint,
    accessoryId: bigint
  ): Promise<string> {
    try {
      const hash = await this.walletClient.writeContract({
        address: this.airdropperAddress,
        abi: AllNadsAirdropperABI,
        functionName: 'mintTo',
        args: [to, name, backgroundId, hairstyleId, eyesId, mouthId, accessoryId],
      });
      
      // Wait for transaction confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      console.log(`Airdrop transaction confirmed in block ${receipt.blockNumber}`);
      
      return hash;
    } catch (error) {
      console.error(`Error airdropping NFT to ${to}:`, error);
      throw error;
    }
  }
  
  /**
   * Select default component IDs for the airdrop
   * This uses hardcoded IDs for simplicity, but could be enhanced to fetch valid templates
   */
  getDefaultComponentIds(): { 
    backgroundId: bigint, 
    hairstyleId: bigint, 
    eyesId: bigint, 
    mouthId: bigint, 
    accessoryId: bigint 
  } {
    // Using default IDs - in production, you'd want to fetch these from the contract
    return {
      backgroundId: BigInt(1),
      hairstyleId: BigInt(1),
      eyesId: BigInt(1),
      mouthId: BigInt(1),
      accessoryId: BigInt(1)
    };
  }
}

// Export a singleton instance
export const blockchainService = new BlockchainService(); 