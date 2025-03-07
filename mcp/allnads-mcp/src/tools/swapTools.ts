import { type Address, isAddress, encodeFunctionData, parseEther, formatEther } from 'viem';
import { bigint, z } from 'zod';
import { createTextResponse, ContentResult } from './types';
import { getPublicClient } from '../utils/viem';
import { ERC20_TOKENS } from '../utils/supportedErc20Tokens';

// Uniswap V2 Factory ABI (minimal for getPair)
const UniswapV2FactoryABI = [
  {
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' }
    ],
    name: 'getPair',
    outputs: [{ name: 'pair', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

// Uniswap V2 Pair ABI (minimal for getReserves)
const UniswapV2PairABI = [
  {
    inputs: [],
    name: 'getReserves',
    outputs: [
      { name: 'reserve0', type: 'uint112' },
      { name: 'reserve1', type: 'uint112' },
      { name: 'blockTimestampLast', type: 'uint32' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'token0',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'token1',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

// Uniswap V2 Factory address
const UNISWAP_V2_FACTORY_ADDRESS = '0x733e88f248b742db6c14c0b1713af5ad7fdd59d0' as Address;

// ExecuteCall ABI for using allNadsAccount to execute transactions
const ExecuteCallABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "value",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      }
    ],
    "name": "executeCall",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "result",
        "type": "bytes"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  }
];

// Add a helper function to ensure the value is properly formatted as a hex string
function toHexString(value: bigint | number): `0x${string}` {
  return `0x${value.toString(16)}` as `0x${string}`;
}

/**
 * Formats a token amount according to its decimals
 * @param amount The raw amount as a bigint
 * @param decimals The number of decimals for the token
 * @returns A formatted string representation of the amount
 */
function formatTokenAmount(amount: bigint, decimals: number): string {
  if (amount === 0n) return '0';

  const amountStr = amount.toString();

  // If the amount is less than 10^decimals, we need to pad with leading zeros
  if (amountStr.length <= decimals) {
    const paddedAmount = amountStr.padStart(decimals + 1, '0');
    const integerPart = paddedAmount.slice(0, -decimals) || '0';
    const fractionalPart = paddedAmount.slice(-decimals).replace(/0+$/, '');

    return fractionalPart ? `${integerPart}.${fractionalPart}` : integerPart;
  } else {
    const integerPart = amountStr.slice(0, amountStr.length - decimals);
    const fractionalPart = amountStr.slice(amountStr.length - decimals).replace(/0+$/, '');

    return fractionalPart ? `${integerPart}.${fractionalPart}` : integerPart;
  }
}

/**
 * Calculate the amount out based on Uniswap V2 formula
 * @param amountIn The input amount
 * @param reserveIn The reserve of the input token
 * @param reserveOut The reserve of the output token
 * @returns The output amount
 */
function getAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (amountIn === 0n) return 0n;
  if (reserveIn === 0n || reserveOut === 0n) return 0n;

  // Uniswap V2 formula: amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
  const amountInWithFee = amountIn * 997n;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 1000n + amountInWithFee;

  return numerator / denominator;
}

/**
 * Tool for getting price quotes from Uniswap V2
 */
export const uniswapQuoteTool = {
  name: 'uniswap_quote',
  description: `
  Get a price quote from Uniswap V2 for swapping between two tokens.
  Supported tokens: Wrapped Monad(WMON), Moyaki(YAKI), Chog(CHOG), Molandak(DAK), USDT, USDC, WBTC.
  You can specify tokens by name, symbol, or contract address.
  The tool will check if a liquidity pair exists and return the current exchange rate.`,
  parameters: z.object({
    tokenIn: z.string()
      .refine(input => {
        // Check if the input matches any token's name, symbol, or contract address
        return Object.entries(ERC20_TOKENS).some(([key, token]) =>
          key === input ||
          token.symbol === input ||
          token.name === input ||
          token.contractAddress === input
        );
      }, {
        message: 'Invalid tokenIn. Please provide a valid token name, symbol, or contract address',
        path: ['tokenIn']
      })
      .describe('The input token (name, symbol, or contract address)'),
    tokenOut: z.string()
      .refine(input => {
        // Check if the input matches any token's name, symbol, or contract address
        return Object.entries(ERC20_TOKENS).some(([key, token]) =>
          key === input ||
          token.symbol === input ||
          token.name === input ||
          token.contractAddress === input
        );
      }, {
        message: 'Invalid tokenOut. Please provide a valid token name, symbol, or contract address',
        path: ['tokenOut']
      })
      .describe('The output token (name, symbol, or contract address)'),
    amountIn: z.string()
      .describe('The amount of input tokens to swap')
  }),

  execute: async (params: { tokenIn: string, tokenOut: string, amountIn: string }): Promise<ContentResult> => {
    try {
      const { tokenIn, tokenOut, amountIn } = params;
      const publicClient = getPublicClient();

      // Find tokenIn info
      let tokenInInfo;
      for (const [key, info] of Object.entries(ERC20_TOKENS)) {
        if (key === tokenIn ||
          info.symbol === tokenIn ||
          info.name === tokenIn ||
          info.contractAddress === tokenIn) {
          tokenInInfo = info;
          break;
        }
      }

      if (!tokenInInfo) {
        return createTextResponse('Invalid input token');
      }

      // Find tokenOut info
      let tokenOutInfo;

      // Special case for MON (native token)
      if (tokenOut === 'MON') {
        // For MON (native token), we don't assign a contract address
        tokenOutInfo = {
          symbol: 'MON',
          name: 'Monad',
          decimals: 18
        };
      } else {
        // Regular ERC20 token lookup
        for (const [key, info] of Object.entries(ERC20_TOKENS)) {
          if (key === tokenOut ||
            info.symbol === tokenOut ||
            info.name === tokenOut ||
            info.contractAddress === tokenOut) {
            tokenOutInfo = info;
            break;
          }
        }
      }

      if (!tokenOutInfo) {
        return createTextResponse('Invalid output token');
      }

      // Convert amountIn to the correct decimal representation
      const amountInParsed = parseFloat(amountIn);
      if (isNaN(amountInParsed)) {
        return createTextResponse('Invalid amount');
      }

      // Convert to wei (with proper decimals)
      const amountInWei = BigInt(Math.floor(amountInParsed * 10 ** tokenInInfo.decimals));

      // Check if we're dealing with ETH (MON in this case)
      const isETHIn = tokenIn === 'MON';
      const isETHOut = tokenOut === 'MON';

      // For MON (native token), we need to use WMON for the pair lookup
      const WMON_ADDRESS = ERC20_TOKENS['Wrapped Monad'].contractAddress;

      // For pair lookup and path creation, we need to use the actual token addresses
      // For MON, we use WMON address
      const tokenInAddressForPair = isETHIn ? WMON_ADDRESS : (tokenInInfo.contractAddress as Address);
      const tokenOutAddressForPair = isETHOut ? WMON_ADDRESS : (tokenOutInfo.contractAddress as Address);

      // Get the pair address from the factory
      const pairAddress = await publicClient.readContract({
        address: UNISWAP_V2_FACTORY_ADDRESS,
        abi: UniswapV2FactoryABI,
        functionName: 'getPair',
        args: [tokenInAddressForPair, tokenOutAddressForPair]
      }) as Address;

      if (pairAddress === '0x0000000000000000000000000000000000000000') {
        return createTextResponse(`No liquidity pair found for ${tokenInInfo.symbol} and ${tokenOutInfo.symbol}`);
      }

      // Get token0 and token1 from the pair to determine the order
      const token0 = await publicClient.readContract({
        address: pairAddress,
        abi: UniswapV2PairABI,
        functionName: 'token0'
      }) as Address;

      // Get reserves from the pair
      const [reserve0, reserve1] = await publicClient.readContract({
        address: pairAddress,
        abi: UniswapV2PairABI,
        functionName: 'getReserves'
      }) as [bigint, bigint, number];

      // Determine which reserve corresponds to which token
      const isToken0 = tokenInAddressForPair.toLowerCase() === token0.toLowerCase();
      const reserveIn = isToken0 ? reserve0 : reserve1;
      const reserveOut = isToken0 ? reserve1 : reserve0;

      // Calculate the amount out using the Uniswap V2 formula
      const amountOut = getAmountOut(amountInWei, reserveIn, reserveOut);

      // Format the output amount according to decimals
      const formattedAmountOut = formatTokenAmount(amountOut, tokenOutInfo.decimals);

      // Calculate the exchange rate
      const exchangeRate = Number(amountOut) / Number(amountInWei) * (10 ** (tokenInInfo.decimals - tokenOutInfo.decimals));

      // Calculate price impact (simplified)
      const priceImpact = calculatePriceImpact(amountInWei, reserveIn);

      const result = {
        tokenIn: {
          symbol: tokenInInfo.symbol,
          name: tokenInInfo.name,
          address: tokenInInfo.contractAddress,
          amount: amountIn
        },
        tokenOut: {
          symbol: tokenOutInfo.symbol,
          name: tokenOutInfo.name,
          address: tokenOutInfo.contractAddress,
          amount: formattedAmountOut
        },
        exchangeRate: `1 ${tokenInInfo.symbol} = ${exchangeRate.toFixed(6)} ${tokenOutInfo.symbol}`,
        swapDetails: {
          pairAddress,
          reserveIn: reserveIn.toString(),
          reserveOut: reserveOut.toString(),
          priceImpact
        }
      };

      return createTextResponse(JSON.stringify(result, null, 2));
    } catch (error) {
      return createTextResponse(`Error getting Uniswap quote: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
};

/**
 * Helper function to estimate price impact based on input amount and reserve
 * This is a simplified estimation for Uniswap V2
 */
function calculatePriceImpact(amountIn: bigint, reserveIn: bigint): string {
  if (reserveIn === 0n) return "Unknown";

  // Calculate price impact as a percentage of the reserve
  const impact = Number(amountIn * 10000n / reserveIn) / 100;

  if (impact < 0.1) return "Very Low (<0.1%)";
  if (impact < 0.5) return "Low (0.1-0.5%)";
  if (impact < 1.0) return "Medium (0.5-1.0%)";
  if (impact < 3.0) return "High (1.0-3.0%)";
  return `Very High (${impact.toFixed(2)}%)`;
}

// Uniswap V2 Router ABI (minimal for swapExactTokensForTokens)
const UniswapV2RouterABI = [
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' }
    ],
    name: 'swapExactTokensForTokens',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' }
    ],
    name: 'swapExactTokensForETH',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' }
    ],
    name: 'swapExactETHForTokens',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'payable',
    type: 'function'
  }
] as const;

// ERC20 Approve ABI
const ERC20ApproveABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;

// Uniswap V2 Router address
const UNISWAP_V2_ROUTER_ADDRESS = '0xfb8e1c3b833f9e67a71c859a132cf783b645e436' as Address;

// ERC20 Allowance ABI
const ERC20AllowanceABI = [
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

const MAX_ALLOWANCE = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn

/**
 * Tool for creating a transaction to swap tokens on Uniswap V2
 */
export const uniswapSwapTool = {
  name: 'uniswap_swap',
  description: `
  Create a transaction to swap tokens on Uniswap V2.
  Supported tokens: Monad(MON, the native token), Wrapped Monad(WMON), Moyaki(YAKI), Chog(CHOG), Molandak(DAK), USDT, USDC, WBTC.
  You can specify tokens by name, symbol, or contract address.
  The tool will check if a liquidity pair exists and create the appropriate transaction.
  If approval is needed, it will return the approval transaction first.`,
  parameters: z.object({
    tokenIn: z.string()
      .refine(input => {
        // Check if the input is MON (native token)
        if (input === 'MON') return true;

        // Check if the input matches any token's name, symbol, or contract address
        return Object.entries(ERC20_TOKENS).some(([key, token]) =>
          key === input ||
          token.symbol === input ||
          token.name === input ||
          token.contractAddress === input
        );
      }, {
        message: 'Invalid tokenIn. Please provide a valid token name, symbol, or contract address',
        path: ['tokenIn']
      })
      .describe('The input token (name, symbol, or contract address)'),
    tokenOut: z.string()
      .refine(input => {
        // Check if the input is MON (native token)
        if (input === 'MON') return true;

        // Check if the input matches any token's name, symbol, or contract address
        return Object.entries(ERC20_TOKENS).some(([key, token]) =>
          key === input ||
          token.symbol === input ||
          token.name === input ||
          token.contractAddress === input
        );
      }, {
        message: 'Invalid tokenOut. Please provide a valid token name, symbol, or contract address',
        path: ['tokenOut']
      })
      .describe('The output token (name, symbol, or contract address)'),
    amountIn: z.string()
      .describe('The amount of input tokens to swap'),
    slippageTolerance: z.number()
      .min(0.1)
      .max(50)
      .default(2)
      .describe('Slippage tolerance in percentage (default: 2%)'),
    allNadsAccount: z.string()
      .refine(addr => isAddress(addr), {
        message: 'Invalid allnads account address format',
        path: ['allNadsAccount']
      })
      .describe('The allnads account that will execute the swap'),
    deadline: z.number()
      .default(Math.floor(Date.now() / 1000) + 60 * 20) // 20 minutes from now
      .describe('Transaction deadline in seconds (default: 20 minutes from now)')
  }),

  execute: async (params: {
    allNadsAccount: string,
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    slippageTolerance: number,
    deadline: number,
  }): Promise<ContentResult> => {
    try {
      const { allNadsAccount, tokenIn, tokenOut, amountIn, slippageTolerance, deadline } = params;
      const publicClient = getPublicClient();

      // Find tokenIn info
      let tokenInInfo;

      // Special case for MON (native token)
      if (tokenIn === 'MON') {
        // For MON (native token), we don't assign a contract address
        tokenInInfo = {
          symbol: 'MON',
          name: 'Monad',
          decimals: 18
        };
      } else {
        // Regular ERC20 token lookup
        for (const [key, info] of Object.entries(ERC20_TOKENS)) {
          if (key === tokenIn ||
            info.symbol === tokenIn ||
            info.name === tokenIn ||
            info.contractAddress === tokenIn) {
            tokenInInfo = info;
            break;
          }
        }
      }

      if (!tokenInInfo) {
        return createTextResponse('Invalid input token');
      }

      // Find tokenOut info
      let tokenOutInfo;

      // Special case for MON (native token)
      if (tokenOut === 'MON') {
        // For MON (native token), we don't assign a contract address
        tokenOutInfo = {
          symbol: 'MON',
          name: 'Monad',
          decimals: 18
        };
      } else {
        // Regular ERC20 token lookup
        for (const [key, info] of Object.entries(ERC20_TOKENS)) {
          if (key === tokenOut ||
            info.symbol === tokenOut ||
            info.name === tokenOut ||
            info.contractAddress === tokenOut) {
            tokenOutInfo = info;
            break;
          }
        }
      }

      if (!tokenOutInfo) {
        return createTextResponse('Invalid output token');
      }

      // Convert amountIn to the correct decimal representation
      const amountInParsed = parseFloat(amountIn);
      if (isNaN(amountInParsed)) {
        return createTextResponse('Invalid amount');
      }

      // Convert to wei (with proper decimals)
      const amountInWei = BigInt(Math.floor(amountInParsed * 10 ** tokenInInfo.decimals));

      // Check if we're dealing with ETH (MON in this case)
      const isETHIn = tokenIn === 'MON';
      const isETHOut = tokenOut === 'MON';

      // For MON (native token), we need to use WMON for the pair lookup
      const WMON_ADDRESS = ERC20_TOKENS['Wrapped Monad'].contractAddress;

      // For pair lookup and path creation, we need to use the actual token addresses
      // For MON, we use WMON address
      const tokenInAddressForPair = isETHIn ? WMON_ADDRESS : (tokenInInfo.contractAddress as Address);
      const tokenOutAddressForPair = isETHOut ? WMON_ADDRESS : (tokenOutInfo.contractAddress as Address);

      // Get the pair address from the factory
      const pairAddress = await publicClient.readContract({
        address: UNISWAP_V2_FACTORY_ADDRESS,
        abi: UniswapV2FactoryABI,
        functionName: 'getPair',
        args: [tokenInAddressForPair, tokenOutAddressForPair]
      }) as Address;

      if (pairAddress === '0x0000000000000000000000000000000000000000') {
        return createTextResponse(`No liquidity pair found for ${tokenInInfo.symbol} and ${tokenOutInfo.symbol}`);
      }

      // Get token0 and token1 from the pair to determine the order
      const token0 = await publicClient.readContract({
        address: pairAddress,
        abi: UniswapV2PairABI,
        functionName: 'token0'
      }) as Address;

      // Get reserves from the pair
      const [reserve0, reserve1] = await publicClient.readContract({
        address: pairAddress,
        abi: UniswapV2PairABI,
        functionName: 'getReserves'
      }) as [bigint, bigint, number];

      // Determine which reserve corresponds to which token
      const isToken0 = tokenInAddressForPair.toLowerCase() === token0.toLowerCase();
      const reserveIn = isToken0 ? reserve0 : reserve1;
      const reserveOut = isToken0 ? reserve1 : reserve0;

      // Calculate the amount out using the Uniswap V2 formula
      const amountOut = getAmountOut(amountInWei, reserveIn, reserveOut);

      // Apply slippage tolerance to get minimum amount out
      const slippageFactor = 1000n - BigInt(Math.floor(slippageTolerance * 10));
      const amountOutMin = (amountOut * slippageFactor) / 1000n;

      // Create the path array for the swap
      // For MON, we use WMON in the path
      const path = [tokenInAddressForPair, tokenOutAddressForPair];

      // If we're swapping ETH for tokens, we only need one transaction
      if (isETHIn) {
        // Swap ETH for Tokens
        const swapData = encodeFunctionData({
          abi: UniswapV2RouterABI,
          functionName: 'swapExactETHForTokens',
          args: [
            amountOutMin,
            path,
            allNadsAccount as `0x${string}`,
            BigInt(deadline)
          ]
        });

        // Create executeCall data to execute the swap through allNadsAccount
        const executeCallData = encodeFunctionData({
          abi: ExecuteCallABI,
          functionName: 'executeCall',
          args: [UNISWAP_V2_ROUTER_ADDRESS, amountInWei.toString(), swapData]
        });

        const transactionRequest = {
          to: allNadsAccount as Address,
          data: executeCallData,
          value: formatEther(amountInWei) // Send ETH with the transaction as hex
        };

        return createTextResponse(
          `<<TransactionRequest>>\n${JSON.stringify(transactionRequest, null, 2)}`
        );
      }

      // For token to token or token to ETH swaps, we need to check allowance first
      try {
        const currentAllowance = await publicClient.readContract({
          address: tokenInAddressForPair,
          abi: ERC20AllowanceABI,
          functionName: 'allowance',
          args: [allNadsAccount as `0x${string}`, UNISWAP_V2_ROUTER_ADDRESS]
        }) as bigint;

        // If allowance is insufficient, return an approval transaction
        if (currentAllowance < amountInWei) {
          const approveData = encodeFunctionData({
            abi: ERC20ApproveABI,
            functionName: 'approve',
            args: [UNISWAP_V2_ROUTER_ADDRESS, MAX_ALLOWANCE]
          });

          // Create executeCall data to execute the approval through allNadsAccount
          const executeCallData = encodeFunctionData({
            abi: ExecuteCallABI,
            functionName: 'executeCall',
            args: [tokenInAddressForPair, '0', approveData]
          });

          const approveTransaction = {
            to: allNadsAccount as Address,
            data: executeCallData,
            value: '0'
          };

          return createTextResponse(
            `<<TransactionRequest>>\n${JSON.stringify(approveTransaction, null, 2)}\n\n`
          );
        }
      } catch (error) {
        return createTextResponse(`Error checking token allowance: ${error instanceof Error ? error.message : String(error)}`);
      }

      // If we reach here, it means we have sufficient allowance
      // Create the swap transaction based on whether we're swapping to ETH or tokens
      if (isETHOut) {
        // Swap Tokens for ETH
        const swapData = encodeFunctionData({
          abi: UniswapV2RouterABI,
          functionName: 'swapExactTokensForETH',
          args: [
            amountInWei,
            amountOutMin,
            path,
            allNadsAccount as `0x${string}`,
            BigInt(deadline)
          ]
        });

        // Create executeCall data to execute the swap through allNadsAccount
        const executeCallData = encodeFunctionData({
          abi: ExecuteCallABI,
          functionName: 'executeCall',
          args: [UNISWAP_V2_ROUTER_ADDRESS, '0', swapData]
        });

        const swapTransaction = {
          to: allNadsAccount as Address,
          data: executeCallData,
          value: '0'
        };

        return createTextResponse(
          `<<TransactionRequest>>\n${JSON.stringify(swapTransaction, null, 2)}`
        );
      } else {
        // Swap Tokens for Tokens
        const swapData = encodeFunctionData({
          abi: UniswapV2RouterABI,
          functionName: 'swapExactTokensForTokens',
          args: [
            amountInWei,
            amountOutMin,
            path,
            allNadsAccount as `0x${string}`,
            BigInt(deadline)
          ]
        });

        // Create executeCall data to execute the swap through allNadsAccount
        const executeCallData = encodeFunctionData({
          abi: ExecuteCallABI,
          functionName: 'executeCall',
          args: [UNISWAP_V2_ROUTER_ADDRESS, '0', swapData]
        });

        const swapTransaction = {
          to: allNadsAccount as Address,
          data: executeCallData,
          value: '0'
        };

        return createTextResponse(
          `<<TransactionRequest>>\n${JSON.stringify(swapTransaction, null, 2)}`
        );
      }
    } catch (error) {
      return createTextResponse(`Error creating swap transaction: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
};
