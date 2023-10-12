// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

// import { WebSocketProvider } from '@ethersproject/providers';
import { getLogger } from '@subql/node-core';
import { Networkish, WebSocketLike, WebSocketProvider } from 'ethers';

const logger = getLogger('celo-ws-provider');

export class CeloWsProvider extends WebSocketProvider {
  private flanHardForkBlock = BigInt('16068685');
  constructor(url?: string | WebSocketLike, network?: Networkish) {
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
