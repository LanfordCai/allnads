# EVM MCP Server

An MCP (Model Context Protocol) server for interacting with EVM (Ethereum Virtual Machine) blockchains. This server allows AI agents like Claude to interact with blockchain data and smart contracts.

## Features

- **Account Balance**: Get the balance of any Ethereum address on various EVM chains
- **Block Information**: Retrieve details about specific blocks or the latest block
- **Contract Calls**: Make read-only calls to smart contracts
- **Transaction Information**: Get detailed information about transactions
- **Gas Price**: Fetch current gas prices, including EIP-1559 fee data

## Supported Chains

- Ethereum
- Optimism
- Arbitrum
- Polygon
- Base
- Avalanche
- Custom chains via custom RPC URLs

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/evm-mcp-server.git
cd evm-mcp-server

# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

### Running the Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

### Using with Claude Desktop

1. Run the setup script to configure Claude Desktop:
```bash
./claude-desktop-setup.sh
```

2. Restart Claude Desktop
3. Ask Claude to interact with EVM blockchains

### Using with Cursor Editor

1. Run the setup script to configure Cursor:
```bash
./cursor-setup.sh
```

2. Restart Cursor Editor
3. You can now ask Cursor to interact with EVM blockchains using the same prompts

### Testing the Server

```bash
# Run the test client
npx ts-node src/test-client.ts
```

## Example Prompts

- "Check the balance of 0x7b65b75d204abed71587c9e519a89277766ee1d0 on Ethereum"
- "Get information about the latest block on Optimism"
- "Call the balanceOf function on the USDC contract at 0x456..."
- "Get details about transaction 0x789..."
- "What's the current gas price on Ethereum?"

## Project Structure

```
├── src/
│   ├── server.ts              # Main server file
│   ├── test-client.ts         # Test client for the server
│   ├── tools/                 # Tool implementations
│   │   ├── accountBalance.ts  # Account balance tool
│   │   ├── blockInfo.ts       # Block information tool
│   │   ├── contractCall.ts    # Contract call tool
│   │   ├── transactionInfo.ts # Transaction information tool
│   │   └── gasPrice.ts        # Gas price tool
│   └── utils/
│       └── ethers.ts          # Ethers.js provider utilities
├── claude-desktop-setup.sh    # Setup script for Claude Desktop
├── cursor-setup.sh            # Setup script for Cursor Editor
├── package.json               # Project dependencies
├── tsconfig.json              # TypeScript configuration
└── README.md                  # Project documentation
```

## Technical Details

This project uses the official [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) to implement an MCP server that provides blockchain-related tools to AI assistants. The server:

1. Creates an MCP server instance using `McpServer` from the SDK
2. Registers various blockchain tools (account balance, block info, etc.)
3. Sets up an Express server with SSE (Server-Sent Events) for communication
4. Handles client connections and messages

## Development

### Adding New Tools

To add a new tool:

1. Create a new file in the `src/tools/` directory following the existing pattern
2. Implement the tool with the appropriate schema and handler
3. Register the tool in `src/server.ts` using the `server.tool()` method

## License

MIT 