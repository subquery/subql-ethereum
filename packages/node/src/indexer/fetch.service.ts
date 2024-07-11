// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';

import { isCustomDs, EthereumHandlerKind } from '@subql/common-ethereum';
import {
  NodeConfig,
  BaseFetchService,
  ApiService,
  getModulos,
  getLogger,
} from '@subql/node-core';
import { EthereumBlock, SubqlDatasource } from '@subql/types-ethereum';
import { SubqueryProject } from '../configure/SubqueryProject';
import { EthereumApi } from '../ethereum';
import {
  calcInterval,
  ethereumBlockToHeader,
} from '../ethereum/utils.ethereum';
import { IEthereumBlockDispatcher } from './blockDispatcher';
import { EthDictionaryService } from './dictionary/ethDictionary.service';
import { ProjectService } from './project.service';
import { UnfinalizedBlocksService } from './unfinalizedBlocks.service';

const BLOCK_TIME_VARIANCE = 5000;

const INTERVAL_PERCENT = 0.9;

const logger = getLogger(`EthFetchService`);

@Injectable()
export class FetchService extends BaseFetchService<
  SubqlDatasource,
  IEthereumBlockDispatcher,
  EthereumBlock
> {
  private lastFinalizedHeight?: number;
  constructor(
    private apiService: ApiService,
    nodeConfig: NodeConfig,
    @Inject('IProjectService') projectService: ProjectService,
    @Inject('ISubqueryProject') project: SubqueryProject,
    @Inject('IBlockDispatcher')
    blockDispatcher: IEthereumBlockDispatcher,
    dictionaryService: EthDictionaryService,
    private unfinalizedBlocksService: UnfinalizedBlocksService,
    eventEmitter: EventEmitter2,
    schedulerRegistry: SchedulerRegistry,
  ) {
    super(
      nodeConfig,
      projectService,
      project.network,
      blockDispatcher,
      dictionaryService,
      eventEmitter,
      schedulerRegistry,
    );
  }

  get api(): EthereumApi {
    return this.apiService.unsafeApi;
  }

  protected async getFinalizedHeight(): Promise<number> {
    const block = await this.api.getFinalizedBlock();

    const header = ethereumBlockToHeader(block);
    const newFinalizedBlockHeight = header.blockHeight;
    logger.debug(
      `Rpc finalized height, ${newFinalizedBlockHeight} | current lastFinalizedHeight, ${this.lastFinalizedHeight}`,
    );
    // Rpc could return finalized height below last finalized height due to unmatched nodes
    // See how this could happen in https://gist.github.com/jiqiang90/ea640b07d298bca7cbeed4aee50776de
    // We want to ensure indexer not stall due to this
    if (
      this.lastFinalizedHeight === undefined ||
      newFinalizedBlockHeight > this.lastFinalizedHeight
    ) {
      this.lastFinalizedHeight = newFinalizedBlockHeight;
      this.unfinalizedBlocksService.registerFinalizedBlock(header);
    }
    return this.lastFinalizedHeight;
  }

  protected async getBestHeight(): Promise<number> {
    return this.api.getBestBlockHeight();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async getChainInterval(): Promise<number> {
    const CHAIN_INTERVAL = calcInterval(this.api) * INTERVAL_PERCENT;

    return Math.min(BLOCK_TIME_VARIANCE, CHAIN_INTERVAL);
  }

  protected getModulos(dataSources: SubqlDatasource[]): number[] {
    return getModulos(dataSources, isCustomDs, EthereumHandlerKind.Block);
  }

  protected async initBlockDispatcher(): Promise<void> {
    await this.blockDispatcher.init(this.resetForNewDs.bind(this));
  }

  protected async preLoopHook(): Promise<void> {
    // Ethereum doesn't need to do anything here
    return Promise.resolve();
  }
}
