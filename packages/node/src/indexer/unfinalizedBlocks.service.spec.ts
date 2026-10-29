// Copyright 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { hexZeroPad } from '@ethersproject/bytes';
import {
  CacheMetadataModel,
  Header,
  NodeConfig,
  PoiBlock,
  StoreCacheService,
  METADATA_UNFINALIZED_BLOCKS_KEY,
  METADATA_LAST_FINALIZED_PROCESSED_KEY,
} from '@subql/node-core';
import { BlockchainService } from '../blockchain.service';
import { EthereumNodeConfig } from '../configure/NodeConfig';
import { EthereumApiService } from '../ethereum';
import { UnfinalizedBlocksService } from './unfinalizedBlocks.service';

// Adds 0 padding so we can convert to POI block
const hexify = (input: string) => hexZeroPad(input, 4);

// Mock 1740100000 is the timestamp of the genesis block
const genBlockTimestamp = (height: number) => (1740100000 + height) * 1000;
const genBlockDate = (height: number) => new Date(genBlockTimestamp(height));

const makeHeader = (height: number, finalized?: boolean): Header => ({
  blockHeight: height,
  blockHash: hexify(`0xABC${height}${finalized ? 'f' : ''}`),
  parentHash: hexify(`0xABC${height - 1}${finalized ? 'f' : ''}`),
  timestamp: genBlockDate(height),
});

const getMockApi = (): EthereumApiService => {
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
          // The genesis block's parent hash is all zeros
          parentHash: num === 0 ? hexify('0x00') : hexify(`0xABC${num - 1}f`),
          timestamp: genBlockTimestamp(num) / 1000,
        });
      },
      getFinalizedBlock: jest.fn(() => ({
        number: 110,
        hash: '0xABC110f',
        parentHash: '0xABC109f',
        timestamp: genBlockTimestamp(110) / 1000,
      })),
      getBestBlockHeight: jest.fn(() => 120),
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

    const blockchainService = new BlockchainService(getMockApi());

    unfinalizedBlocks = new UnfinalizedBlocksService(
      new NodeConfig({
        unfinalizedBlocks: true,
        blockForkReindex: 1000,
      } as any) as EthereumNodeConfig,
      storeCache,
      blockchainService,
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

    expect(rewind?.blockHeight).toEqual(103);
  });

  // node-core stops a backfill at a fork, so the blocks between the last cached block and the forked header are missing
  it('handles a block fork with a gap below the forked header', async () => {
    await unfinalizedBlocks.init(jest.fn());

    (unfinalizedBlocks as any)._unfinalizedBlocks = [
      makeHeader(106, true),
      makeHeader(107, true),
      makeHeader(108, true),
      makeHeader(109, true), // Last block before the fork
      makeHeader(110),
    ];

    const rewind = await (
      unfinalizedBlocks as any
    ).getLastCorrectFinalizedBlock(makeHeader(115, true));

    expect(rewind?.blockHeight).toEqual(109);
  });

  it('handles a block fork over several cached blocks with a gap below the forked header', async () => {
    await unfinalizedBlocks.init(jest.fn());

    (unfinalizedBlocks as any)._unfinalizedBlocks = [
      makeHeader(106, true),
      makeHeader(107, true), // Last block before the fork
      makeHeader(108),
      makeHeader(109),
      makeHeader(110),
    ];

    const rewind = await (
      unfinalizedBlocks as any
    ).getLastCorrectFinalizedBlock(makeHeader(115, true));

    expect(rewind?.blockHeight).toEqual(107);
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

    expect(rewind?.blockHeight).toEqual(99);
    expect(spy).toHaveBeenCalled();
  });

  // The finalized block is after the cached unfinalized blocks, they should be rechecked
  it('startup, correctly checks for forks after cached unfinalized blocks', async () => {
    await storeCache.metadata.set(
      METADATA_UNFINALIZED_BLOCKS_KEY,
      JSON.stringify(<Header[]>[
        makeHeader(99, true),
        makeHeader(100),
        makeHeader(101),
      ]),
    );

    await storeCache.metadata.set(METADATA_LAST_FINALIZED_PROCESSED_KEY, 99);

    const rewind = jest.fn();

    await unfinalizedBlocks.init(rewind);

    // It should fall back to poi in this case
    expect(rewind).toHaveBeenCalledWith({
      blockHash: '0x00ABC99f',
      blockHeight: 99,
      parentHash: '0x00ABC98f',
      timestamp: genBlockDate(99),
    });
  });

  it('startup, correctly checks for forks within cached unfinalized blocks', async () => {
    await storeCache.metadata.set(
      METADATA_UNFINALIZED_BLOCKS_KEY,
      JSON.stringify(<Header[]>[
        makeHeader(110),
        makeHeader(111),
        makeHeader(112),
      ]),
    );

    await storeCache.metadata.set(METADATA_LAST_FINALIZED_PROCESSED_KEY, 109);

    const rewind = jest.fn();

    await unfinalizedBlocks.init(rewind);

    // It should fall back to poi in this case
    expect(rewind).toHaveBeenCalledWith({
      blockHash: '0x00ABC99f',
      blockHeight: 99,
      parentHash: '0x00ABC98f',
      timestamp: genBlockDate(99),
    });
  });

  it('doesnt throw if there are no unfinalized blocks on startup', async () => {
    await storeCache.metadata.set(METADATA_LAST_FINALIZED_PROCESSED_KEY, 109);

    await expect(unfinalizedBlocks.init(jest.fn())).resolves.not.toThrow();
  });

  it('rewinds using blockForkReindex value if poi is not enabled', async () => {
    // Do this to "disable" poi
    (storeCache as any).poi = null;

    await storeCache.metadata.set(
      METADATA_UNFINALIZED_BLOCKS_KEY,
      JSON.stringify(<Header[]>[
        makeHeader(110),
        makeHeader(111),
        makeHeader(112),
      ]),
    );

    await storeCache.metadata.set(METADATA_LAST_FINALIZED_PROCESSED_KEY, 109);

    const rewind = jest.fn();

    await unfinalizedBlocks.init(rewind);

    // Without POI it rewinds blockForkReindex blocks back from the forked block, but not before genesis
    expect(rewind).toHaveBeenCalledWith({
      blockHash: '0x000ABC0f',
      blockHeight: 0,
      parentHash: '0x00000000',
      timestamp: genBlockDate(0),
    });
  });
});
