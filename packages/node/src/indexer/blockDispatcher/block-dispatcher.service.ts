// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  NodeConfig,
  SmartBatchService,
  StoreCacheService,
  StoreService,
  IProjectService,
  PoiService,
  BlockDispatcher,
  ProcessBlockResponse,
  ApiService,
  IProjectUpgradeService,
  PoiSyncService,
} from '@subql/node-core';
import {
  EthereumProjectDs,
  SubqueryProject,
} from '../../configure/SubqueryProject';
import { DynamicDsService } from '../dynamic-ds.service';
import { IndexerManager } from '../indexer.manager';
import { BlockContent } from '../types';

/**
 * @description Intended to behave the same as WorkerBlockDispatcherService but doesn't use worker threads or any parallel processing
 */
@Injectable()
export class BlockDispatcherService
  extends BlockDispatcher<BlockContent, EthereumProjectDs>
  implements OnApplicationShutdown
{
  constructor(
    apiService: ApiService,
    nodeConfig: NodeConfig,
    private indexerManager: IndexerManager,
    eventEmitter: EventEmitter2,
    @Inject('IProjectService')
    projectService: IProjectService<EthereumProjectDs>,
    @Inject('IProjectUpgradeService')
    projectUpgradeService: IProjectUpgradeService,
    smartBatchService: SmartBatchService,
    storeService: StoreService,
    storeCacheService: StoreCacheService,
    poiService: PoiService,
    poiSyncService: PoiSyncService,
    @Inject('ISubqueryProject') project: SubqueryProject,
    dynamicDsService: DynamicDsService,
  ) {
    super(
      nodeConfig,
      eventEmitter,
      projectService,
      projectUpgradeService,
      smartBatchService,
      storeService,
      storeCacheService,
      poiService,
      poiSyncService,
      project,
      dynamicDsService,
      apiService.fetchBlocks.bind(apiService),
    );
  }

  onApplicationShutdown(signal?: string) {
    throw new Error('Method not implemented.');
  }

  getBlockHeight(block: BlockContent | number): number {
    if (typeof block === 'number') {
      return block;
    }
    return block.number;
  }

  protected async indexBlock(
    block: BlockContent,
  ): Promise<ProcessBlockResponse> {
    return this.indexerManager.indexBlock(
      block,
      await this.projectService.getDataSources(this.getBlockHeight(block)),
    );
  }
}
