// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { BigNumber, constants, utils } from 'ethers';
import { formatBlock } from '../../utils.ethereum';
import { CeloJsonRpcProvider } from './celo-json-rpc-provider';

describe('CeloJsonRpcProvider', () => {
  let provider: CeloJsonRpcProvider;

  beforeEach(() => {
    provider = new CeloJsonRpcProvider('https://forno.celo.org');
  });

  // Test if gasLimit is correctly set for blocks before the hard fork
  it('should set gasLimit to zero for blocks before the hard fork', async () => {
    const block = formatBlock(
      await provider.send('eth_getBlockByNumber', [
        utils.hexValue(16068684),
        true,
      ]),
    );
    expect(BigNumber.from(block.gasLimit)).toEqual(constants.Zero);
  });

  // Test if gasLimit is correctly set for blocks after the hard fork
  it('should not set gasLimit to zero for blocks after the hard fork', async () => {
    const block = formatBlock(
      await provider.send('eth_getBlockByNumber', [
        utils.hexValue(21055596),
        true,
      ]),
    );
    expect(BigNumber.from(block.gasLimit)).toEqual(BigNumber.from(0x1312d00));
  });
});