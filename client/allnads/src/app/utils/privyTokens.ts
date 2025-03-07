import { usePrivy, useIdentityToken } from '@privy-io/react-auth';

export async function getPrivyTokens(): Promise<{ accessToken: string | null; identityToken: string | null }> {
  const privy = usePrivy();
  const { identityToken } = useIdentityToken();

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
} 