declare module '@modelcontextprotocol/sdk' {
  export class Client {
    constructor(transport: any);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    request(request: any, schema: any): Promise<any>;
  }

  export class StdioClientTransport {
    constructor(options: { command: string; args: string[] });
  }

  export namespace Protocol {
    export const ListToolsResultSchema: any;
    export const CallToolResultSchema: any;
  }
} 