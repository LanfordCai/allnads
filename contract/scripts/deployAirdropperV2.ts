// @ts-nocheck
import { ignition } from "hardhat";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function main() {
  // Get the network from command line arguments
  const network = process.env.HARDHAT_NETWORK || "localhost";
  console.log(`Deploying AllNadsAirdropperV2 to ${network}...`);

  // Get the AllNads contract address based on the network
  let allNadsAddress: string;
  if (network === "monadTestnet") {
    allNadsAddress = process.env.MONAD_TESTNET_ALLNADS_ADDRESS;
    if (!allNadsAddress) {
      throw new Error("MONAD_TESTNET_ALLNADS_ADDRESS environment variable is required");
    }
  } else if (network === "localhost") {
    allNadsAddress = process.env.LOCALHOST_ALLNADS_ADDRESS;
    if (!allNadsAddress) {
      throw new Error("LOCALHOST_ALLNADS_ADDRESS environment variable is required");
    }
  } else {
    throw new Error(`Unsupported network: ${network}`);
  }

  console.log(`Using AllNads contract address: ${allNadsAddress}`);

  // Import the module
  const airdropperV2Module = await import("../ignition/modules/airdropperV2");

  // Deploy the updated AllNadsAirdropper contract
  const deploymentResult = await ignition.deploy(airdropperV2Module.default, {
    parameters: {
      allNadsAddress,
    },
  });

  // Get the deployed contract address
  const airdropperV2Address = deploymentResult.airdropperV2.address;
  console.log(`AllNadsAirdropperV2 deployed to: ${airdropperV2Address}`);

  // Provide instructions for updating environment variables
  console.log("\nDeployment complete! Please update your environment variables:");
  if (network === "monadTestnet") {
    console.log(`MONAD_TESTNET_AIRDROPPER_V2_ADDRESS=${airdropperV2Address}`);
  } else if (network === "localhost") {
    console.log(`LOCALHOST_AIRDROPPER_V2_ADDRESS=${airdropperV2Address}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 