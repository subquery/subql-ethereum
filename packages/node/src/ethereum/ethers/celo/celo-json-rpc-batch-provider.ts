// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { getLogger } from '@subql/node-core';
import { Networkish } from 'ethers/lib.commonjs/providers';
import { FetchRequest } from 'ethers/lib.commonjs/utils';
import { JsonRpcBatchProvider } from '../json-rpc-batch-provider';

const logger = getLogger('celo-batch-provider');

export class CeloJsonRpcBatchProvider extends JsonRpcBatchProvider {
  private flanHardForkBlock = BigInt('16068685');
  constructor(url?: FetchRequest | string, network?: Networkish) {
    super(url, network);

    const originalBlockFormatter = super._wrapBlock;
    super._wrapBlock = (value, format) => {
      return originalBlockFormatter(
        {
          gasLimit:
            BigInt(value.number) < this.flanHardForkBlock
              ? BigInt(0)
              : value.gasLimit,
          ...value,
        },
        format,
      );
    };
  }
}
