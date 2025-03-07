import { usePrivy, useIdentityToken } from '@privy-io/react-auth';

export function usePrivyTokens() {
  const privy = usePrivy();
  const { identityToken } = useIdentityToken();

  const getTokens = async (): Promise<{ accessToken: string | null; identityToken: string | null }> => {
    if (!privy.authenticated) {
      return { accessToken: null, identityToken: null };
    }
    
    try {
      const accessToken = await privy.getAccessToken();
      return { accessToken, identityToken };
    } catch (error) {
      console.error('Failed to get Privy access token:', error);
      return { accessToken: null, identityToken: null };
    }
  };

  return { getTokens };
} 