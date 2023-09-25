// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import {Block} from '@ethersproject/abstract-provider';
import {
  EthereumBlock,
  EthereumBlockWrapper,
  EthereumLog,
  EthereumLogFilter,
  EthereumTransaction,
  EthereumTransactionFilter,
} from './ethereum';

export interface BlockWrapper<
  B extends EthereumBlock = EthereumBlock,
  C extends EthereumTransaction = EthereumTransaction,
  E extends EthereumLog = EthereumLog,
  CF extends EthereumTransactionFilter = EthereumTransactionFilter,
  EF extends EthereumLogFilter = EthereumLogFilter
> {
  block: B;
  blockHeight: number;
  specVersion?: number;
  hash: string;
  calls?: (filters?: CF | CF[], ds?: any) => C[];
  transactions?: C[];
  events?: (filters?: EF | EF[], ds?: any) => E[];
  logs?: E[];
}

export interface ApiWrapper<BW extends BlockWrapper = EthereumBlockWrapper> {
  init: () => Promise<void>;
  getGenesisHash: () => string;
  getRuntimeChain: () => string;
  getChainId: () => number;
  getSpecName: () => string;
  getFinalizedBlockHeight: () => Promise<number>;
  getBestBlockHeight: () => Promise<number>;
  getBlockByHeightOrHash: (hashOrHeight: number | string) => Promise<Block>;
  fetchBlocks: (bufferBlocks: number[]) => Promise<BW[]>;
}
