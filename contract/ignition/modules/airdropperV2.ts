import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import * as fs from "fs";
import * as path from "path";

export default buildModule("AllNadsAirdropperV2", (m) => {
  // Read the AllNads contract address from the deployed_addresses.json file
  let allNadsAddress = "0xaeFD9d3471d5C76407F1A3F750Cbe255b5BA194C"; // Default fallback
  
  try {
    // Construct the path to the deployed_addresses.json file for Monad testnet
    const deployedAddressesPath = path.join(
      __dirname,
      "..",
      "deployments",
      "chain-10143",
      "deployed_addresses.json"
    );
    
    // Read and parse the deployed_addresses.json file
    const deployedAddresses = JSON.parse(fs.readFileSync(deployedAddressesPath, "utf8"));
    
    // Get the AllNads contract address
    allNadsAddress = deployedAddresses["AllNads#AllNads"];
    
    if (!allNadsAddress) {
      console.warn("AllNads contract address not found in deployed_addresses.json, using fallback address");
    }
  } catch (error) {
    console.warn("Error reading deployed_addresses.json, using fallback address");
  }

  console.log(`Using AllNads contract address: ${allNadsAddress}`);

  // Deploy the updated AllNadsAirdropper contract
  const airdropperV2 = m.contract("AllNadsAirdropper", [
    allNadsAddress, // Pass the AllNads contract address to the constructor
  ]);

  // Return the deployed contract for reference
  return {
    airdropperV2,
  };
}); 