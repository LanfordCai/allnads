import { createPublicClient, http } from 'viem';
import { hardhat } from 'viem/chains';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Import the ABI for AllNadsComponent contract
const ABIPath = 'ignition/deployments/chain-31337/artifacts/AllNads#AllNadsComponent.json';
const AllNadsComponentABI = JSON.parse(
  fs.readFileSync(ABIPath, 'utf8')
).abi;

// Define component types matching the enum in the contract
const COMPONENT_TYPES = {
  BACKGROUND: 0,
  HAIRSTYLE: 1,
  EYES: 2,
  MOUTH: 3,
  ACCESSORY: 4
};

// Add PNG header constant
const PNG_HEADER = "iVBORw0KGgoAAAANSUhEUgAA";

// Define a BigInt-safe JSON stringifier
function stringifyBigInt(obj: any) {
  return JSON.stringify(obj, (_, value) => 
    typeof value === 'bigint' ? value.toString() : value
  , 2);
}

// Check for required environment variables
function checkRequiredEnvVars() {
  // Check component contract addresses
  if (!process.env.MONAD_TESTNET_COMPONENT_ADDRESS) {
    throw new Error('MONAD_TESTNET_COMPONENT_ADDRESS environment variable is required');
  }
  if (!process.env.LOCALHOST_COMPONENT_ADDRESS) {
    throw new Error('LOCALHOST_COMPONENT_ADDRESS environment variable is required');
  }
  
  // Check RPC URL for Monad testnet
  if (!process.env.MONAD_TESTNET_RPC) {
    throw new Error('MONAD_TESTNET_RPC environment variable is required for monadTestnet network');
  }
}

// Call the check function immediately
checkRequiredEnvVars();

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
    address: process.env.MONAD_TESTNET_COMPONENT_ADDRESS!
  },
  localhost: {
    chain: hardhat,
    address: process.env.LOCALHOST_COMPONENT_ADDRESS!
  }
};

// Help message for usage
function printUsage() {
  console.log(`
Usage: 
  npm run list-templates -- [network] [options]

Examples:
  npm run list-templates -- localhost
  npm run list-templates -- monadTestnet
  npm run list-templates -- localhost active-only
  npm run list-templates -- localhost sort-by-name
  npm run list-templates -- localhost active-only sort-by-id
  npm run list-templates -- localhost --debug

Available networks:
  - localhost (default)
  - monadTestnet

Options:
  - active-only: Only show active templates
  - sort-by-name: Sort templates by name
  - sort-by-id: Sort templates by ID (default)
  - sort-by-price: Sort templates by price
  - --debug: Enable debug mode with additional logging

Required environment variables:
  - MONAD_TESTNET_COMPONENT_ADDRESS: The AllNadsComponent contract address on Monad testnet
  - LOCALHOST_COMPONENT_ADDRESS: The AllNadsComponent contract address on localhost
  - MONAD_TESTNET_RPC: Required for monadTestnet
  `);
}

// Interface for Template structure
interface Template {
  name: string;
  creator: string;
  maxSupply: bigint;
  currentSupply: bigint;
  price: bigint;
  imageData: string;
  isActive: boolean;
  componentType: number;
}

// Function to validate template data and log any issues
function validateTemplate(templateId: bigint, template: any): boolean {
  const issues: string[] = [];
  
  if (!template) {
    console.error(`Template ${templateId} is null or undefined`);
    return false;
  }
  
  // Check required fields
  if (!template.name) issues.push("Missing name");
  if (!template.creator) issues.push("Missing creator");
  if (template.creator === '0x0000000000000000000000000000000000000000') issues.push("Invalid creator (zero address)");
  if (template.maxSupply === undefined) issues.push("Missing maxSupply");
  if (template.currentSupply === undefined) issues.push("Missing currentSupply");
  if (template.price === undefined) issues.push("Missing price");
  if (template.isActive === undefined) issues.push("Missing isActive status");
  
  // Check for valid image data
  if (!template.imageData) {
    issues.push("Missing image data");
  } else if (typeof template.imageData !== 'string') {
    issues.push(`Invalid image data type: ${typeof template.imageData}`);
  }
  
  // Log issues if any
  if (issues.length > 0) {
    console.warn(`⚠️ Template ${templateId} has the following issues:\n - ${issues.join('\n - ')}`);
    return false;
  }
  
  return true;
}

