// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { JsonRpcPayload } from 'ethers/lib.commonjs/providers';
import { toQuantity } from 'ethers/lib.commonjs/utils';
import { formatBlock } from '../../utils.ethereum';
import { CeloJsonRpcBatchProvider } from './celo-json-rpc-batch-provider';

describe('CeloJsonRpcProvider', () => {
  let provider: CeloJsonRpcBatchProvider;

  beforeEach(() => {
    provider = new CeloJsonRpcBatchProvider(
      'https://celo.api.onfinality.io/public',
    );
  });

  // Test if gasLimit is correctly set for blocks before the hard fork
  it('should set gasLimit to zero for blocks before the hard fork', async () => {
    const payload: JsonRpcPayload = {
      method: 'eth_getBlockByNumber',
      params: [toQuantity(16068684), true],
      id: 1,
      jsonrpc: '2.0',
    };
    const block = formatBlock(await provider._send(payload));
    expect(BigInt(block.gasLimit)).toEqual(BigInt(0));
  });

  // Test if gasLimit is correctly set for blocks after the hard fork
  it('should not set gasLimit to zero for blocks after the hard fork', async () => {
    const payload: JsonRpcPayload = {
      method: 'eth_getBlockByNumber',
      params: [toQuantity(21055596), true],
      id: 1,
      jsonrpc: '2.0',
    };
    const block = formatBlock(await provider._send(payload));
    expect(BigInt(block.gasLimit)).toEqual(BigInt(0x1312d00));
    const block = formatBlock(
      await provider.send('eth_getBlockByNumber', ['latest', true]),
    );
    expect(BigNumber.from(block.gasLimit)).toEqual(BigNumber.from(0x01e84800));
  });
});
