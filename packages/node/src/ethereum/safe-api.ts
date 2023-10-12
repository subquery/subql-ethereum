// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

// import { BigNumber, BigNumberish } from 'ethers/lib.commonjs/';
// import type { Network } from 'ethers/lib.commonjs/';
import { getLogger } from '@subql/node-core';
import {
  AddressLike,
  Block,
  BlockTag,
  // BlockWithTransactions,
  // EventType,
  Filter,
  Log,
  Network,
  TransactionReceipt,
  TransactionRequest,
  TransactionResponse,
  Provider,
  ProviderEvent,
  FeeData,
  Listener,
} from 'ethers';
// import type { Deferrable } from 'ethers';

const logger = getLogger('safe.api.ethereum');

type Deferrable<T> = {
  [K in keyof T]: T[K] | Promise<T[K]>;
};

export default class SafeEthProvider implements Provider {
  provider: this;
  private network?: Network;
  constructor(
    private baseApi: Provider,
    private blockHeight: BlockTag | Promise<BlockTag>,
  ) {}

  async getBalance(
    addressOrName: string | Promise<string>,
    blockTag?: BlockTag | Promise<BlockTag>,
  ): Promise<bigint> {
    if (blockTag) logger.warn(`Provided parameter 'blockTag' will not be used`);
    return this.baseApi.getBalance(addressOrName, await this.blockHeight);
  }

  async getTransactionCount(
    addressOrName: string | Promise<string>,
    blockTag?: BlockTag | Promise<BlockTag>,
  ): Promise<number> {
    if (blockTag) logger.warn(`Provided parameter 'blockTag' will not be used`);
    return this.baseApi.getTransactionCount(
      addressOrName,
      await this.blockHeight,
    );
  }

  async getCode(
    addressOrName: string | Promise<string>,
    blockTag?: BlockTag | Promise<BlockTag>,
  ): Promise<string> {
    if (blockTag) logger.warn(`Provided parameter 'blockTag' will not be used`);
    return this.baseApi.getCode(addressOrName, await this.blockHeight);
  }

  async getStorageAt(
    addressOrName: string | Promise<string>,
    position: bigint | Promise<bigint>,
    blockTag?: BlockTag | Promise<BlockTag>,
  ): Promise<string> {
    if (blockTag) logger.warn(`Provided parameter 'blockTag' will not be used`);
    return this.baseApi.getStorage(
      addressOrName,
      await position,
      await this.blockHeight,
    );
  }

  async call(
    transaction: TransactionRequest,
    blockTag?: BlockTag | Promise<BlockTag>,
  ): Promise<string> {
    if (blockTag) logger.warn(`Provided parameter 'blockTag' will not be used`);

    return this.baseApi.call(transaction);
  }

  async getNetwork(): Promise<Network> {
    if (!this.network) {
      this.network = await this.baseApi.getNetwork();
    }
    return this.network;
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  // getBlockWithTransactions(
  //   blockHashOrBlockTag: BlockTag | Promise<BlockTag>,
  // ): Promise<BlockWithTransactions> {
  //   throw new Error('Method `getBlockWithTransactions` not supported.');
  // }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getBlock(blockHashOrBlockTag: BlockTag | Promise<BlockTag>): Promise<Block> {
    throw new Error('Method `getBlock` not supported.');
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getTransaction(transactionHash: string): Promise<TransactionResponse> {
    throw new Error('Method `getTransaction` not supported.');
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getTransactionReceipt(transactionHash: string): Promise<TransactionReceipt> {
    throw new Error('Method `getTransactionReceipt` not supported.');
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getLogs(filter: Filter): Promise<Log[]> {
    throw new Error('Method `getLogs` not supported.');
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getBlockNumber(): Promise<number> {
    throw new Error('Method `getBlockNumber` not supported.');
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getGasPrice(): Promise<bigint> {
    throw new Error('Method `getGasPrice` not supported.');
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  estimateGas(transaction: Deferrable<TransactionRequest>): Promise<bigint> {
    throw new Error('Method `estimateGas` not supported.');
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  sendTransaction(
    tx: TransactionRequest | Promise<TransactionRequest>,
  ): Promise<TransactionResponse> {
    throw new Error('Method `sendTransaction` not supported.');
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  resolveName(name: string | Promise<string>): Promise<string | null> {
    throw new Error('Method `resolveName` not supported.');
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  lookupAddress(address: string | Promise<string>): Promise<string | null> {
    throw new Error('Method `lookupAddress` not supported.');
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  on(event: ProviderEvent, listener: Listener): Promise<this> {
    throw new Error('Method `on` not supported.');
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  once(event: ProviderEvent, listener: Listener): Promise<this> {
    throw new Error('Method `once` not supported.');
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  emit(event: ProviderEvent, ...args: any[]): Promise<boolean> {
    throw new Error('Method `emit` not supported.');
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  listenerCount(event?: ProviderEvent): Promise<number> {
    throw new Error('Method `listenerCount` not supported.');
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  listeners(event?: ProviderEvent): Promise<Listener[]> {
    throw new Error('Method `listeners` not supported.');
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  off(event: ProviderEvent, listener?: Listener): Promise<this> {
    throw new Error('Method `off` not supported.');
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  removeAllListeners(event?: ProviderEvent): Promise<this> {
    throw new Error('Method `removeAllListeners` not supported.');
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  waitForTransaction(
    transactionHash: string,
    confirmations?: number,
    timeout?: number,
  ): Promise<TransactionReceipt> {
    throw new Error('Method `waitForTransaction` not supported.');
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  addListener(event: ProviderEvent, listener: Listener): Promise<this> {
    return Promise.resolve(undefined);
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  broadcastTransaction(signedTx: string): Promise<TransactionResponse> {
    return Promise.resolve(undefined);
  }

  destroy(): void {
    return;
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getFeeData(): Promise<FeeData> {
    return Promise.resolve(undefined);
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getStorage(
    address: AddressLike,
    position: bigint,
    blockTag?: BlockTag,
  ): Promise<string> {
    return Promise.resolve('');
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getTransactionResult(hash: string): Promise<string | null> {
    return Promise.resolve(undefined);
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  removeListener(event: ProviderEvent, listener: Listener): Promise<this> {
    return Promise.resolve(undefined);
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  waitForBlock(blockTag?: BlockTag): Promise<Block> {
    return Promise.resolve(undefined);
  }
}
