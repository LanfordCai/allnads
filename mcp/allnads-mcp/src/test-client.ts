import { Client, Protocol, StdioClientTransport } from '@modelcontextprotocol/sdk';
import { PrivyClient } from '@privy-io/server-auth';
import * as child_process from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const privyClient = new PrivyClient(
    process.env.PRIVY_APP_ID!,
    process.env.PRIVY_APP_SECRET!
  );

  const userId = 'did:privy:cm7wcgdqi00bms8psjnx2sr32'
  const user = await privyClient.getUser(userId);
  console.log('user', user);
}

main().catch(console.error); 