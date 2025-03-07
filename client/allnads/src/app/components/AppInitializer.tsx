'use client';

import { useEffect } from 'react';
import { usePrivyTokens } from '../hooks/usePrivyTokens';
import { NFTService } from '../services/NFTService';

export function AppInitializer() {
  const { getTokens } = usePrivyTokens();
  
  useEffect(() => {
    // Initialize NFTService with token getter
    NFTService.initialize(getTokens);
  }, [getTokens]);
  
  // This component doesn't render anything
  return null;
} 