// Function to fetch all templates by component type
async function getTemplatesByType(client: any, contractAddress: string, componentType: number) {
  try {
    // Get template IDs for the specified component type
    const templateIds = await client.readContract({
      address: contractAddress as `0x${string}`,
      abi: AllNadsComponentABI,
      functionName: 'getTemplatesByType',
      args: [componentType],
    });

    console.log(`Found ${templateIds.length} template IDs for component type ${componentType}`);

    // For each template ID, get the full template details
    const templates = await Promise.all(templateIds.map(async (templateId: bigint) => {
      try {
        console.log(`Fetching details for template ID: ${templateId}`);
        const template = await client.readContract({
          address: contractAddress as `0x${string}`,
          abi: AllNadsComponentABI,
          functionName: 'getTemplate',
          args: [templateId],
        });

        // Log the raw template data to verify structure - using stringifyBigInt instead of JSON.stringify
        console.log(`Raw template data for ID ${templateId}:`, stringifyBigInt({
          id: templateId,
          name: template.name,
          creator: template.creator,
          currentSupply: template.currentSupply,
          maxSupply: template.maxSupply,
          price: template.price,
          isActive: template.isActive
        }));
        
        // Validate the template data
        const isValid = validateTemplate(templateId, template);
        
        if (!isValid) {
          console.warn(`⚠️ Template ${templateId} has validation issues but will be included with warning flags`);
          return {
            id: templateId,
            ...template,
            hasError: true,
            errorMessage: "Template data validation failed"
          };
        }
        
        return {
          id: templateId,
          ...template,
          hasError: false
        };
      } catch (error) {
        console.error(`Error fetching template ID ${templateId}:`, error);
        return {
          id: templateId,
          name: `Error: Could not fetch template ${templateId}`,
          creator: '0x0000000000000000000000000000000000000000',
          maxSupply: 0n,
          currentSupply: 0n,
          price: 0n,
          imageData: '',
          isActive: false,
          componentType,
          hasError: true,
          errorMessage: `${error}`
        };
      }
    }));

    return templates;
  } catch (error) {
    console.error(`Error fetching templates for component type ${componentType}:`, error);
    return [];
  }
}

