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

  async getEvmChainId(): Promise<Record<string, string>> {
    const response = await fetch(
      'https://raw.githubusercontent.com/subquery/templates/main/chainAliases.json5',
    );

    const raw = await response.text();
    // We use JSON5 here because the file has comments in it
    return JSON5.parse(raw);
  }
}
