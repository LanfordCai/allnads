import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import "@nomicfoundation/hardhat-ignition";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  sourcify: {
    enabled: true,
    apiUrl: "https://sourcify-api-monad.blockvision.org",
    browserUrl: "https://testnet.monadexplorer.com"
  },
  etherscan: {
    enabled: false
  },
  networks: {
    monadDevnet: {
      url: process.env.MONAD_DEVNET_RPC as string,
      chainId: 20143,
      accounts: [process.env.MONAD_PRIVATE_KEY as string]
    },
    monadTestnet: {
      url: process.env.MONAD_TESTNET_RPC as string,
      chainId: 10143,
      accounts: [process.env.MONAD_PRIVATE_KEY as string]
    },
    hardhat: {
      mining: {
        auto: true,
        interval: 5000
      }
    }
  }
};

export default config;
