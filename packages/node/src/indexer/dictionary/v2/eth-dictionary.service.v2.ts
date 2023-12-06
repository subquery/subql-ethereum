// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import assert from 'assert';
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  NodeConfig,
  FatDictionaryResponse,
  DictionaryServiceV2,
  RawFatDictionaryResponseData,
} from '@subql/node-core';
import { EthereumBlock } from '@subql/types-ethereum';
import { SubqueryProject } from '../../../configure/SubqueryProject';
import { RawEthFatBlock, EthDictionaryV2QueryEntry } from './types';
import { rawFatBlockToEthBlock } from './utils';

const MIN_FAT_FETCH_LIMIT = 200;
const FAT_BLOCKS_QUERY_METHOD = `subql_filterBlocks`;

@Injectable()
export class EthDictionaryServiceV2 extends DictionaryServiceV2<
  RawEthFatBlock,
  EthereumBlock
> {
  constructor(
    @Inject('ISubqueryProject') protected project: SubqueryProject,
    nodeConfig: NodeConfig,
    eventEmitter: EventEmitter2,
    chainId?: string,
  ) {
    super(
      project.network.dictionary,
      chainId ?? project.network.chainId,
      nodeConfig,
      eventEmitter,
    );
  }

  /**
   *
   * @param startBlock
   * @param queryEndBlock this block number will limit the max query range, increase dictionary query speed
   * @param batchSize
   * @param conditions
   */
  async queryFatDictionary(
    startBlock: number,
    queryEndBlock: number,
    limit = MIN_FAT_FETCH_LIMIT,
    conditions?: EthDictionaryV2QueryEntry,
  ): Promise<RawFatDictionaryResponseData<RawEthFatBlock> | undefined> {
    if (!conditions) {
      return undefined;
    }
    const requestData = {
      jsonrpc: '2.0',
      method: FAT_BLOCKS_QUERY_METHOD,
      id: 1,
      params: [
        startBlock,
        queryEndBlock,
        limit,
        conditions,
        { blockHeader: true, logs: true, transactions: { data: true } },
      ],
    };

    try {
      const response = await this.dictionaryApi.post(
        this.dictionaryEndpoint,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      return response.data
        .result as RawFatDictionaryResponseData<RawEthFatBlock>;
    } catch (error) {
      // Handle the error as needed
      throw new Error(`Fat dictionary get capacity failed ${error}`);
    }
  }

  convertResponseBlocks(
    data: RawFatDictionaryResponseData<RawEthFatBlock>,
  ): FatDictionaryResponse<EthereumBlock> | undefined {
    const blocks: EthereumBlock[] = [];
    for (const block of data.Blocks) {
      blocks.push(rawFatBlockToEthBlock(block));
    }
    if (blocks.length !== 0) {
      return {
        blocks: blocks,
        start: blocks[0].number,
        end: blocks[blocks.length - 1].number,
      };
    } else {
      return undefined;
    }
  }
}
