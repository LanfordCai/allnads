interface Config {
  privy: {
    appId: string;
    apiKey: string;
    apiSecret: string;
  };
}

export const config: Config = {
  privy: {
    appId: process.env.PRIVY_APP_ID || '',
    apiKey: process.env.PRIVY_API_KEY || '',
    apiSecret: process.env.PRIVY_API_SECRET || '',
  },
}; 