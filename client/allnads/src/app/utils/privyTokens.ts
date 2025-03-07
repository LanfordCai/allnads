import { usePrivy, useIdentityToken } from '@privy-io/react-auth';

export function usePrivyTokens(): { accessToken: string | null; identityToken: string | null } | Promise<{ accessToken: string | null; identityToken: string | null }> {
  const privy = usePrivy();
  const { identityToken } = useIdentityToken();

  if (!privy.authenticated) {
    return { accessToken: null, identityToken: null };
  }
  
  try {
    return privy.getAccessToken().then(accessToken => ({
      accessToken,
      identityToken
    }));
  } catch (error) {
    console.error('Failed to get Privy access token:', error);
    return { accessToken: null, identityToken: null };
  }
} 