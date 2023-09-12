// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { getLogger } from '@subql/node-core';
import { Networkish } from 'ethers/lib.commonjs/providers';
import { FetchRequest } from 'ethers/lib.commonjs/utils';
import { JsonRpcProvider } from '../json-rpc-provider';

const logger = getLogger('celo-provider');

export class CeloJsonRpcProvider extends JsonRpcProvider {
  private flanHardForkBlock = BigInt('16068685');
  constructor(url?: FetchRequest | string, network?: Networkish) {
    super(url, network);

    const originalBlockFormatter = super._wrapBlock;
    super._wrapBlock = (value, network) => {
      return originalBlockFormatter(
        {
          gasLimit:
            BigInt(value.number) < this.flanHardForkBlock
              ? BigInt(0)
              : value.gasLimit,
          ...value,
        },
        network,
      );
    };
  }
}
