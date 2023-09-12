// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { hexZeroPad } from '@ethersproject/bytes';
import {
  ApiService,
  CacheMetadataModel,
  Header,
  NodeConfig,
  PoiBlock,
  StoreCacheService,
} from '@subql/node-core';
import { UnfinalizedBlocksService } from './unfinalizedBlocks.service';

// Adds 0 padding so we can convert to POI block
const hexify = (input: string) => hexZeroPad(input, 4);

const makeHeader = (height: number, finalized?: boolean): Header => ({
  blockHeight: height,
  blockHash: hexify(`0xABC${height}${finalized ? 'f' : ''}`),
  parentHash: hexify(`0xABC${height - 1}${finalized ? 'f' : ''}`),
});

const getMockApi = (): ApiService => {
  return {
    api: {
      getBlockByHeightOrHash: (hash: string | number) => {
        const num =
          typeof hash === 'number'
            ? hash
            : Number(
                hash
                  .toString()
                  .replace('0x', '')
                  .replace('ABC', '')
                  .replace('f', ''),
              );
        return Promise.resolve({
          number: num,
          hash: typeof hash === 'number' ? hexify(`0xABC${hash}f`) : hash,
          parentHash: hexify(`0xABC${num - 1}f`),
        });
      },
      getFinalizedBlock: jest.fn(() => ({})),
    },
  } as any;
};

function getMockMetadata(): any {
  const data: Record<string, any> = {};
  return {
    upsert: ({ key, value }: any) => (data[key] = value),
    findOne: ({ where: { key } }: any) => ({ value: data[key] }),
    findByPk: (key: string) => data[key],
    find: (key: string) => data[key],
  } as any;
}

function mockStoreCache(): StoreCacheService {
  return {
    metadata: new CacheMetadataModel(getMockMetadata()),
    poi: {
      getPoiBlocksBefore: jest.fn(() => [
        PoiBlock.create(99, hexify('0xABC99f'), new Uint8Array(), ''),
      ]),
    },
  } as any as StoreCacheService;
}

describe('UnfinalizedBlockService', () => {
  let unfinalizedBlocks: UnfinalizedBlocksService;
  let storeCache: StoreCacheService;

  beforeEach(() => {
    storeCache = mockStoreCache();

    unfinalizedBlocks = new UnfinalizedBlocksService(
      getMockApi(),
      { unfinalizedBlocks: true } as NodeConfig,
      storeCache,
    );
  });

  it('handles a block fork', async () => {
    await unfinalizedBlocks.init(jest.fn());

    (unfinalizedBlocks as any)._unfinalizedBlocks = [
      makeHeader(100),
      makeHeader(101),
      makeHeader(102),
      makeHeader(103, true), // Where the fork started
      makeHeader(104),
      makeHeader(105),
      makeHeader(106),
      makeHeader(107),
      makeHeader(108),
      makeHeader(109),
      makeHeader(110),
    ];

    const rewind = await unfinalizedBlocks.processUnfinalizedBlockHeader(
      makeHeader(111, true),
    );

    expect(rewind).toEqual(103);
  });

  it('uses POI blocks if there are not enough cached unfinalized blocks', async () => {
    await unfinalizedBlocks.init(jest.fn());

    (unfinalizedBlocks as any)._unfinalizedBlocks = [
      makeHeader(100),
      makeHeader(101),
      makeHeader(102),
      makeHeader(103),
      makeHeader(104),
      makeHeader(105),
      makeHeader(106),
      makeHeader(107),
      makeHeader(108),
      makeHeader(109),
      makeHeader(110),
    ];

    const spy = jest.spyOn(storeCache.poi as any, 'getPoiBlocksBefore');

    const rewind = await unfinalizedBlocks.processUnfinalizedBlockHeader(
      makeHeader(111, true),
    );

    expect(rewind).toEqual(99);
    expect(spy).toHaveBeenCalled();
  });
});
