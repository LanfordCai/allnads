import { createPublicClient, http, PublicClient, Address, formatEther } from 'viem';
import { monadTestnet, contractAddresses } from '../config/chains';

class BlockchainService {
  private static instance: BlockchainService;
  private publicClient: PublicClient;

  private constructor() {
    this.publicClient = createPublicClient({
      chain: monadTestnet,
      transport: http(),
    });
  }

  public static getInstance(): BlockchainService {
    if (!BlockchainService.instance) {
      BlockchainService.instance = new BlockchainService();
    }
    return BlockchainService.instance;
  }

  public getPublicClient(): PublicClient {
    return this.publicClient;
  }

  public async getBalance(address: Address): Promise<string> {
    const balance = await this.publicClient.getBalance({ address });
    return formatEther(balance);
  }

  public getContractAddress(contractName: keyof typeof contractAddresses[typeof monadTestnet.id]): Address {
    return contractAddresses[monadTestnet.id][contractName];
  }
}

export const blockchainService = BlockchainService.getInstance(); 