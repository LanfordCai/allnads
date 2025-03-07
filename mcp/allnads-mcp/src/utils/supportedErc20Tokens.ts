import { Address } from "viem";

export const ERC20_TOKENS = {
  'Wrapped Monad': {
    contractAddress: '0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701' as Address,
    symbol: 'WMON',
    name: 'Wrapped Monad',
    decimals: 18
  },
  'Moyaki': {
    contractAddress: '0xfe140e1dCe99Be9F4F15d657CD9b7BF622270C50' as Address,
    symbol: 'YAKI',
    name: 'Moyaki',
    decimals: 18
  },
  'Chog': {
    contractAddress: '0xE0590015A873bF326bd645c3E1266d4db41C4E6B' as Address,
    symbol: 'CHOG',
    name: 'Chog',
    decimals: 18
  },
  'Molandak': {
    contractAddress: '0x0F0BDEbF0F83cD1EE3974779Bcb7315f9808c714' as Address,
    symbol: 'DAK',
    name: 'Molandak',
    decimals: 18
  },
  'USDT': {
    contractAddress: '0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D' as Address,
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6
  },
  'USDC': {
    contractAddress: '0xf817257fed379853cDe0fa4F97AB987181B1E5Ea' as Address,
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6
  },
  'WBTC': {
    contractAddress: '0xcf5a6076cfa32686c0Df13aBaDa2b40dec133F1d' as Address,
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    decimals: 8
  }
}