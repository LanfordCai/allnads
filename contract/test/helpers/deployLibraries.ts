import hre from "hardhat";

export async function deployPNGHeaderLib() {
  // Deploy PNGHeaderLib library
  const pngHeaderLibFactory = await hre.viem.deployContract("PNGHeaderLib");
  return pngHeaderLibFactory;
} 