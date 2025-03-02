import { createPublicClient, http } from 'viem';
import { hardhat } from 'viem/chains';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Import the ABI for AllNads main contract
const AllNadsABIPath = 'ignition/deployments/chain-31337/artifacts/AllNads#AllNads.json';
const AllNadsABI = JSON.parse(
  fs.readFileSync(AllNadsABIPath, 'utf8')
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
    }
  },
  localhost: {
    chain: hardhat
  }
};

// Help message for usage
function printUsage() {
  console.log(`
Usage: 
  npm run view-svg -- [network] [tokenId]

Examples:
  npm run view-svg -- localhost 1
  npm run view-svg -- monadTestnet 5

Available networks:
  - localhost (default)
  - monadTestnet

Required environment variables:
  - MONAD_TESTNET_ALLNADS_ADDRESS: The AllNads contract address on Monad testnet
  - LOCALHOST_ALLNADS_ADDRESS: The AllNads contract address on localhost
  - MONAD_TESTNET_COMPONENT_ADDRESS: The AllNadsComponent contract address on Monad testnet
  - LOCALHOST_COMPONENT_ADDRESS: The AllNadsComponent contract address on localhost
  - MONAD_TESTNET_RPC: Required for monadTestnet
  `);
}

async function getNadsTokenURI(client: any, tokenId: bigint, contractAddress: string) {
  try {
    const tokenURI = await client.readContract({
      address: contractAddress,
      abi: AllNadsABI,
      functionName: 'tokenURI',
      args: [tokenId],
    });
    return tokenURI;
  } catch (error) {
    console.error(`Error fetching tokenURI for AllNads #${tokenId}:`, error);
    throw error;
  }
}

function generateSimpleHTML(base64Svg: string, tokenId: bigint) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AllNads #${tokenId} SVG Viewer</title>
</head>
<body>
    <h2>AllNads #${tokenId} SVG Image:</h2>
    <img src="data:image/svg+xml;base64,${base64Svg}" alt="AllNads #${tokenId}">
</body>
</html>`;
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
  const addresses = CONTRACT_ADDRESSES[networkName as keyof typeof CONTRACT_ADDRESSES];
  if (!addresses) {
    throw new Error(`Contract addresses not found for network: ${networkName}`);
  }
  
  // Get contract address for AllNads main contract
  const contractAddress = addresses.allnads;
  
  // Get network configuration
  const networkConfig = NETWORKS[networkName as keyof typeof NETWORKS];
  if (!networkConfig) {
    throw new Error(`Network configuration not found for: ${networkName}`);
  }
  
  // Set up client with the selected network
  const chain = networkConfig.chain;
  const client = createPublicClient({
    chain,
    transport: http(),
  });
  
  // Get token ID from command line argument or default to token ID 1
  const tokenIdArg = process.argv[3] || '1';
  const tokenId = BigInt(tokenIdArg);
  
  console.log(`Fetching SVG data for AllNads #${tokenId} on ${networkName}...`);
  
  try {
    // Get tokenURI
    const tokenURI = await getNadsTokenURI(client, tokenId, contractAddress);
    
    let metadata;
    
    // Handle base64 encoded JSON
    if (typeof tokenURI === 'string' && tokenURI.startsWith('data:application/json;base64,')) {
      // Decode the JSON data
      const base64Data = tokenURI.replace('data:application/json;base64,', '');
      const decodedData = Buffer.from(base64Data, 'base64').toString('utf-8');
      metadata = JSON.parse(decodedData);
    }
    // Handle direct JSON data (not base64 encoded)
    else if (typeof tokenURI === 'string' && tokenURI.startsWith('data:application/json,')) {
      const jsonData = tokenURI.replace('data:application/json,', '');
      metadata = JSON.parse(jsonData);
    }
    // Unknown format
    else {
      console.log('TokenURI is in an unexpected format:', tokenURI);
      return;
    }
    
    // Extract the SVG base64 data
    if (metadata.image && metadata.image.startsWith('data:image/svg+xml;base64,')) {
      const svgBase64 = metadata.image.replace('data:image/svg+xml;base64,', '');
      
      // Generate a simple HTML file to view the SVG
      const html = generateSimpleHTML(svgBase64, tokenId);
      
      // Ensure the output directory exists
      const outputDir = path.join(__dirname, '../output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Write HTML to file
      const htmlPath = path.join(outputDir, `simple_allnads_${tokenId}.html`);
      fs.writeFileSync(htmlPath, html);
      console.log(`\nSimple HTML viewer generated at: ${htmlPath}`);
    } else {
      console.log('No SVG data found in the metadata');
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