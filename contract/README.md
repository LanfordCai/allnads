# AllNads Project

This project contains smart contracts and utility scripts for the AllNads NFT project.

## Basic Hardhat Commands

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.ts
```

## Utility Scripts

This project includes several utility scripts to interact with the AllNads contracts:

### Template Creation

Create NFT templates by uploading images to the contract:

```shell
# Install required dependencies first
npm install

# Create templates on localhost network (default)
npm run create-templates

# Create templates on Monad testnet
npm run create-templates -- monadTestnet
```

### Mint NFT Tokens

Mint tokens from existing templates:

```shell
# Mint 1 token from template #1 on localhost
npm run mint-token

# Mint 3 tokens from template #5 on Monad testnet
npm run mint-token -- monadTestnet 5 3

# Get help with command options
npm run mint-token -- --help
```

### View Token Metadata and SVG

View metadata and generate HTML viewer for an AllNads token:

```shell
# View token #1 on localhost (default)
npm run view-token

# View token #5 on Monad testnet
npm run view-token -- monadTestnet 5

# Get help with command options
npm run view-token -- --help
```

### Simple SVG Viewer

Generate a minimal HTML viewer that only shows the SVG image:

```shell
# View SVG for token #1 on localhost (default)
npm run view-svg

# View SVG for token #3 on Monad testnet
npm run view-svg -- monadTestnet 3

# Get help with command options
npm run view-svg -- --help
```

## Environment Setup

Create a `.env` file with the following variables:

```
MONAD_TESTNET_RPC=https://rpc.testnet.monad.xyz/
MONAD_PRIVATE_KEY=your_private_key_here
HARDHAT_PRIVATE_KEY=your_private_key_here
```

Note: Never commit your private keys to version control!
