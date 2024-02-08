// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NETWORK_FAMILY } from '@subql/common';
import {
  DictionaryVersion,
  NodeConfig,
  inspectDictionaryVersion,
  IBlock,
} from '@subql/node-core';
import { DictionaryService } from '@subql/node-core/indexer/dictionary/dictionary.service';
import { EthereumBlock, SubqlDatasource } from '@subql/types-ethereum';
import { SubqueryProject } from '../../configure/SubqueryProject';
import { EthDictionaryV1 } from './v1/ethDictionaryV1';
import { EthDictionaryV2 } from './v2';

@Injectable()
export class EthDictionaryService extends DictionaryService<
  SubqlDatasource,
  EthereumBlock,
  EthDictionaryV1 | EthDictionaryV2
> {
  protected async initDictionariesV1(
    endpoints: string[],
  ): Promise<EthDictionaryV1[]> {
    if (!this.project) {
      throw new Error(`Project in Dictionary service not initialized `);
    }
    let dictionaries: EthDictionaryV1[] = [];
    const registryDictionary = await this.resolveDictionary(
      NETWORK_FAMILY.ethereum,
      this.project.network.chainId,
      this.nodeConfig.dictionaryRegistry,
    );
    if (registryDictionary !== undefined) {
      endpoints.push(registryDictionary);
    }

    // Current We now only accept either resolver dictionary or multiple dictionaries
    // TODO, this may move to core dictionary service
    if (this.nodeConfig.dictionaryResolver) {
      const resolverDictionary = await EthDictionaryV1.create(
        this.project,
        this.nodeConfig,
        this.eventEmitter,
      );
      dictionaries = [resolverDictionary];
    } else {
      dictionaries = await Promise.all(
        endpoints.map((endpoint) =>
          EthDictionaryV1.create(
            this.project,
            this.nodeConfig,
            this.eventEmitter,
            endpoint,
          ),
        ),
      );
    }
    return dictionaries;
  }

  protected initDictionariesV2(endpoints: string[]): EthDictionaryV2[] {
    if (!this.project) {
      throw new Error(`Project in Dictionary service not initialized `);
    }
    const dictionaries = endpoints.map(
      (endpoint) =>
        new EthDictionaryV2(
          endpoint,
          this.nodeConfig,
          this.eventEmitter,
          this.project,
          this.project.network.chainId,
        ),
    );
    return dictionaries;
  }

  async initDictionaries() {
    const dictionaryV1Endpoints = [];
    const dictionaryV2Endpoints = [];
    // TODO, change this to project.network.dictionary when rebase with main, this require update in type-core
    if (this.nodeConfig.networkDictionaries) {
      for (const endpoint of this.nodeConfig.networkDictionaries) {
        const version = await inspectDictionaryVersion(endpoint);
        if (version === DictionaryVersion.v1) {
          dictionaryV1Endpoints.push(endpoint);
        } else {
          dictionaryV2Endpoints.push(endpoint);
        }
      }
    }
    this.init([
      ...(await this.initDictionariesV1(dictionaryV1Endpoints)),
      ...this.initDictionariesV2(dictionaryV2Endpoints),
    ]);
  }

  constructor(
    @Inject('ISubqueryProject') protected project: SubqueryProject,
    nodeConfig: NodeConfig,
    eventEmitter: EventEmitter2,
    chainId?: string,
  ) {
    super(chainId ?? project.network.chainId, nodeConfig, eventEmitter);
  }
}
