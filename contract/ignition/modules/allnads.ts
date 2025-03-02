import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("AllNadsDeployment", (m) => {
  // Step 1: Deploy the Registry (no dependencies)
  const registry = m.contract("AllNadsRegistry");

  // Step 2: Deploy the Account Implementation (no dependencies)
  const accountImplementation = m.contract("AllNadsAccount");

  // Step 3: Deploy the Component Contract (no dependencies)
  const componentContract = m.contract("AllNadsComponent");

  // Step 4: Set up a default body data for the renderer
  // This is a placeholder - replace with actual base64 data for the default body
  const defaultBodyData = "YOUR_DEFAULT_BODY_DATA_HERE";

  // Step 5: Deploy the Renderer (depends on component contract)
  const renderer = m.contract("AllNadsRenderer", [
    componentContract,
    defaultBodyData,
  ]);

  // Step 6: Deploy the main AllNads Contract (depends on registry, account implementation, and component contract)
  const allNads = m.contract("AllNads", [
    "AllNads", // name
    "ANADS", // symbol
    registry,
    accountImplementation,
    componentContract,
  ]);

  // Step 7: Set up post-deployment configurations

  // Set the AllNads contract address in the Component contract
  m.call(componentContract, "setAllNadsContract", [
    allNads,
  ]);

  // Set the renderer contract in the AllNads contract
  m.call(allNads, "setRendererContract", [
    renderer,
  ]);

  // Return only the deployed contracts for reference
  return {
    registry,
    accountImplementation,
    componentContract,
    renderer,
    allNads,
  };
}); 