# [AllNads](https://allnads.app)

AllNads is a platform that integrates AI-powered smart wallets with composable NFTs on the Monad blockchain. It enables users to interact with an AI assistant through NFT-gated access, while leveraging ERC-6551 token-bound accounts to create smart wallets capable of owning assets and interacting with other contracts. The system combines web3 authentication, real-time AI chat, and dynamic NFT customization through component-based composition.

## Overview

AllNads unifies several cutting-edge technologies:

- **ERC-6551 Token-Bound Accounts**: Each NFT in the collection serves as a smart wallet capable of owning assets and interacting with other contracts
- **AI Integration**: Users can chat with an intelligent assistant that can help manage their blockchain assets
- **Composable NFTs**: NFTs can be customized with various components, creating unique visual identities
- **Privy Authentication**: Secure web3 authentication with Server Delegated Actions enabling AI to automatically sign transactions
- **Model Context Protocol (MCP)**: Allows AI agents to interact with external data and perform operations
- **Community-Driven System**: AllNads NFTs are public goods - anyone in the Monad community can mint, create, sell, and transfer components freely

## Key Features

- **Web3 Authentication**: Secure login using Privy with wallet-based authentication
- **AI-Powered Smart Wallets**: Each NFT functions as a wallet with an AI assistant that can manage assets
- **NFT Verification**: Access to the AI chatbot is gated by NFT ownership
- **Automatic Transaction Signing**: AI assistant can automatically sign transactions via Privy's Server Delegated Actions
- **Multi-Step Task Execution**: AI can handle complex requests by autonomously selecting and chaining together the appropriate tools
- **Blockchain Operations**: Send tokens, interact with smart contracts, and manage NFTs
- **Component-Based NFT System**: Customize your NFT with different components
- **Real-time Chat**: WebSocket-based chat interface with the AI assistant

## System Architecture

AllNads consists of four main components that work together to create a seamless user experience:

1. **Smart Contracts**: ERC-6551 implementation for token-bound accounts and composable NFTs on Monad blockchain
2. **Backend Server**: Node.js Express server providing API endpoints for chat, user management, and NFT operations
3. **Frontend Client**: Next.js web application with Privy authentication and real-time chat interface
4. **MCP Servers**: Model Context Protocol servers allowing AI assistants to interact with external data

## Technical Details

### Privy Authentication & Server Delegated Actions

AllNads uses Privy for secure web3 authentication. A key feature is Privy's Server Delegated Actions, which enables the AI assistant to automatically sign transactions on behalf of users after proper authorization. This creates a seamless experience where users can simply request actions in natural language, and the AI can execute them without requiring manual signature approval for each transaction.

### ERC-6551 Token-Bound Accounts

The system implements the ERC-6551 standard, which allows NFTs to own assets and interact with contracts. Each AllNads NFT acts as a smart wallet with its own address and capabilities, managed through the AllNads contracts.

### Model Context Protocol Integration

AllNads implements MCP servers that provide tools for AI assistants to interact with blockchain data and execute transactions. This enables the AI to retrieve balances, make contract calls, transfer tokens, and manage NFT components.

The AI can autonomously handle complex tasks by selecting and chaining together the appropriate tools. For example, when asked to "Swap 10 MON for USDC and send it to Alice," the AI can identify the required steps, select the appropriate tools for each step, and execute the entire workflow without requiring step-by-step instructions from the user.

### Composable NFT System

The NFT system allows for dynamic component-based customization, where each NFT can be assembled from various components. This creates unique visual identities and functional attributes for each token.

### Community-Driven Ecosystem

AllNads is designed as a public good for the Monad blockchain community. Anyone can:
- Mint AllNads NFTs freely
- Create new ERC-1155 components
- Sell components on marketplaces
- Transfer components between wallets
- Contribute to the growing ecosystem

This open approach fosters community engagement and innovation, allowing the ecosystem to grow organically through user contributions.

## Design Decisions and Technical Implementation

### Why ERC-6551?
The ERC-6551 standard was chosen because it creates a direct binding between NFTs and autonomous accounts. This provides several advantages:
- NFTs become more than just digital art; they function as smart contract wallets
- Each NFT can own assets, execute transactions, and interact with DeFi protocols
- The token-bound account structure aligns perfectly with the AI assistant concept

### Why Privy for Authentication?
Privy was selected as the authentication provider for several reasons:
- Supports email, google and X authentication, lowering barriers to entry, bring us Walletless Onboarding
- Provides Server Delegated Actions, enabling AI-driven transaction execution
- Robust security features and straightforward integration with Next.js

### WebSocket for Real-Time Chat
The decision to use WebSockets for chat communication was driven by:
- Need for real-time bi-directional communication between users and AI
- Continuous Feedback Loop: Users receive real-time progress updates as the AI works through sequential steps of a complex task

### Model Context Protocol (MCP) Architecture
MCP was implemented as separate servers to:
- Maintain separation of concerns between AI tools and core backend services
- Allow for independent scaling of AI-related infrastructure

## External Dependencies

### Frontend Dependencies
- **Next.js** (v15.x): React framework for the web application
- **TailwindCSS** (v4.x): Utility-first CSS framework for styling
- **Privy SDK**: Web3 authentication and transaction signing
- **Viem**: TypeScript library for Ethereum interactions
- **React** (v19.x): UI component library

### Backend Dependencies
- **Node.js** (v16+): JavaScript runtime environment
- **Express.js**: Web application framework
- **PostgreSQL**: Relational database with Drizzle ORM
- **WebSockets**: Real-time communication protocol
- **OpenRouter API**: AI model integration

### Blockchain Integration
- **Monad Blockchain**: Primary blockchain for NFT and smart wallet functionality
- **Viem**: Ethereum library for blockchain interactions
- **ERC-6551 Standard**: Token-bound account implementation
- **ERC-721 Standard**: For AllNads Avatar NFT.
- **ERC-1155 Standard**: For component NFTs

### MCP Server Dependencies
- **Model Context Protocol SDK**: For building AI tools
- **Ethers.js/Viem**: Ethereum libraries for blockchain interactions

## Future Development

AllNads will continue to evolve and strengthen its capabilities through:

- **Expanded MCP Tools**: Integration of additional Model Context Protocol tools to enhance AI functionality
- **Advanced DeFi Operations**: Tools for complex financial operations, yield farming, and liquidity provisioning
- **Enhanced Customization**: More component types and interaction possibilities
- **Community Governance**: Progressive decentralization of decision-making
- **AI Model Improvements**: Integration of more capable AI models and specialized training

## Component Documentation

For more detailed information about each component:

- [Backend Server](backend/README.md)
- [Smart Contracts](contract/README.md)
- [Frontend Client](client/allnads/README.md)
- [AllNads MCP Server](mcp/allnads-mcp/README.md)
- [EVM MCP Server](mcp/evm-mcp/README.md)

## License

MIT
