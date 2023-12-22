// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NETWORK_FAMILY } from '@subql/common';
import { DictionaryVersion, NodeConfig } from '@subql/node-core';
import { DictionaryService } from '@subql/node-core/indexer/dictionary/dictionary.service';
import { EthereumBlock, SubqlDatasource } from '@subql/types-ethereum';
import { logger } from 'ethers';
import { SubqueryProject } from '../../configure/SubqueryProject';
import { EthDictionaryServiceV1 } from './v1/eth-dictionary.service.v1';
import { EthDictionaryServiceV2, RawEthFatBlock } from './v2';

@Injectable()
export class EthDictionaryService extends DictionaryService<
  RawEthFatBlock,
  EthereumBlock,
  SubqlDatasource,
  EthDictionaryServiceV1
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

  async initDictionary(): Promise<void> {
    if (!this.project) {
      throw new Error(`Project in Dictionary service not initialized `);
    }
    await this.inspectDictionaryVersion();
    if (this.version === DictionaryVersion.v1) {
      const url =
        this.project.network.dictionary ??
        (await this.resolveDictionary(
          NETWORK_FAMILY.ethereum,
          this.project.network.chainId,
          this.nodeConfig.dictionaryRegistry,
        ));

      this._dictionary = await EthDictionaryServiceV1.create(
        this.project,
        this.nodeConfig,
        this.eventEmitter,
        url,
      );
    } else {
      if (!this.dictionaryEndpoint) {
        throw new Error(
          `Using dictionary v2 but dictionary endpoint not given`,
        );
      }
      this._dictionary = new EthDictionaryServiceV2(
        this.project,
        this.nodeConfig,
        this.eventEmitter,
        this.chainId,
      );
    }
  }
}
