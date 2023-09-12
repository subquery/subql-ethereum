// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { toQuantity } from 'ethers/lib.commonjs/utils';
import { formatBlock } from '../../utils.ethereum';
import { CeloJsonRpcProvider } from './celo-json-rpc-provider';

describe('CeloJsonRpcProvider', () => {
  let provider: CeloJsonRpcProvider;

  beforeEach(() => {
    provider = new CeloJsonRpcProvider('https://celo.api.onfinality.io/public	');
  });

  // Test if gasLimit is correctly set for blocks before the hard fork
  it('should set gasLimit to zero for blocks before the hard fork', async () => {
    const block = formatBlock(
      await provider.send('eth_getBlockByNumber', [toQuantity(16068684), true]),
    );
    expect(BigInt(block.gasLimit)).toEqual(BigInt(0));
  });

  // Test if gasLimit is correctly set for blocks after the hard fork
  it('should not set gasLimit to zero for blocks after the hard fork', async () => {
    const block = formatBlock(
      await provider.send('eth_getBlockByNumber', ['latest', true]),
    );
    expect(BigInt(block.gasLimit)).toEqual(BigInt(0x01e84800));
  });
});
