# Allnads MCP Server

An MCP (Model Context Protocol) server for interacting with the Allnads blockchain ecosystem. This server allows AI agents like Claude to interact with blockchain data, manage Allnads accounts, and perform various operations on the Monad blockchain.

## Features

- **MON Transfers**: Send MON tokens to other addresses
- **ERC20 Operations**: View and transfer ERC20 tokens (WMON, YAKI, CHOG, DAK, USDT, USDC, WBTC)
- **NFT Management**: Mint template components and change templates for Allnads NFTs
- **DeFi Operations**: Get quotes and perform swaps using Uniswap
- **Address Book**: Manage a personal address book for quick access to frequently used addresses
- **Transaction Signing**: Sign and submit transactions to the blockchain

## Supported Tokens

- MON (native Monad token)
- WMON (Wrapped Monad)
- YAKI (Moyaki)
- CHOG
- DAK (Molandak)
- USDT
- USDC
- WBTC

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/allnads-mcp.git
cd allnads-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

### Running the Server

```bash
# Development mode with auto-reload
USE_HTTP=true npm run dev

# Production mode
USE_HTTP=true npm start
```

### Environment Setup

Create a `.env` file in the root directory with the following variables:

```
PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret
```

## Example Prompts

- "Send 5 MON to Lanford..."
- "Show me all my ERC20 tokens"
- "Mint a template component with ID 42"
- "Change the template with token ID 123 to template ID 456"
- "Get a quote for swapping 10 WMON to USDC"
- "Add address 0x789... to my address book as 'My Friend'"

## Project Structure

```
├── src/
│   ├── server.ts                # Main server file
│   ├── test-client.ts           # Test client for the server
│   ├── tools/                   # Tool implementations
│   │   ├── addressBookTools.ts  # Address book management tools
│   │   ├── erc20Tools.ts        # ERC20 token tools
│   │   ├── sendMonTools.ts      # MON sending tools
│   │   ├── swapTools.ts         # Uniswap integration tools
│   │   ├── transactionSign.ts   # Transaction signing tool
│   │   ├── types.ts             # Type definitions for tools
│   │   └── allnadsNftTools/     # NFT-related tools
│   │       ├── changeTemplate.ts        # Template changing tool
│   │       ├── getEquippedComponents.ts # Get equipped components tool
│   │       ├── getOwnedComponents.ts    # Get owned components tool
│   │       ├── getTemplates.ts          # Get templates tool
│   │       └── mintTemplateComponent.ts # Mint template component tool
│   ├── abis/                    # Smart contract ABIs
│   │   ├── AllNads.ts           # Allnads main contract ABI
│   │   ├── AllNadsAccount.ts    # Allnads account contract ABI
│   │   ├── AllNadsComponent.ts  # Allnads component contract ABI
│   │   ├── AllNadsComponentQuery.ts # Component query contract ABI
│   │   └── ERC20.ts             # ERC20 token standard ABI
│   ├── utils/                   # Utility functions
│   │   ├── globalCache.ts       # Global caching utilities
│   │   ├── supportedErc20Tokens.ts # ERC20 token configurations
│   │   ├── templateCache.ts     # Template caching utilities
│   │   └── viem.ts              # Viem client configuration
│   ├── types/                   # TypeScript type definitions
│   │   ├── modelcontextprotocol.d.ts # MCP type definitions
│   │   └── template.ts          # Template type definitions
│   └── config/                  # Configuration files
│       ├── env.ts               # Environment configuration
│       └── networks.ts          # Network configuration
├── package.json                 # Project dependencies
├── tsconfig.json                # TypeScript configuration
├── .env.example                 # Example environment variables
└── README.md                    # Project documentation
```

## Technical Details

This project uses the official [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) to implement an MCP server that provides blockchain-related tools to AI assistants. The server:

1. Creates an MCP server instance using `McpServer` from the SDK
2. Registers various blockchain tools for Allnads ecosystem interaction
3. Sets up an Express server with SSE (Server-Sent Events) for communication
4. Handles client connections and messages
5. Uses Privy for authentication and user management

## Development

### Adding New Tools

To add a new tool:

1. Create a new file in the `src/tools/` directory following the existing pattern
2. Implement the tool with the appropriate schema and handler
3. Register the tool in `src/server.ts` using the `server.tool()` method

### Tool Structure

Each tool typically follows this structure:
- Name and description
- Parameter schema using Zod
- Execute function that performs the actual operation
- Helper functions for formatting and processing data

## License

MIT 