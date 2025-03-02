interface Config {
  privy: {
    appId: string;
    apiSecret: string;
  };
}

export const config: Config = {
  privy: {
    appId: process.env.PRIVY_APP_ID || '',
    apiSecret: process.env.PRIVY_APP_SECRET || '',
  },
}; 