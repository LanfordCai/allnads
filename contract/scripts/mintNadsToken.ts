import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat } from 'viem/chains';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Import the ABI files
const AllNadsABIPath = 'ignition/deployments/chain-31337/artifacts/AllNads.json';
const ComponentABIPath = 'ignition/deployments/chain-31337/artifacts/AllNads#AllNadsComponent.json';

// Read ABI files
const AllNadsABI = JSON.parse(
  fs.readFileSync(AllNadsABIPath, 'utf8')
).abi;

const AllNadsComponentABI = JSON.parse(
  fs.readFileSync(ComponentABIPath, 'utf8')
).abi;

// Define a BigInt-safe JSON stringifier
function stringifyBigInt(obj: any) {
  return JSON.stringify(obj, (_, value) => 
    typeof value === 'bigint' ? value.toString() : value
  , 2);
}

// Check for required environment variables
function checkRequiredEnvVars() {
  // Check main contract addresses
  if (!process.env.MONAD_TESTNET_ALLNADS_ADDRESS) {
    throw new Error('MONAD_TESTNET_ALLNADS_ADDRESS environment variable is required');
  }
  if (!process.env.LOCALHOST_ALLNADS_ADDRESS) {
    throw new Error('LOCALHOST_ALLNADS_ADDRESS environment variable is required');
  }

  // Check component contract addresses
  if (!process.env.MONAD_TESTNET_COMPONENT_ADDRESS) {
    throw new Error('MONAD_TESTNET_COMPONENT_ADDRESS environment variable is required');
  }
  if (!process.env.LOCALHOST_COMPONENT_ADDRESS) {
    throw new Error('LOCALHOST_COMPONENT_ADDRESS environment variable is required');
  }

  // Check private keys
  if (!process.env.MONAD_PRIVATE_KEY) {
    throw new Error('MONAD_PRIVATE_KEY environment variable is required');
  }
  if (!process.env.HARDHAT_PRIVATE_KEY) {
    throw new Error('HARDHAT_PRIVATE_KEY environment variable is required');
  }
}

// Call the check function immediately
checkRequiredEnvVars();

