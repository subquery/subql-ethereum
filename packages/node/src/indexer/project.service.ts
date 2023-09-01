// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  PoiService,
  BaseProjectService,
  StoreService,
  NodeConfig,
  ApiService,
  IProjectUpgradeService,
} from '@subql/node-core';
import { EthereumBlockWrapper } from '@subql/types-ethereum';
import { Sequelize } from '@subql/x-sequelize';
import {
  EthereumProjectDs,
  SubqueryProject,
} from '../configure/SubqueryProject';
import { EthereumApi } from '../ethereum';
import SafeEthProvider from '../ethereum/safe-api';
import { DsProcessorService } from './ds-processor.service';
import { DynamicDsService } from './dynamic-ds.service';
import { UnfinalizedBlocksService } from './unfinalizedBlocks.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version: packageVersion } = require('../../package.json');

@Injectable()
export class ProjectService extends BaseProjectService<
  ApiService<EthereumApi, SafeEthProvider, EthereumBlockWrapper[]>,
  EthereumProjectDs
> {
  protected packageVersion = packageVersion;

  constructor(
    dsProcessorService: DsProcessorService,
    apiService: ApiService,
    poiService: PoiService,
    sequelize: Sequelize,
    @Inject('ISubqueryProject') project: SubqueryProject,
    @Inject('IProjectUpgradeService')
    protected readonly projectUpgradeService: IProjectUpgradeService<SubqueryProject>,
    storeService: StoreService,
    nodeConfig: NodeConfig,
    dynamicDsService: DynamicDsService,
    eventEmitter: EventEmitter2,
    unfinalizedBlockService: UnfinalizedBlocksService,
  ) {
    super(
      dsProcessorService,
      apiService,
      poiService,
      sequelize,
      project,
      projectUpgradeService,
      storeService,
      nodeConfig,
      dynamicDsService,
      eventEmitter,
      unfinalizedBlockService,
    );
  }

  protected async getBlockTimestamp(height: number): Promise<Date> {
    const block = await this.apiService.unsafeApi.api.getBlock(height);

    return new Date(block.timestamp * 1000); // TODO test and make sure its in MS not S
  }

  protected onProjectChange(project: SubqueryProject): void | Promise<void> {
    // TODO update this when implementing skipBlock feature for Eth
    // this.apiService.updateBlockFetching();
  }
}