// Function to format Ethereum address for display
function formatAddress(address: string): string {
  if (!address || address.length < 42) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

// Function to sort templates based on sort option
function sortTemplates(templates: any[], sortOption: string) {
  if (sortOption === 'name') {
    return [...templates].sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortOption === 'price') {
    return [...templates].sort((a, b) => Number(a.price) - Number(b.price));
  } else { // default: sort by id
    return [...templates].sort((a, b) => Number(a.id) - Number(b.id));
  }
}

// Generate HTML with template data
function generateHTML(templatesByType: Record<string, any[]>) {
  // Start HTML content
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AllNads Templates by Type</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }
        h1 {
            color: #333;
            text-align: center;
        }
        h2 {
            color: #444;
            margin-top: 30px;
            background-color: #e0e0e0;
            padding: 10px;
            border-radius: 5px;
        }
        .template-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        .template-card {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            padding: 15px;
            transition: transform 0.2s ease;
        }
        .template-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
        }
        .template-name {
            font-weight: bold;
            font-size: 18px;
            margin-bottom: 10px;
            color: #333;
        }
        .template-info {
            font-size: 14px;
            color: #666;
            margin-bottom: 5px;
        }
        .template-image {
            width: 100%;
            height: auto;
            margin-bottom: 10px;
            border-radius: 5px;
        }
        .template-image-placeholder {
            background-color: #eee;
            height: 150px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 10px;
            border-radius: 5px;
            color: #999;
            font-size: 14px;
        }
        .active-badge {
            display: inline-block;
            background-color: #4CAF50;
            color: white;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 12px;
            margin-left: 5px;
        }
        .inactive-badge {
            display: inline-block;
            background-color: #f44336;
            color: white;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 12px;
            margin-left: 5px;
        }
        .error-badge {
            display: inline-block;
            background-color: #ff9800;
            color: white;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 12px;
            margin-left: 5px;
        }
        .summary {
            background-color: #e8f5e9;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .error-message {
            color: #f44336;
            font-size: 12px;
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <h1>AllNads Templates by Type</h1>
    <div class="summary">
        <h3>Summary:</h3>`;

  // Add summary section
  let totalTemplates = 0;
  let totalValidTemplates = 0;
  let totalErrorTemplates = 0;
  
  Object.entries(templatesByType).forEach(([type, templates]) => {
    const validTemplates = templates.filter(t => !t.hasError);
    const errorTemplates = templates.filter(t => t.hasError);
    
    totalTemplates += templates.length;
    totalValidTemplates += validTemplates.length;
    totalErrorTemplates += errorTemplates.length;
    
    html += `
        <p>${type}: ${templates.length} templates (${validTemplates.length} valid, ${errorTemplates.length} with errors)</p>`;
  });
  
  html += `
        <p><strong>Total Templates: ${totalTemplates} (${totalValidTemplates} valid, ${totalErrorTemplates} with errors)</strong></p>
    </div>`;

  // Add templates for each type
  Object.entries(templatesByType).forEach(([type, templates]) => {
    html += `
    <h2>${type} (${templates.length})</h2>
    <div class="template-grid">`;

    templates.forEach((template: any) => {
      // Format price from wei to ETH
      const priceInEth = Number(template.price) / 1e18;
      
      // Create image tag - using PNG header + base64 data if available
      let imageTag;
      if (template.hasError) {
        imageTag = `<div class="template-image-placeholder">Error loading template data</div>`;
      } else if (!template.imageData) {
        imageTag = `<div class="template-image-placeholder">No image data available</div>`;
      } else {
        try {
          imageTag = `<img class="template-image" src="data:image/png;base64,${PNG_HEADER}${template.imageData}" alt="${template.name}" onerror="this.onerror=null; this.parentNode.innerHTML='<div class=\'template-image-placeholder\'>Failed to load image</div>'">`;
        } catch (e) {
          imageTag = `<div class="template-image-placeholder">Error with image data</div>`;
        }
      }

      // Create status badge
      let statusBadge;
      if (template.hasError) {
        statusBadge = `<span class="error-badge">Error</span>`;
      } else {
        statusBadge = template.isActive ? 
          `<span class="active-badge">Active</span>` : 
          `<span class="inactive-badge">Inactive</span>`;
      }

      html += `
        <div class="template-card">
            ${imageTag}
            <div class="template-name">${template.name || 'Unknown'} ${statusBadge}</div>
            <div class="template-info"><strong>Template ID:</strong> ${template.id}</div>
            <div class="template-info"><strong>Price:</strong> ${isNaN(priceInEth) ? 'Unknown' : priceInEth} ETH</div>
            <div class="template-info"><strong>Supply:</strong> ${template.currentSupply || '?'}/${template.maxSupply == 0n ? "∞" : (template.maxSupply || '?')}</div>
            <div class="template-info"><strong>Creator:</strong> ${formatAddress(template.creator || '0x0000000000000000000000000000000000000000')}</div>
            ${template.errorMessage ? `<div class="error-message">${template.errorMessage}</div>` : ''}
        </div>`;
    });

    html += `
    </div>`;
  });

  // Close HTML tags
  html += `
</body>
</html>`;

  return html;
}

async function main() {
  try {
    // Check if help is requested
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      printUsage();
      return;
    }

    // Get network from command line
    const networkName = process.env.NETWORK || process.argv[2] || 'localhost';
    
    // Get active-only flag
    const activeOnly = process.argv.includes('active-only');
    
    // Get sort option
    let sortOption = 'id'; // default
    if (process.argv.includes('sort-by-name')) {
      sortOption = 'name';
    } else if (process.argv.includes('sort-by-price')) {
      sortOption = 'price';
    }
    
    // Add debug mode flag
    const debugMode = process.argv.includes('--debug');
    
    if (!['monadTestnet', 'localhost'].includes(networkName)) {
      console.error(`Invalid network: ${networkName}. Must be 'monadTestnet' or 'localhost'`);
      printUsage();
      process.exit(1);
    }
    
    console.log(`Using network: ${networkName}`);
    if (activeOnly) {
      console.log('Filtering to show only active templates');
    }
    console.log(`Sorting templates by: ${sortOption}`);
    if (debugMode) {
      console.log('Debug mode enabled - extra logging will be shown');
    }
    
    // Get network configuration
    const networkConfig = NETWORKS[networkName as keyof typeof NETWORKS];
    if (!networkConfig) {
      throw new Error(`Network configuration not found for: ${networkName}`);
    }
    
    // Get contract address
    const contractAddress = networkConfig.address;
    console.log(`Using contract address: ${contractAddress}`);
    
    // Setup public client
    const client = createPublicClient({
      chain: networkConfig.chain,
      transport: http(),
    });
    
    // Test connection
    try {
      const blockNumber = await client.getBlockNumber();
      console.log(`Connected to blockchain. Current block number: ${blockNumber}`);
    } catch (error) {
      console.error('Failed to connect to blockchain:', error);
      throw new Error('Connection test failed');
    }
    
    console.log('Fetching templates by component type...');
    
    // Create an object to store templates by type
    const typeNames = Object.keys(COMPONENT_TYPES);
    const typeValues = Object.values(COMPONENT_TYPES);
    const templatesByType: Record<string, any[]> = {};
    
    // Fetch templates for each component type
    for (let i = 0; i < typeNames.length; i++) {
      const typeName = typeNames[i];
      const typeValue = typeValues[i];
      
      console.log(`Fetching templates for ${typeName}...`);
      
      try {
        const templates = await getTemplatesByType(client, contractAddress, typeValue);
        
        // Filter templates if active-only is specified
        const filteredTemplates = activeOnly ? templates.filter(t => t.isActive) : templates;
        
        // Sort templates based on sort option
        const sortedTemplates = sortTemplates(filteredTemplates, sortOption);
        
        templatesByType[typeName] = sortedTemplates;
        console.log(`Found ${sortedTemplates.length} templates for ${typeName}${activeOnly ? ' (active only)' : ''}`);
      } catch (error) {
        console.error(`Failed to fetch templates for ${typeName}:`, error);
        templatesByType[typeName] = [];
      }
    }
    
    // Generate HTML
    console.log('Generating HTML...');
    const html = generateHTML(templatesByType);
    
    // Ensure the output directory exists
    const outputDir = path.join(__dirname, '../output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write HTML to file
    const activeOnlySuffix = activeOnly ? '_active_only' : '';
    const sortSuffix = sortOption !== 'id' ? `_sort_by_${sortOption}` : '';
    const htmlPath = path.join(outputDir, `templates_by_type_${networkName}${activeOnlySuffix}${sortSuffix}.html`);
    fs.writeFileSync(htmlPath, html);
    console.log(`\nHTML report generated at: ${htmlPath}`);
    
    // Also save JSON data for reference
    const jsonPath = path.join(outputDir, `templates_by_type_${networkName}${activeOnlySuffix}${sortSuffix}.json`);
    fs.writeFileSync(jsonPath, stringifyBigInt(templatesByType));
    console.log(`JSON data saved at: ${jsonPath}`);
    
    // Success!
    console.log("\nTemplate report generated successfully!");
  } catch (error) {
    console.error("\n🔴 Error in main function:", error);
    process.exit(1);
  }
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("🔴 Fatal error:", error);
    process.exit(1);
  }); 