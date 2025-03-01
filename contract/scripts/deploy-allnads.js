// A script to deploy the AllNads contracts

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Step 1: Deploy the ERC6551 Registry
  console.log("Deploying AllNadsRegistry...");
  const Registry = await ethers.getContractFactory("AllNadsRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("AllNadsRegistry deployed to:", registryAddress);

  // Step 2: Deploy the Account Implementation
  console.log("Deploying AllNadsAccount...");
  const Account = await ethers.getContractFactory("AllNadsAccount");
  const account = await Account.deploy();
  await account.waitForDeployment();
  const accountAddress = await account.getAddress();
  console.log("AllNadsAccount deployed to:", accountAddress);

  // Step 3: Deploy the Component Contract
  console.log("Deploying AllNadsComponent...");
  const Component = await ethers.getContractFactory("AllNadsComponent");
  // Using empty baseURI since we're providing full data URIs in the contract
  const component = await Component.deploy("");
  await component.waitForDeployment();
  const componentAddress = await component.getAddress();
  console.log("AllNadsComponent deployed to:", componentAddress);

  // Step 4: Deploy the Main NFT Contract
  console.log("Deploying AllNads...");
  const AllNads = await ethers.getContractFactory("AllNads");
  const allNads = await AllNads.deploy(
    "AllNads", // Name
    "NADS",    // Symbol
    registryAddress,
    accountAddress
  );
  await allNads.waitForDeployment();
  const allNadsAddress = await allNads.getAddress();
  console.log("AllNads deployed to:", allNadsAddress);

  // Step 5: Deploy the Renderer Contract
  console.log("Deploying AllNadsRenderer...");
  
  // This is a placeholder for the default body data
  // In production, you would provide a base64 encoded PNG data for the default body
  const defaultBodyData = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  
  const Renderer = await ethers.getContractFactory("AllNadsRenderer");
  const renderer = await Renderer.deploy(defaultBodyData);
  await renderer.waitForDeployment();
  const rendererAddress = await renderer.getAddress();
  console.log("AllNadsRenderer deployed to:", rendererAddress);

  // Step 6: Configure Contracts
  console.log("Configuring contracts...");

  // Set renderer in AllNads
  const tx1 = await allNads.setBaseURI(`${rendererAddress}/`);
  await tx1.wait();
  console.log("Base URI set in AllNads");

  // Set component contract address in renderer
  const tx2 = await renderer.setContracts(allNadsAddress, componentAddress);
  await tx2.wait();
  console.log("Contracts set in Renderer");

  // Set AllNads contract address in component contract
  const tx3 = await component.setAllNadsContract(allNadsAddress);
  await tx3.wait();
  console.log("AllNads contract set in Component contract");

  console.log("Deployment and configuration complete!");
  console.log({
    registry: registryAddress,
    account: accountAddress,
    component: componentAddress,
    allNads: allNadsAddress,
    renderer: rendererAddress
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 