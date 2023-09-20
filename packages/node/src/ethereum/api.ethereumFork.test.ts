// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { EventEmitter2 } from '@nestjs/event-emitter';
import { delay } from '@subql/node-core';
import { range, isEqual } from 'lodash';
import { EthereumApi } from './api.ethereum';
import { EthereumBlockWrapped } from './block.ethereum';

// Add api key to work
const HTTP_ENDPOINT = 'https://eth-rpc-tc9.aca-staging.network/';

// Mock a store to keep blocks
class LimitedSortedMap<T> {
  private maxSize: number;
  private map: Map<number, T>;
  private keys: number[];

  constructor(maxSize: number) {
    this.maxSize = maxSize;
    this.map = new Map<number, T>();
    this.keys = [];
  }

  set(key: number, value: T): void {
    if (this.map.size >= this.maxSize) {
      const keyToRemove = this.keys.shift();
      if (keyToRemove !== undefined) {
        this.map.delete(keyToRemove);
      }
    }

    this.map.set(key, value);
    this.keys.push(key);
    this.keys.sort((a, b) => a - b);
  }

  get(key: number): T | undefined {
    return this.map.get(key);
  }
}

jest.setTimeout(9000000);
describe('Api.ethereum fork test', () => {
  let ethApi: EthereumApi;
  const eventEmitter = new EventEmitter2();
  beforeEach(async () => {
    ethApi = new EthereumApi(HTTP_ENDPOINT, eventEmitter);
    await ethApi.init();
  });

  // Fetch number blocks from confirmedHeight backward
  const revisitBlock = 200;
  // If this set to 0, could fail to fetch block
  const blockConfirmation = 30;

  it('detect block folk happened, data is different', async () => {
    const dataRecords = new LimitedSortedMap<any>(500);

    let detectDifference = false;
    let fetchingBlocksPromise: Promise<EthereumBlockWrapped[]>;
    let lastConfirmedHeight: number;

    while (!detectDifference) {
      if (fetchingBlocksPromise === undefined) {
        // Simulate getFinalizedBlockHeight
        const bestHeight = await ethApi.getBestBlockHeight();
        const confirmedHeight = bestHeight - blockConfirmation;
        if (lastConfirmedHeight && lastConfirmedHeight === confirmedHeight) {
          await delay(3);
          continue;
        }
        lastConfirmedHeight = confirmedHeight;

        // Fetch blocks
        fetchingBlocksPromise = Promise.all(
          range(confirmedHeight - revisitBlock, confirmedHeight).map(
            async (num) => ethApi.fetchBlock(num, true),
          ),
        );
        const fetchedBlocks = await fetchingBlocksPromise;
        console.log(
          `Fetched block [${fetchedBlocks[0].blockHeight} - ${
            fetchedBlocks[fetchedBlocks.length - 1].blockHeight
          }]`,
        );

        // validate cached/unconfirmed blocks, but not remove any
        for (const b of fetchedBlocks) {
          // Seems not easy to assert wrappedBlock, so we append some key fields to compare
          const entity = {
            _hash: b.hash,
            // _block: b.block,
            _txsNumber: b.transactions.length,
            // _logsNumber: b.logs.length,
            _logs: b.logs.map((l) => l.topics),
          };
          if (dataRecords.get(b.blockHeight) === undefined) {
            dataRecords.set(b.blockHeight, entity);
          } else {
            // expect(dataRecords.get(b.blockHeight)).toStrictEqual(entity)

            if (isEqual(dataRecords.get(b.blockHeight), entity)) {
              // console.log(`Data correct for ${b.blockHeight}`)
            } else {
              console.error(`! Incorrect for ${b.blockHeight}`);
              console.log(`NEW:`);
              console.log(entity);
              console.log(`============================`);
              console.log(`OLD:`);
              console.log(dataRecords.get(b.blockHeight));
              detectDifference = true;
              break;
            }
          }
        }
        fetchingBlocksPromise = undefined;
      }
    }
  });
});
