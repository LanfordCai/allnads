// @ts-nocheck
import hre from "hardhat";
import { parseArgs } from "node:util";
import * as fs from "fs";
import * as path from "path";
import { Address } from "viem";

async function main() {
  // Parse command line arguments
  const { positionals } = parseArgs({
    options: {
      network: { type: "string", default: "monadTestnet" },
    },
    strict: true,
    allowPositionals: true,
  });

  if (positionals.length !== 1) {
    printUsage();
    process.exit(1);
  }

  const adminAddress = positionals[0] as Address;
  const network = process.env.HARDHAT_NETWORK || "monadTestnet";
  
  console.log(`Adding admin ${adminAddress} to AllNadsAirdropperV2 on ${network}...`);

  // Get the airdropper contract address from deployed_addresses.json
  let airdropperV2Address: Address;
  
  try {
    // Determine the network ID
    let networkId: string;
    if (network === "monadTestnet") {
      networkId = "10143";
    } else if (network === "localhost") {
      networkId = "31337";
    } else {
      throw new Error(`Unsupported network: ${network}`);
    }
    
    // Construct the path to the deployed_addresses.json file
    const deployedAddressesPath = path.join(
      __dirname,
      "..",
      "ignition",
      "deployments",
      `chain-${networkId}`,
      "deployed_addresses.json"
    );
    
    // Read and parse the deployed_addresses.json file
    const deployedAddresses = JSON.parse(fs.readFileSync(deployedAddressesPath, "utf8"));
    
    // Get the AllNadsAirdropperV2 contract address
    airdropperV2Address = deployedAddresses["AllNadsAirdropperV2#AllNadsAirdropper"];
    
    if (!airdropperV2Address) {
      throw new Error(`AllNadsAirdropperV2 contract address not found in deployed_addresses.json for network ${network}`);
    }
  } catch (error) {
    console.error("Error reading deployed_addresses.json:", error);
    process.exit(1);
  }

  console.log(`Using AllNadsAirdropperV2 contract address: ${airdropperV2Address}`);

  // Get the wallet client for the network
  const [owner] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  // Get the airdropper contract
  const airdropperV2 = await hre.viem.getContractAt(
    "AllNadsAirdropper",
    airdropperV2Address,
    { client: { wallet: owner } }
  );

  // Add the admin
  console.log(`Adding ${adminAddress} as admin to airdropper at ${airdropperV2Address}...`);
  const tx = await airdropperV2.write.addAdmin([adminAddress]);
  
  // Wait for the transaction to be mined
  console.log(`Transaction sent: ${tx}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  
  console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
  console.log(`Admin ${adminAddress} successfully added to airdropper at ${airdropperV2Address}`);
}

function printUsage() {
  console.log(`
Usage: 
  npx hardhat run scripts/addAdminToAirdropperV2.ts --network <network> <admin_address>

Examples:
  npx hardhat run scripts/addAdminToAirdropperV2.ts --network localhost 0x1234...5678
  npx hardhat run scripts/addAdminToAirdropperV2.ts --network monadTestnet 0xabcd...ef01

Parameters:
  - admin_address: The address to add as an admin

Available networks:
  - localhost
  - monadTestnet (default)
  `);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 