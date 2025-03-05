import { Client, Protocol, StdioClientTransport } from '@modelcontextprotocol/sdk';
import * as child_process from 'child_process';

async function main() {
  // Start the MCP server as a child process
  const serverProcess = child_process.spawn('node', ['--loader', 'ts-node/esm', 'src/server.ts'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`Server stdout: ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Server stderr: ${data}`);
  });

  // Wait for the server to start
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Create a client and connect to the server
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['--loader', 'ts-node/esm', 'src/server.ts'],
  });

  const client = new Client(transport);

  try {
    // Connect to the server
    await client.connect();
    console.log('Connected to server');

    // List available tools
    const tools = await client.request(
      {
        method: 'list_tools',
      },
      Protocol.ListToolsResultSchema
    );
    console.log('Available tools:', tools);

    // Test account balance tool
    const balanceResult = await client.request(
      {
        method: 'evm_account_balance',
        params: {
          address: '0x7b65b75d204abed71587c9e519a89277766ee1d0', // Vitalik's address
          chain: 'ethereum',
        },
      },
      Protocol.CallToolResultSchema
    );
    console.log('Account balance result:', balanceResult);

    // Test gas price tool
    const gasPriceResult = await client.request(
      {
        method: 'evm_gas_price',
        params: {
          chain: 'ethereum',
        },
      },
      Protocol.CallToolResultSchema
    );
    console.log('Gas price result:', gasPriceResult);

    // Disconnect from the server
    await client.disconnect();
    console.log('Disconnected from server');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Kill the server process
    serverProcess.kill();
  }
}

main().catch(console.error); 