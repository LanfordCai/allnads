import { createPublicClient, http, formatEther } from 'viem';
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

// Chain configuration (for backward compatibility)
const monadTestnet = NETWORKS.monadTestnet.chain;

// Help message for usage
function printUsage() {
  console.log(`
Usage: 
  npm run view-token -- [network] [tokenId]

Examples:
  npm run view-token -- localhost 1
  npm run view-token -- monadTestnet 5

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

// Function to get avatar details
async function getAvatarDetails(client: any, tokenId: bigint, contractAddress: string) {
  try {
    const avatar = await client.readContract({
      address: contractAddress,
      abi: AllNadsABI,
      functionName: 'getAvatar',
      args: [tokenId],
    });
    return avatar;
  } catch (error) {
    console.error(`Error fetching avatar details for AllNads #${tokenId}:`, error);
    throw error;
  }
}

async function getNadsMetadata(client: any, tokenId: bigint, contractAddress: string) {
  try {
    // Get tokenURI first
    const tokenURI = await getNadsTokenURI(client, tokenId, contractAddress);
    
    // Try to get avatar details as well
    let avatarDetails;
    try {
      avatarDetails = await getAvatarDetails(client, tokenId, contractAddress);
    } catch (error) {
      console.log("Could not fetch avatar details, continuing with tokenURI only");
    }
    
    let metadata;
    
    // Handle base64 encoded JSON data
    if (typeof tokenURI === 'string' && tokenURI.startsWith('data:application/json;base64,')) {
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
      return { tokenURI, avatarDetails };
    }
    
    // Add avatar details to metadata if available
    if (avatarDetails) {
      metadata.avatarDetails = avatarDetails;
    }
    
    // Extract SVG data from image field if it's base64 encoded
    if (metadata.image && metadata.image.startsWith('data:image/svg+xml;base64,')) {
      const svgBase64 = metadata.image.replace('data:image/svg+xml;base64,', '');
      const svgData = Buffer.from(svgBase64, 'base64').toString('utf-8');
      
      // Add the decoded SVG to the metadata
      metadata.decodedSVG = svgData;
      // Keep the original base64 for HTML
      metadata.svgBase64 = svgBase64;
    }
    
    return metadata;
  } catch (error) {
    console.error(`Error processing metadata for AllNads #${tokenId}:`, error);
    throw error;
  }
}

function generateHTML(metadata: any, tokenId: bigint) {
  if (!metadata.svgBase64) {
    console.error('No SVG data found in metadata');
    return '';
  }
  
  // Add avatar details section if available
  let avatarDetailsHTML = '';
  if (metadata.avatarDetails) {
    avatarDetailsHTML = `
    <div class="avatar-details">
        <h3>Avatar Details</h3>
        <table>
            <tr>
                <th>Property</th>
                <th>Value</th>
            </tr>
            <tr>
                <td>Name</td>
                <td>${metadata.avatarDetails.name}</td>
            </tr>
            <tr>
                <td>Background ID</td>
                <td>${metadata.avatarDetails.backgroundId}</td>
            </tr>
            <tr>
                <td>Hairstyle ID</td>
                <td>${metadata.avatarDetails.hairstyleId}</td>
            </tr>
            <tr>
                <td>Eyes ID</td>
                <td>${metadata.avatarDetails.eyesId}</td>
            </tr>
            <tr>
                <td>Mouth ID</td>
                <td>${metadata.avatarDetails.mouthId}</td>
            </tr>
            <tr>
                <td>Accessory ID</td>
                <td>${metadata.avatarDetails.accessoryId}</td>
            </tr>
        </table>
    </div>`;
  }
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AllNads #${tokenId} Viewer</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .nft-display {
            display: flex;
            flex-direction: column;
            align-items: center;
            border: 1px solid #ddd;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .nft-image {
            max-width: 500px;
            margin-bottom: 20px;
        }
        .attributes, .avatar-details {
            width: 100%;
            margin-top: 20px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        th {
            background-color: #f2f2f2;
        }
    </style>
</head>
<body>
    <h1>AllNads #${tokenId}</h1>
    
    <div class="nft-display">
        <h2>${metadata.name || `AllNads #${tokenId}`}</h2>
        <div class="nft-image">
            <img src="data:image/svg+xml;base64,${metadata.svgBase64}" alt="${metadata.name || `AllNads #${tokenId}`}" width="100%">
        </div>
        
        ${avatarDetailsHTML}
        
        <div class="attributes">
            <h3>Attributes</h3>
            <table>
                <tr>
                    <th>Trait</th>
                    <th>Value</th>
                </tr>
                ${metadata.attributes ? metadata.attributes.map((attr: any) => 
                  `<tr>
                      <td>${attr.trait_type}</td>
                      <td>${attr.value}</td>
                  </tr>`
                ).join('') : '<tr><td colspan="2">No attributes found</td></tr>'}
            </table>
        </div>
    </div>
    
    <h3>Description</h3>
    <p>${metadata.description || 'No description available'}</p>
</body>
</html>`;

  return html;
}

// Define a BigInt-safe JSON stringifier
function stringifyBigInt(obj: any) {
  return JSON.stringify(obj, (_, value) => 
    typeof value === 'bigint' ? value.toString() : value
  , 2);
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
  
  console.log(`Fetching data for AllNads #${tokenId} on ${networkName}...`);
  
  try {
    // Get token metadata
    const metadata = await getNadsMetadata(client, tokenId, contractAddress);
    console.log(`\nMetadata for AllNads #${tokenId}:`);
    
    // Use the custom stringifier instead of direct JSON.stringify
    console.log(stringifyBigInt(metadata));
    
    // Generate HTML file
    if (metadata.svgBase64) {
      const html = generateHTML(metadata, tokenId);
      
      // Ensure the output directory exists
      const outputDir = path.join(__dirname, '../output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Write HTML to file
      const htmlPath = path.join(outputDir, `allnads_${tokenId}.html`);
      fs.writeFileSync(htmlPath, html);
      console.log(`\nHTML file generated at: ${htmlPath}`);
    } else {
      console.log('No SVG data found, HTML file not generated');
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