// Copyright 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

// Tron chain IDs: Mainnet, Shasta testnet, Nile testnet
export const TRON_CHAIN_IDS = [728126428, 2494104990, 3448148188];

// Methods that accept transaction objects as parameters
export const TRON_TRANSACTION_METHODS = ['eth_call'];

/**
 * Methods that require block number parameter and the index of that parameter
 *
 * IMPORTANT TRON LIMITATION:
 * Tron RPC rejects numeric block tags with error code -32602 and message:
 * "QUANTITY not supported, just support TAG as latest"
 *
 * We forcibly replace ALL numeric block parameters with 'latest' for Tron chains.
 * This means all state-querying methods (eth_call, eth_getBalance, eth_getCode,
 * eth_getTransactionCount, eth_getStorageAt) will return tip/current state rather
 * than point-in-time state for historical indexing.
 *
 * OPERATIONAL IMPACT:
 * SubQL indexers CANNOT obtain historical state via these calls on Tron chains.
 * All state queries will always return the current/latest state regardless of
 * the block number requested.
 */
export const TRON_BLOCK_NUMBER_METHODS: Record<string, number> = {
  eth_call: 1,
  eth_getStorageAt: 2,
  eth_getBalance: 1,
  eth_getCode: 1,
  eth_getTransactionCount: 1,
};

/**
 * Remove type and accessList from transaction objects in params for Tron chains
 */
export function cleanParamsForTron(
  params: Array<any>,
  chainId: number,
): Array<any> {
  if (!TRON_CHAIN_IDS.includes(chainId)) {
    return params;
  }

  return params.map((param) => {
    if (param && typeof param === 'object' && !Array.isArray(param)) {
      const cleaned = { ...param };
      delete cleaned.type;
      delete cleaned.accessList;
      return cleaned;
    }
    return param;
  });
}

/**
 * Replace block number parameter with 'latest' for Tron chains
 *
 * CRITICAL TRON RPC LIMITATION:
 * The Tron RPC implementation does not support numeric block tags (QUANTITY).
 * When a numeric block number is provided, Tron returns JSON-RPC error -32602
 * with message: "QUANTITY not supported, just support TAG as latest"
 *
 * This function forcibly replaces any block number parameter with 'latest' to
 * prevent this error. However, this introduces a significant limitation:
 *
 * LIMITATION:
 * All state-querying methods will return the CURRENT/TIP state rather than
 * point-in-time historical state. This means:
 * - eth_call: Will execute against current state, not historical state
 * - eth_getBalance: Returns current balance, not historical balance
 * - eth_getCode: Returns current contract code, not historical code
 * - eth_getTransactionCount: Returns current nonce, not historical nonce
 * - eth_getStorageAt: Returns current storage value, not historical value
 *
 * IMPACT ON INDEXERS:
 * SubQL indexers running on Tron chains CANNOT query historical state via
 * these RPC methods. Indexers must rely solely on event logs and block data
 * for historical information. Any smart contract state queries will always
 * reflect the current state, not the state at the block being indexed.
 */
export function replaceBlockNumberForTron(
  method: string,
  params: Array<any>,
  chainId: number,
): Array<any> {
  if (!TRON_CHAIN_IDS.includes(chainId)) {
    return params;
  }

  const blockNumberIndex = TRON_BLOCK_NUMBER_METHODS[method];
  if (blockNumberIndex === undefined || params.length <= blockNumberIndex) {
    return params;
  }

  // Always replace with 'latest' for Tron chains
  // This prevents the -32602 error: "QUANTITY not supported, just support TAG as latest"
  const cleaned = [...params];
  cleaned[blockNumberIndex] = 'latest';
  return cleaned;
}
