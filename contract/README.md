# AllNads Contracts

ERC-6551 smart wallets as composable NFTs on Monad blockchain.

## Overview

AllNads is a smart wallet implementation that combines ERC-6551 token-bound accounts with composable NFTs on the Monad blockchain. Each NFT in the collection serves as a smart wallet, capable of owning assets and interacting with other contracts. The composable nature of the NFTs allows for dynamic component-based customization, where each NFT can be assembled from various components. The system includes comprehensive features for NFT minting, component management, and wallet interactions.

## Smart Contracts

- `AllNads.sol`: Main NFT contract implementing core NFT functionality
- `AllNadsComponent.sol`: Manages NFT components and their properties
- `AllNadsComponentQuery.sol`: Handles queries for NFT component data
- `AllNadsAirdropper.sol`: Manages NFT airdrop functionality
- `AllNadsAccount.sol`: Handles user account management
- `AllNadsRenderer.sol`: Renders NFT visuals
- `AllNadsRegistry.sol`: Registry contract for platform components

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A Monad network wallet with MONAD tokens for deployment

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Copy the environment file and configure your variables:
```bash
cp .env.example .env
```

## Configuration

Update the `.env` file with your configuration

## Available Scripts

- `npm run create-templates`: Create NFT templates
- `npm run view-svg`: View SVG representations of NFTs
- `npm run simple-view-svg`: Simple SVG viewer
- `npm run mint-token`: Mint new NFT tokens
- `npm run add-admin-v2`: Add admin to airdropper V2 contract
- `npm run list-templates`: List available NFT templates by type

## Development

The project uses Hardhat as the development environment with the following configuration:
- Solidity version: 0.8.28
- Optimizer enabled with 200 runs
- Sourcify integration enabled
- Support for Monad devnet and testnet networks

## Testing

Run tests using Hardhat:
```bash
npx hardhat test
```

## Deployment

Deploy to Monad testnet:
```bash
npx hardhat ignition deploy ./ignition/modules/allnads.ts --network monadTestnet
```

## License

MIT


