import { formatEther, createPublicClient, createWalletClient, http, parseEther, createTestClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat } from 'viem/chains';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Import the ABI
const ABIPath = 'ignition/deployments/chain-31337/artifacts/AllNads#AllNadsComponent.json'
const AllNadsComponentABI = JSON.parse(
  fs.readFileSync(ABIPath, 'utf8')
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

interface TemplateRecord {
  templateId: number;
  name: string;
  folder: string;
  file: string;
  timestamp: number;
  txHash: string;
}

interface TemplateDatabase {
  [filename: string]: TemplateRecord;
}

const COMPONENT_TYPES = {
  'background': 0,
  'hairstyle': 1,
  'eyes': 2,
  'mouth': 3,
  'accessory': 4
};

const DB_PATH = path.join(__dirname, '../data/created_templates.json');

// Ensure the data directory exists
function ensureDataDir() {
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Load or initialize the template database
function loadTemplateDB(): TemplateDatabase {
  ensureDataDir();
  if (fs.existsSync(DB_PATH)) {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  }
  return {};
}

// Save the template database
function saveTemplateDB(db: TemplateDatabase) {
  fs.writeFileSync(DB_PATH, stringifyBigInt(db));
}

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
    addresses: {
      allnads: process.env.MONAD_TESTNET_ALLNADS_ADDRESS! as `0x${string}`,
      component: process.env.MONAD_TESTNET_COMPONENT_ADDRESS! as `0x${string}`
    },
    privateKey: process.env.MONAD_PRIVATE_KEY
  },
  localhost: {
    chain: hardhat,
    addresses: {
      allnads: process.env.LOCALHOST_ALLNADS_ADDRESS! as `0x${string}`,
      component: process.env.LOCALHOST_COMPONENT_ADDRESS! as `0x${string}`
    },
    privateKey: process.env.HARDHAT_PRIVATE_KEY
  }
};

// Help message for usage
function printUsage() {
  console.log(`
Usage: 
  npm run create-templates -- [network]

Examples:
  npm run create-templates -- localhost
  npm run create-templates -- monadTestnet

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

async function main() {
  // Check if help is requested
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    return;
  }

  // Get network from command line or environment variable
  const networkName = process.env.NETWORK || process.argv[2] || 'localhost';
  
  if (!['monadTestnet', 'localhost'].includes(networkName)) {
    throw new Error(`Invalid network: ${networkName}. Must be 'monadTestnet' or 'localhost'`);
  }
  
  console.log(`Using network: ${networkName}`);
  
  // Get network configuration
  const networkConfig = NETWORKS[networkName as keyof typeof NETWORKS];
  if (!networkConfig) {
    throw new Error(`Network configuration not found for: ${networkName}`);
  }
  
  // Use the selected network's configuration
  const network = networkConfig.chain;
  const contractAddress = networkConfig.addresses.component;
  const private_key = networkConfig.privateKey;
  
  if (!private_key) {
    throw new Error(`Private key not found for network: ${networkName}`);
  }
  
  // Setup clients
  const publicClient = createPublicClient({
    chain: network,
    transport: http()
  });

  // Get the template creation price from the contract
  const templateCreationPrice = await publicClient.readContract({
    address: contractAddress,
    abi: AllNadsComponentABI,
    functionName: 'templateCreationFee',
    args: []
  });

  // Replace with your private key
  const account = privateKeyToAccount(`0x${private_key}`);
  const walletClient = createWalletClient({
    chain: network,
    transport: http(),
    account
  });

  console.log(`Connected to ${network.name} with account ${account.address}`);
  console.log(`Using contract at ${contractAddress}`);
  
  // Load existing template database
  const templateDB = loadTemplateDB();

  // Read images directory
  const baseDir = path.join(__dirname, '../compressed_images');
  const componentFolders = fs.readdirSync(baseDir);
  let counter = 0

  // Define priority files
  const priorityFiles = ['Purple.png', 'Look.png', 'Flonad.png', 'Hedgehog.png', 'Serious.png'];
  
  for (const folder of componentFolders) {
    const componentType = COMPONENT_TYPES[folder.toLowerCase() as keyof typeof COMPONENT_TYPES];
    if (componentType === undefined) {
      console.log(`Skipping unknown component type folder: ${folder}`);
      continue;
    }

    const folderPath = path.join(baseDir, folder);
    const files = fs.readdirSync(folderPath);
    
    // Sort files to process priority files first
    const sortedFiles = [...files].sort((a, b) => {
      const aIsPriority = priorityFiles.includes(a);
      const bIsPriority = priorityFiles.includes(b);
      if (aIsPriority && !bIsPriority) return -1;
      if (!aIsPriority && bIsPriority) return 1;
      return 0;
    });

    for (const file of sortedFiles) {
      if (!file.toLowerCase().endsWith('.png')) continue;

      // Use filename as key
      if (templateDB[file]) {
        console.log(`Template already exists for ${folder}/${file} (Template ID: ${templateDB[file].templateId})`);
        continue;
      }

      // Read image and convert to base64
      const imagePath = path.join(folderPath, file);
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // Template parameters
      const templateName = path.basename(file, '.png');
      let maxSupply = 1000n;
      let price = parseEther('0.05');
      // If the template is a priority template, set price to 0
      if (priorityFiles.includes(file)) {
        maxSupply = 1000000n;
        price = 0n;
      }

      // If filename contains 'Uni', set price to 0.1 ETH
      if (file.includes('Uni')) {
        price = parseEther('0.1');
      }

      try {
        // Get the next template ID
        const nextTemplateId = await publicClient.readContract({
          address: contractAddress,
          abi: AllNadsComponentABI,
          functionName: 'nextTemplateId',
          args: []
        });

        const balance = await publicClient.getBalance({ address: account.address });
        console.log("Balance", balance);

        // Estimate gas and check if we have enough balance
        const gasEstimate = await publicClient.estimateContractGas({
          address: contractAddress,
          abi: AllNadsComponentABI,
          functionName: 'createTemplate',
          args: [templateName, maxSupply, price, base64Image, componentType],
          value: templateCreationPrice as bigint,
          account: account.address
        });

        const gasPrice = await publicClient.getGasPrice();
        const totalCost = (templateCreationPrice as bigint) + (gasEstimate * gasPrice);

        console.log("Total Cost", totalCost);
        
        if (balance < totalCost) {
          throw new Error(`Insufficient balance. Need ${totalCost}, have ${balance}`);
        }

        console.log("Creating template for", templateName)
        console.log("Max Supply", maxSupply)
        console.log("Template Creation Price", formatEther(templateCreationPrice as bigint))
        console.log("Price", formatEther(price))
        console.log("Component Type", componentType)

        const hash = await walletClient.writeContract({
          address: contractAddress,
          abi: AllNadsComponentABI,
          functionName: 'createTemplate',
          args: [templateName, maxSupply, price, base64Image, componentType],
          value: templateCreationPrice as bigint
        });

        console.log(`Created template for ${folder}/${file} - TX: ${hash}`);

        // Wait for confirmation
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        // Record the created template
        templateDB[file] = {
          templateId: Number(nextTemplateId),
          name: templateName,
          folder,
          file,
          timestamp: Date.now(),
          txHash: hash
        };

        // Save after each successful creation
        saveTemplateDB(templateDB);
        // Add delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to create template for ${folder}/${file}:`, error);
      }
      counter++
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}); 