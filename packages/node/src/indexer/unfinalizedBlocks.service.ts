// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { Block } from '@ethersproject/abstract-provider';
import { Injectable } from '@nestjs/common';
import {
  ApiService,
  BaseUnfinalizedBlocksService,
  Header,
  mainThreadOnly,
  NodeConfig,
  StoreCacheService,
  getLogger,
  ProofOfIndex,
  PoiBlock,
  profiler,
} from '@subql/node-core';
import { BlockWrapper, EthereumBlock } from '@subql/types-ethereum';
import { isEqual } from 'lodash';

const logger = getLogger('UnfinalizedBlocksService');

export function blockToHeader(block: EthereumBlock | Block): Header {
  return {
    blockHeight: block.number,
    blockHash: block.hash,
    parentHash: block.parentHash,
  };
}

@Injectable()
export class UnfinalizedBlocksService extends BaseUnfinalizedBlocksService<BlockWrapper> {
  private supportsFinalization?: boolean;

  constructor(
    private readonly apiService: ApiService,
    nodeConfig: NodeConfig,
    storeCache: StoreCacheService,
  ) {
    super(nodeConfig, storeCache);
  }

  /**
   * @param reindex - the function to reindex back before a fork
   * @param supportsFinalization - If the chain supports the 'finalized' block tag this should be true.
   * */
  async init(
    reindex: (targetHeight: number) => Promise<void>,
    supportsFinalisation?: boolean,
  ): Promise<number | undefined> {
    this.supportsFinalization = supportsFinalisation;
    return super.init(reindex);
  }

  // Detect a fork by walking back through unfinalized blocks
  @profiler()
  protected async hasForked(): Promise<Header | undefined> {
    if (this.supportsFinalization) {
      return super.hasForked();
    }

    if (this.unfinalizedBlocks.length <= 2) {
      return;
    }

    const i = this.unfinalizedBlocks.length - 1;
    const current = this.unfinalizedBlocks[i];
    const parent = this.unfinalizedBlocks[i - 1];

    if (current.parentHash !== parent.blockHash) {
      // We've found a fork now we need to find where the fork happened
      logger.warn(
        `Block fork detected at ${current.blockHeight}. Parent hash ${current.parentHash} doesn't match indexed parent ${parent.blockHash}.`,
      );

      let parentIndex = i - 1;
      let indexedParent = parent;
      let chainParent = await this.getHeaderForHash(current.parentHash);
      while (chainParent.blockHash !== indexedParent.blockHash) {
        parentIndex--;
        // We've exhausted cached unfinalized blocks, we can check POI now for forks.
        if (parentIndex < 0) {
          const poiModel = this.storeCache.poi;
          if (!poiModel) {
            // TODO update message to explain how to recover from this.
            throw new Error(
              'Ran out of cached unfinalized blocks. Unable to find if a fork was indexed.',
            );
          }

          logger.warn('Using POI to find older block fork');

          const indexedBlocks: ProofOfIndex[] =
            await poiModel.getPoiBlocksBefore(chainParent.blockHeight);

          // Work backwards to find a block on chain that matches POI
          for (const indexedBlock of indexedBlocks) {
            const chainHeader = await this.getHeaderForHeight(indexedBlock.id);

            // Need to convert to PoiBlock to encode block hash to Uint8Array properly
            const testPoiBlock = PoiBlock.create(
              chainHeader.blockHeight,
              chainHeader.blockHash,
              new Uint8Array(),
              indexedBlock.projectId,
            );

            // Need isEqual because of Uint8Array type
            if (
              isEqual(testPoiBlock.chainBlockHash, indexedBlock.chainBlockHash)
            ) {
              return chainHeader;
            }
          }
        }
        indexedParent = this.unfinalizedBlocks[parentIndex];
        chainParent = await this.getHeaderForHash(chainParent.parentHash);
      }

      return chainParent;
    }

    return;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async getLastCorrectFinalizedBlock(
    forkedHeader: Header,
  ): Promise<number | undefined> {
    if (this.supportsFinalization) {
      return super.getLastCorrectFinalizedBlock(forkedHeader);
    }

    // TODO update lastChecked block height to clean up unfinalized blocks
    return forkedHeader.blockHeight;
  }

  @mainThreadOnly()
  protected blockToHeader(block: BlockWrapper): Header {
    return blockToHeader(block.block);
  }

  @mainThreadOnly()
  protected async getFinalizedHead(): Promise<Header> {
    const finalizedBlock = await this.apiService.api.getFinalizedBlock();
    return blockToHeader(finalizedBlock);
  }

  @mainThreadOnly()
  protected async getHeaderForHash(hash: string): Promise<Header> {
    const block = await this.apiService.api.getBlockByHeightOrHash(hash);
    return blockToHeader(block);
  }

  @mainThreadOnly()
  protected async getHeaderForHeight(height: number): Promise<Header> {
    const block = await this.apiService.api.getBlockByHeightOrHash(height);
    return blockToHeader(block);
  }
}
