# AllNads - Avatars with Token Bound Accounts

AllNads is a collection of NFT avatars with ERC6551 Token Bound Accounts, allowing each avatar NFT to own assets and interact with other contracts.

## Overview

AllNads is a complete reimagining of the WeNads project, incorporating the ERC6551 standard for Token Bound Accounts. Each AllNads NFT is an avatar with customizable components, and has its own smart contract account that can own assets and interact with other contracts.

## Key Features

- **Token Bound Accounts**: Each AllNads NFT has its own smart contract account
- **Customizable Avatars**: Avatars can be customized with different components
- **Component Ownership**: Components are ERC1155 tokens that can be owned by either users or avatar accounts
- **On-chain Rendering**: Avatar metadata and images are generated on-chain
- **Fully Transferable**: Unlike the original project, AllNads are standard NFTs that can be transferred

## Architecture

The project consists of five main contracts:

1. **AllNads.sol**: The main ERC721 NFT contract that represents avatars
2. **AllNadsAccount.sol**: The ERC6551 account implementation for token bound accounts
3. **AllNadsRegistry.sol**: The ERC6551 registry for creating token bound accounts
4. **AllNadsComponent.sol**: ERC1155 contract for avatar components
5. **AllNadsRenderer.sol**: On-chain renderer for avatar metadata and images

## How It Works

1. When a user mints an AllNads NFT, a token bound account is automatically created for that NFT
2. The user can mint components from the AllNadsComponent contract
3. The user can add these components to their avatar NFT, transferring ownership to the NFT's token bound account
4. The avatar can be customized by adding/removing components
5. If the avatar is transferred, all components owned by its token bound account move with it

## Using the ERC6551 Account

Each AllNads NFT has its own contract account that can:

- Own other NFTs and tokens
- Execute transactions to any contract
- Participate in DeFi protocols
- Hold an on-chain history and identity

To interact with an NFT's account:

```javascript
// Get the account address for an NFT
const accountAddress = await allNadsContract.accountForToken(tokenId);

// Execute a transaction from the NFT's account (must be called by the NFT owner)
await allNadsAccountContract.executeCall(
  targetAddress,
  value,
  data,
  0 // operation type (0 = call)
);
```

## Getting Started

### Prerequisites

- Node.js >= 16
- Hardhat

### Installation

1. Clone the repository
   ```
   git clone https://github.com/yourusername/allnads.git
   cd allnads
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Compile contracts
   ```
   npx hardhat compile
   ```

4. Run tests
   ```
   npx hardhat test
   ```

5. Deploy contracts
   ```
   npx hardhat run scripts/deploy-allnads.js --network [network]
   ```

## License

MIT 