import { createPublicClient, createWalletClient, http, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat } from 'viem/chains';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Import the Airdropper ABI
const AllNadsAirdropperABIPath = 'ignition/deployments/chain-31337/artifacts/AllNads#AllNadsAirdropper.json';

// Read ABI file
let AllNadsAirdropperABI: any;
try {
  AllNadsAirdropperABI = JSON.parse(
    fs.readFileSync(AllNadsAirdropperABIPath, 'utf8')
  ).abi;
} catch (error) {
  console.error(`Error reading ABI file: ${AllNadsAirdropperABIPath}`);
  console.error('Make sure the contract has been deployed using Hardhat Ignition first');
  process.exit(1);
}

// Check for required environment variables
function checkRequiredEnvVars() {
  // Check airdropper contract addresses
  if (!process.env.MONAD_TESTNET_AIRDROPPER_ADDRESS) {
    console.warn('Warning: MONAD_TESTNET_AIRDROPPER_ADDRESS environment variable is not set');
  }
  if (!process.env.LOCALHOST_AIRDROPPER_ADDRESS) {
    console.warn('Warning: LOCALHOST_AIRDROPPER_ADDRESS environment variable is not set');
  }

  // Check private keys
  if (!process.env.MONAD_PRIVATE_KEY) {
    console.warn('Warning: MONAD_PRIVATE_KEY environment variable is not set');
  }
  if (!process.env.HARDHAT_PRIVATE_KEY) {
    console.warn('Warning: HARDHAT_PRIVATE_KEY environment variable is not set');
  }
}

// Call the check function immediately
checkRequiredEnvVars();

// AllNadsAirdropper contract addresses from environment variables
const CONTRACT_ADDRESSES = {
  monadTestnet: process.env.MONAD_TESTNET_AIRDROPPER_ADDRESS as Address | undefined,
  localhost: process.env.LOCALHOST_AIRDROPPER_ADDRESS as Address | undefined
};

// Network configurations
const NETWORKS = {
  monadTestnet: {
    chain: {
      id: 10143,
      name: 'Monad Testnet',
      network: 'monadTestnet',
      nativeCurrency: { name: 'Monad', symbol: 'MONAD', decimals: 18 },
      rpcUrls: {
        default: { http: [process.env.MONAD_TESTNET_RPC as string] }
      }
    },
    privateKey: process.env.MONAD_PRIVATE_KEY
  },
  localhost: {
    chain: hardhat,
    privateKey: process.env.HARDHAT_PRIVATE_KEY
  }
};

// Help message for usage
function printUsage() {
  console.log(`
Usage: 
  npm run add-admin -- [network] [admin_address]

Examples:
  npm run add-admin -- localhost 0x1234...5678
  npm run add-admin -- monadTestnet 0xabcd...ef01

Parameters:
  - network: The network to connect to (localhost or monadTestnet)
  - admin_address: The address to add as an admin

Available networks:
  - localhost (default)
  - monadTestnet

Required environment variables:
  - MONAD_TESTNET_AIRDROPPER_ADDRESS: The AllNadsAirdropper contract address on Monad testnet
  - LOCALHOST_AIRDROPPER_ADDRESS: The AllNadsAirdropper contract address on localhost
  - MONAD_PRIVATE_KEY: Private key for Monad testnet
  - HARDHAT_PRIVATE_KEY: Private key for localhost
  - MONAD_TESTNET_RPC: Required for monadTestnet
  `);
}

// Check if the address is already an admin
async function isAdmin(client: any, airdropperAddress: Address, address: Address) {
  try {
    const isAdminResult = await client.readContract({
      address: airdropperAddress,
      abi: AllNadsAirdropperABI,
      functionName: 'admins',
      args: [address],
    });
    return isAdminResult;
  } catch (error) {
    console.error(`Error checking if address is admin:`, error);
    throw error;
  }
}

// Add an admin to the airdropper contract
async function addAdmin(walletClient: any, publicClient: any, airdropperAddress: Address, adminAddress: Address) {
  try {
    // Check if already an admin
    const alreadyAdmin = await isAdmin(publicClient, airdropperAddress, adminAddress);
    if (alreadyAdmin) {
      console.log(`Address ${adminAddress} is already an admin. No action needed.`);
      return null;
    }

    // Add admin
    console.log(`Adding ${adminAddress} as an admin...`);
    const hash = await walletClient.writeContract({
      address: airdropperAddress,
      abi: AllNadsAirdropperABI,
      functionName: 'addAdmin',
      args: [adminAddress],
    });

    console.log(`\nTransaction submitted: ${hash}`);
    console.log('Waiting for transaction confirmation...');

    // Wait for transaction confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

    return hash;
  } catch (error) {
    console.error('Error adding admin:', error);
    throw error;
  }
}

async function main() {
  // Check if help is requested
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    return;
  }

  // Get network from command line or environment variable
  const networkName = process.env.NETWORK || process.argv[2] || 'localhost';

  if (!['monadTestnet', 'localhost'].includes(networkName)) {
    console.error(`Invalid network: ${networkName}. Must be 'monadTestnet' or 'localhost'`);
    printUsage();
    process.exit(1);
  }

  console.log(`Using network: ${networkName}`);

  // Get contract address based on network
  const airdropperAddress = CONTRACT_ADDRESSES[networkName as keyof typeof CONTRACT_ADDRESSES];
  if (!airdropperAddress) {
    throw new Error(`Contract address not found for network: ${networkName}. Please set the appropriate environment variable.`);
  }

  // Get admin address from command line arguments
  const adminAddress = process.argv[3];
  if (!adminAddress) {
    console.error('Admin address is required');
    printUsage();
    process.exit(1);
  }

  if (!adminAddress.startsWith('0x') || adminAddress.length !== 42) {
    console.error('Invalid admin address format. It should be a valid Ethereum address (0x...)');
    process.exit(1);
  }

  // Get network configuration
  const networkConfig = NETWORKS[networkName as keyof typeof NETWORKS];
  if (!networkConfig) {
    throw new Error(`Network configuration not found for: ${networkName}`);
  }

  // Get private key for the selected network
  const privateKey = networkConfig.privateKey;
  if (!privateKey) {
    throw new Error(`Private key not found for network: ${networkName}. Please check your .env file.`);
  }

  // Set up clients with the selected network
  const chain = networkConfig.chain;
  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });

  // Create account from private key
  const account = privateKeyToAccount(`0x${privateKey}` as `0x${string}`);

  // Create wallet client
  const walletClient = createWalletClient({
    chain,
    transport: http(),
    account,
  });

  console.log(`Connected with account: ${account.address}`);
  console.log(`Target contract: ${airdropperAddress}`);
  
  try {
    // First check if the connected account is the owner of the contract
    const owner = await publicClient.readContract({
      address: airdropperAddress,
      abi: AllNadsAirdropperABI,
      functionName: 'owner',
      args: []
    }) as Address;
    
    if (owner.toLowerCase() !== account.address.toLowerCase()) {
      console.error(`Error: The connected account (${account.address}) is not the owner of the contract.`);
      console.error(`Only the contract owner (${owner}) can add admins.`);
      process.exit(1);
    }
    
    // Add the admin
    const txHash = await addAdmin(walletClient, publicClient, airdropperAddress, adminAddress as Address);
    
    if (txHash) {
      console.log(`\nSuccess! Added ${adminAddress} as an admin to the AllNadsAirdropper contract`);
      console.log(`Transaction hash: ${txHash}`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 