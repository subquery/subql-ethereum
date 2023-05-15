// Copyright 2020-2022 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import {
  NodeConfig,
  DictionaryService as CoreDictionaryService,
} from '@subql/node-core';
import JSON5 from 'json5';
import fetch from 'node-fetch';
import { SubqueryProject } from '../configure/SubqueryProject';

const CHAIN_ALIASES_URL =
  'https://raw.githubusercontent.com/subquery/templates/main/chainAliases.json5';

@Injectable()
export class DictionaryService
  extends CoreDictionaryService
  implements OnApplicationShutdown
{
  constructor(
    @Inject('ISubqueryProject') protected project: SubqueryProject,
    nodeConfig: NodeConfig,
  ) {
    super(project.network.dictionary, project.network.chainId, nodeConfig);
  }

  async init(): Promise<void> {
    /*Some dictionarys for EVM are built with other SDKs as they are chains with an EVM runtime
     * we maintain a list of aliases so we can map the evmChainId to the genesis hash of the other SDKs
     * e.g moonbeam is built with Substrate SDK but can be used as an EVM dictionary
     */
    const chainAliases = await this.getEvmChainId();
    const chainAlias = chainAliases[this.chainId];

    if (chainAlias) {
      // Cast as any to work around read only
      (this.chainId as any) = chainAlias;
    }

    await super.init();
  }

  private async getEvmChainId(): Promise<Record<string, string>> {
    const response = await fetch(CHAIN_ALIASES_URL);

    const raw = await response.text();
    // We use JSON5 here because the file has comments in it
    return JSON5.parse(raw);
  }
}