// AllNads contract addresses from environment variables
const CONTRACT_ADDRESSES = {
  monadTestnet: {
    allnads: process.env.MONAD_TESTNET_ALLNADS_ADDRESS!,
    component: process.env.MONAD_TESTNET_COMPONENT_ADDRESS!
  },
  localhost: {
    allnads: process.env.LOCALHOST_ALLNADS_ADDRESS!,
    component: process.env.LOCALHOST_COMPONENT_ADDRESS!
  }
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

// Component types for reference
const COMPONENT_TYPES = {
  BACKGROUND: 0,
  HAIRSTYLE: 1,
  EYES: 2,
  MOUTH: 3,
  ACCESSORY: 4
};

// Help message for usage
function printUsage() {
  console.log(`
Usage: 
  npm run mint-token -- [network] [name] [backgroundId] [hairstyleId] [eyesId] [mouthId] [accessoryId]
  
  If component IDs are not specified, the script will automatically select the first available template of each type.

Examples:
  npm run mint-token -- localhost "My AllNad"                  (auto-select components)
  npm run mint-token -- monadTestnet "Cool NFT" 10 11 12 13 14 (specify all components)
  npm run mint-token -- localhost "Custom NFT" 1               (specify background, auto-select the rest)

Parameters:
  - network: The network to connect to (localhost or monadTestnet)
  - name: The name for your NFT (in quotes)
  - backgroundId: (Optional) Template ID for background component
  - hairstyleId: (Optional) Template ID for hairstyle component
  - eyesId: (Optional) Template ID for eyes component
  - mouthId: (Optional) Template ID for mouth component
  - accessoryId: (Optional) Template ID for accessory component

Available networks:
  - localhost (default)
  - monadTestnet

Required environment variables:
  - MONAD_TESTNET_ALLNADS_ADDRESS: The AllNads contract address on Monad testnet
  - LOCALHOST_ALLNADS_ADDRESS: The AllNads contract address on localhost
  - MONAD_TESTNET_COMPONENT_ADDRESS: The AllNadsComponent contract address on Monad testnet
  - LOCALHOST_COMPONENT_ADDRESS: The AllNadsComponent contract address on localhost
  - MONAD_PRIVATE_KEY: Private key for Monad testnet
  - HARDHAT_PRIVATE_KEY: Private key for localhost
  - MONAD_TESTNET_RPC: Required for monadTestnet
  `);
}

// Get template info from the component contract
async function getTemplateInfo(client: any, templateId: bigint, contractAddress: string) {
  try {
    const templateInfo = await client.readContract({
      address: contractAddress,
      abi: AllNadsComponentABI,
      functionName: 'getTemplate',
      args: [templateId],
    });
    return templateInfo;
  } catch (error) {
    console.error(`Error fetching template #${templateId} info:`, error);
    throw error;
  }
}

// Get template type from the component contract
async function getTemplateType(client: any, templateId: bigint, contractAddress: string) {
  try {
    const templateType = await client.readContract({
      address: contractAddress,
      abi: AllNadsComponentABI,
      functionName: 'getTemplateType',
      args: [templateId],
    });
    return templateType;
  } catch (error) {
    console.error(`Error fetching template #${templateId} type:`, error);
    throw error;
  }
}

// Get templates by component type
async function getTemplatesByType(client: any, componentType: number, componentContractAddress: string) {
  try {
    const templates = await client.readContract({
      address: componentContractAddress,
      abi: AllNadsComponentABI,
      functionName: 'getTemplatesByType',
      args: [componentType],
    });
    return templates;
  } catch (error) {
    console.error(`Error fetching templates for component type ${componentType}:`, error);
    throw error;
  }
}

// Find the first valid template for a component type
async function findFirstValidTemplate(client: any, componentType: number, componentContractAddress: string) {
  try {
    // Get all templates for this type
    const templates = await getTemplatesByType(client, componentType, componentContractAddress);
    
    if (templates.length === 0) {
      throw new Error(`No templates found for component type ${componentType}`);
    }
    
    // Check each template until we find an active one with available supply
    for (const templateId of templates) {
      const template = await getTemplateInfo(client, templateId, componentContractAddress);
      
      // Check if template is active and has available supply
      if (template.isActive && (template.maxSupply === BigInt(0) || template.currentSupply < template.maxSupply)) {
        console.log(`Selected template #${templateId} for component type ${Object.keys(COMPONENT_TYPES).find(key => COMPONENT_TYPES[key as keyof typeof COMPONENT_TYPES] === componentType)}`);
        return templateId;
      }
    }
    
    throw new Error(`No valid templates found for component type ${componentType}`);
  } catch (error) {
    console.error(`Error finding valid template for component type ${componentType}:`, error);
    throw error;
  }
}

// Auto-select all component templates
async function autoSelectTemplates(client: any, componentContractAddress: string) {
  try {
    const background = await findFirstValidTemplate(client, COMPONENT_TYPES.BACKGROUND, componentContractAddress);
    const hairstyle = await findFirstValidTemplate(client, COMPONENT_TYPES.HAIRSTYLE, componentContractAddress);
    const eyes = await findFirstValidTemplate(client, COMPONENT_TYPES.EYES, componentContractAddress);
    const mouth = await findFirstValidTemplate(client, COMPONENT_TYPES.MOUTH, componentContractAddress);
    const accessory = await findFirstValidTemplate(client, COMPONENT_TYPES.ACCESSORY, componentContractAddress);
    
    return {
      backgroundId: background,
      hairstyleId: hairstyle,
      eyesId: eyes,
      mouthId: mouth,
      accessoryId: accessory
    };
  } catch (error) {
    console.error('Error auto-selecting templates:', error);
    throw error;
  }
}

// Calculate total cost using AllNads contract
async function calculateTotalCost(
  client: any,
  allnadsAddress: string,
  backgroundId: bigint,
  hairstyleId: bigint,
  eyesId: bigint,
  mouthId: bigint,
  accessoryId: bigint
) {
  try {
    const totalCost = await client.readContract({
      address: allnadsAddress,
      abi: AllNadsABI,
      functionName: 'calculateTotalCost',
      args: [backgroundId, hairstyleId, eyesId, mouthId, accessoryId],
    });

    const mintFee = await client.readContract({
      address: allnadsAddress,
      abi: AllNadsABI,
      functionName: 'mintFee',
    });

    return {
      componentCost: totalCost,
      mintFee,
      totalPrice: totalCost + mintFee
    };
  } catch (error) {
    console.error(`Error calculating total cost:`, error);
    throw error;
  }
}

// Validate components using the AllNads contract
async function validateComponents(
  client: any,
  allnadsAddress: string,
  backgroundId: bigint,
  hairstyleId: bigint,
  eyesId: bigint,
  mouthId: bigint,
  accessoryId: bigint
) {
  try {
    const isValid = await client.readContract({
      address: allnadsAddress,
      abi: AllNadsABI,
      functionName: 'validateComponents',
      args: [backgroundId, hairstyleId, eyesId, mouthId, accessoryId],
    });
    return isValid;
  } catch (error) {
    console.error(`Error validating components:`, error);
    throw error;
  }
}

// Mint NFT token
async function mintNadsToken(
  walletClient: any,
  publicClient: any,
  allnadsAddress: string,
  name: string,
  backgroundId: bigint,
  hairstyleId: bigint,
  eyesId: bigint,
  mouthId: bigint,
  accessoryId: bigint
) {
  try {
    // Validate components first
    const isValid = await validateComponents(
      publicClient,
      allnadsAddress,
      backgroundId,
      hairstyleId,
      eyesId,
      mouthId,
      accessoryId
    );

    if (!isValid) {
      throw new Error(`Components are not valid. Please ensure all template IDs are correct and active.`);
    }

    // Calculate cost
    const { componentCost, mintFee, totalPrice } = await calculateTotalCost(
      publicClient,
      allnadsAddress,
      backgroundId,
      hairstyleId,
      eyesId,
      mouthId,
      accessoryId
    );

    console.log(`Component cost: ${formatEther(componentCost)} ETH`);
    console.log(`Mint fee: ${formatEther(mintFee)} ETH`);
    console.log(`Total price: ${formatEther(totalPrice)} ETH`);

    // Mint the token
    const hash = await walletClient.writeContract({
      address: allnadsAddress,
      abi: AllNadsABI,
      functionName: 'mint',
      args: [name, backgroundId, hairstyleId, eyesId, mouthId, accessoryId],
      value: totalPrice
    });

    console.log(`\nMint transaction submitted: ${hash}`);
    console.log('Waiting for transaction confirmation...');

    // Wait for transaction confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

    return hash;
  } catch (error) {
    console.error('Error minting token:', error);
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

  // Get contract addresses based on network
  const addresses = CONTRACT_ADDRESSES[networkName as keyof typeof CONTRACT_ADDRESSES];
  if (!addresses) {
    throw new Error(`Contract addresses not found for network: ${networkName}`);
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
  const account = privateKeyToAccount(`0x${privateKey}`);

  // Create wallet client
  const walletClient = createWalletClient({
    chain,
    transport: http(),
    account,
  });

  console.log(`Connected with account: ${account.address}`);

  // Get NFT name from command line arguments
  const name = process.argv[3] || "My AllNad";
  
  // Check if any component IDs were manually specified
  const hasManualComponents = process.argv.length > 4;
  
  // Setup component IDs
  let backgroundId: bigint = BigInt(0);
  let hairstyleId: bigint = BigInt(0);
  let eyesId: bigint = BigInt(0);
  let mouthId: bigint = BigInt(0);
  let accessoryId: bigint = BigInt(0);
  
  try {
    // Check account balance
    const balance = await publicClient.getBalance({ address: account.address });
    console.log(`\nAccount balance: ${formatEther(balance)} ETH`);
    
    // If component IDs are provided, use them. Otherwise, auto-select components
    if (hasManualComponents) {
      backgroundId = process.argv[4] ? BigInt(process.argv[4]) : BigInt(0);
      hairstyleId = process.argv[5] ? BigInt(process.argv[5]) : BigInt(0);
      eyesId = process.argv[6] ? BigInt(process.argv[6]) : BigInt(0);
      mouthId = process.argv[7] ? BigInt(process.argv[7]) : BigInt(0);
      accessoryId = process.argv[8] ? BigInt(process.argv[8]) : BigInt(0);
    }
    
    // Auto-select any components that weren't manually specified
    if (!hasManualComponents || backgroundId === BigInt(0) || hairstyleId === BigInt(0) || 
        eyesId === BigInt(0) || mouthId === BigInt(0) || accessoryId === BigInt(0)) {
      
      console.log("Auto-selecting components...");
      const selectedTemplates = await autoSelectTemplates(publicClient, addresses.component);
      
      // Only override component IDs that weren't manually specified
      if (!hasManualComponents || backgroundId === BigInt(0)) backgroundId = selectedTemplates.backgroundId;
      if (!hasManualComponents || hairstyleId === BigInt(0)) hairstyleId = selectedTemplates.hairstyleId;
      if (!hasManualComponents || eyesId === BigInt(0)) eyesId = selectedTemplates.eyesId;
      if (!hasManualComponents || mouthId === BigInt(0)) mouthId = selectedTemplates.mouthId;
      if (!hasManualComponents || accessoryId === BigInt(0)) accessoryId = selectedTemplates.accessoryId;
    }

    console.log(`\nMinting AllNads NFT with the following parameters:`);
    console.log(`- Name: ${name}`);
    console.log(`- Background: Template #${backgroundId}`);
    console.log(`- Hairstyle: Template #${hairstyleId}`);
    console.log(`- Eyes: Template #${eyesId}`);
    console.log(`- Mouth: Template #${mouthId}`);
    console.log(`- Accessory: Template #${accessoryId}`);

    // Mint the token
    const txHash = await mintNadsToken(
      walletClient,
      publicClient,
      addresses.allnads,
      name,
      backgroundId,
      hairstyleId,
      eyesId,
      mouthId,
      accessoryId
    );

    console.log(`\nSuccess! Minted NFT "${name}"`);
    console.log(`Transaction hash: ${txHash}`);

    // Try to get the token ID (this is an estimate, more reliable would be to parse logs from receipt)
    console.log(`\nYou can view your new NFT with:`);
    console.log(`npm run view-token -- ${networkName} [tokenId]`);
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