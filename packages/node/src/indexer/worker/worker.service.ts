// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { Inject, Injectable } from '@nestjs/common';
import { SubqlEthereumDataSource } from '@subql/common-ethereum';
import {
  NodeConfig,
  IProjectService,
  ProcessBlockResponse,
  ApiService,
  BaseWorkerService,
  IProjectUpgradeService,
} from '@subql/node-core';
import { BlockWrapper } from '@subql/types-ethereum';
import { EthereumProjectDs } from '../../configure/SubqueryProject';
import { IndexerManager } from '../indexer.manager';

export type FetchBlockResponse = { parentHash: string } | undefined;

export type WorkerStatusResponse = {
  threadId: number;
  isIndexing: boolean;
  fetchedBlocks: number;
  toFetchBlocks: number;
};

@Injectable()
export class WorkerService extends BaseWorkerService<
  BlockWrapper,
  FetchBlockResponse,
  SubqlEthereumDataSource,
  {}
> {
  constructor(
    private apiService: ApiService,
    private indexerManager: IndexerManager,
    @Inject('IProjectService')
    projectService: IProjectService<EthereumProjectDs>,
    @Inject('IProjectUpgradeService')
    projectUpgradeService: IProjectUpgradeService,
    nodeConfig: NodeConfig,
  ) {
    super(projectService, projectUpgradeService, nodeConfig);
  }

  protected async fetchChainBlock(
    heights: number,
    extra: {},
  ): Promise<BlockWrapper> {
    const [block] = await this.apiService.fetchBlocks([heights]);
    return block;
  }

  protected toBlockResponse(block: BlockWrapper): { parentHash: string } {
    return {
      parentHash: block.block.parentHash,
    };
  }

  protected async processFetchedBlock(
    block: BlockWrapper,
    dataSources: SubqlEthereumDataSource[],
  ): Promise<ProcessBlockResponse> {
    return this.indexerManager.indexBlock(block, dataSources);
  }
}
