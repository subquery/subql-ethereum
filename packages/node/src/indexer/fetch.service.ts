// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';

import {
  isCustomDs,
  EthereumHandlerKind,
  EthereumLogFilter,
  SubqlEthereumProcessorOptions,
  EthereumTransactionFilter,
} from '@subql/common-ethereum';
import {
  NodeConfig,
  BaseFetchService,
  ApiService,
  getLogger,
  getModulos,
} from '@subql/node-core';
import {
  DictionaryQueryCondition,
  DictionaryQueryEntry,
} from '@subql/types-core';
import { EthereumBlock, SubqlDatasource } from '@subql/types-ethereum';
import { groupBy, partition, sortBy, uniqBy } from 'lodash';
import { fromAjax } from 'rxjs/internal/ajax/ajax';
import { SubqueryProject } from '../configure/SubqueryProject';
import { EthereumApi } from '../ethereum';
import { calcInterval } from '../ethereum/utils.ethereum';
import { eventToTopic, functionToSighash } from '../utils/string';
import { yargsOptions } from '../yargs';
import { IEthereumBlockDispatcher } from './blockDispatcher';
import { DictionaryService } from './dictionary.service';
import { DynamicDsService } from './dynamic-ds.service';
import { EthFatDictionaryService } from './fatDictionary/eth-fat-dictionary.service';
import {
  EthFatDictionaryQueryEntry,
  EthFatDictionaryLogConditions,
  EthFatDictionaryTxConditions,
  RawEthFatBlock,
} from './fatDictionary/types';
import { ProjectService } from './project.service';
import {
  blockToHeader,
  UnfinalizedBlocksService,
} from './unfinalizedBlocks.service';

const logger = getLogger('fetch.service');

const BLOCK_TIME_VARIANCE = 5000;

const INTERVAL_PERCENT = 0.9;

export function appendDsOptions(
  dsOptions: SubqlEthereumProcessorOptions | SubqlEthereumProcessorOptions[],
  conditions: DictionaryQueryCondition[],
): void {
  const queryAddressLimit = yargsOptions.argv['query-address-limit'];
  if (Array.isArray(dsOptions)) {
    const addresses = dsOptions.map((option) => option.address).filter(Boolean);

    if (addresses.length > queryAddressLimit) {
      logger.warn(
        `Addresses length: ${addresses.length} is exceeding limit: ${queryAddressLimit}. Consider increasing this value with the flag --query-address-limit  `,
      );
    }

    if (addresses.length !== 0 && addresses.length <= queryAddressLimit) {
      conditions.push({
        field: 'address',
        value: addresses,
        matcher: 'in',
      });
    }
  } else {
    if (dsOptions?.address) {
      conditions.push({
        field: 'address',
        value: dsOptions.address.toLowerCase(),
        matcher: 'equalTo',
      });
    }
  }
}

function eventFilterToQueryEntry(
  filter: EthereumLogFilter,
  dsOptions: SubqlEthereumProcessorOptions | SubqlEthereumProcessorOptions[],
): DictionaryQueryEntry {
  const conditions: DictionaryQueryCondition[] = [];
  appendDsOptions(dsOptions, conditions);
  if (filter.topics) {
    for (let i = 0; i < Math.min(filter.topics.length, 4); i++) {
      const topic = filter.topics[i];
      if (!topic) {
        continue;
      }
      const field = `topics${i}`;

      if (topic === '!null') {
        conditions.push({
          field,
          value: false as any, // TODO update types to allow boolean
          matcher: 'isNull',
        });
      } else {
        conditions.push({
          field,
          value: eventToTopic(topic),
          matcher: 'equalTo',
        });
      }
    }
  }
  return {
    entity: 'evmLogs',
    conditions,
  };
}

function callFilterToQueryEntry(
  filter: EthereumTransactionFilter,
  dsOptions: SubqlEthereumProcessorOptions | SubqlEthereumProcessorOptions[],
): DictionaryQueryEntry {
  const conditions: DictionaryQueryCondition[] = [];
  appendDsOptions(dsOptions, conditions);

  for (const condition of conditions) {
    if (condition.field === 'address') {
      condition.field = 'to';
    }
  }
  if (filter.from) {
    conditions.push({
      field: 'from',
      value: filter.from.toLowerCase(),
      matcher: 'equalTo',
    });
  }
  const optionsAddresses = conditions.find((c) => c.field === 'to');
  if (!optionsAddresses) {
    if (filter.to) {
      conditions.push({
        field: 'to',
        value: filter.to.toLowerCase(),
        matcher: 'equalTo',
      });
    } else if (filter.to === null) {
      conditions.push({
        field: 'to',
        value: true as any, // TODO update types to allow boolean
        matcher: 'isNull',
      });
    }
  } else if (optionsAddresses && (filter.to || filter.to === null)) {
    logger.warn(
      `TransactionFilter 'to' conflict with 'address' in data source options`,
    );
  }

  if (filter.function) {
    conditions.push({
      field: 'func',
      value: functionToSighash(filter.function),
      matcher: 'equalTo',
    });
  }
  return {
    entity: 'evmTransactions',
    conditions,
  };
}

export type GroupedEthereumProjectDs = SubqlDatasource & {
  groupedOptions?: SubqlEthereumProcessorOptions[];
};
export function buildDictionaryQueryEntries(
  dataSources: GroupedEthereumProjectDs[],
): DictionaryQueryEntry[] {
  const queryEntries: DictionaryQueryEntry[] = [];

  for (const ds of dataSources) {
    for (const handler of ds.mapping.handlers) {
      // No filters, cant use dictionary
      if (!handler.filter) return [];

      switch (handler.kind) {
        case EthereumHandlerKind.Block:
          return [];
        case EthereumHandlerKind.Call: {
          const filter = handler.filter as EthereumTransactionFilter;
          if (
            filter.from !== undefined ||
            filter.to !== undefined ||
            filter.function
          ) {
            queryEntries.push(callFilterToQueryEntry(filter, ds.options));
          } else {
            return [];
          }
          break;
        }
        case EthereumHandlerKind.Event: {
          const filter = handler.filter as EthereumLogFilter;
          if (ds.groupedOptions) {
            queryEntries.push(
              eventFilterToQueryEntry(filter, ds.groupedOptions),
            );
          } else if (ds.options?.address || filter.topics) {
            queryEntries.push(eventFilterToQueryEntry(filter, ds.options));
          } else {
            return [];
          }
          break;
        }
        default:
      }
    }
  }

  return uniqBy(
    queryEntries,
    (item) =>
      `${item.entity}|${JSON.stringify(
        sortBy(item.conditions, (c) => c.field),
      )}`,
  );
}

function extractOptionAddresses(
  dsOptions: SubqlEthereumProcessorOptions | SubqlEthereumProcessorOptions[],
): string[] {
  const queryAddressLimit = yargsOptions.argv['query-address-limit'];
  const addressArray: string[] = [];
  if (Array.isArray(dsOptions)) {
    const addresses = dsOptions.map((option) => option.address).filter(Boolean);

    if (addresses.length > queryAddressLimit) {
      logger.warn(
        `Addresses length: ${addresses.length} is exceeding limit: ${queryAddressLimit}. Consider increasing this value with the flag --query-address-limit  `,
      );
    }
    if (addresses.length !== 0 && addresses.length <= queryAddressLimit) {
      addressArray.push(...addresses);
    }
  } else {
    if (dsOptions?.address) {
      addressArray.push(dsOptions.address.toLowerCase());
    }
  }
  return addressArray;
}

function callFilterToFatDictionaryCondition(
  filter: EthereumTransactionFilter,
  dsOptions: SubqlEthereumProcessorOptions,
): EthFatDictionaryTxConditions {
  const txConditions: EthFatDictionaryTxConditions = {};
  const toArray = [];
  const fromArray = [];
  const funcArray = [];

  if (filter.from) {
    fromArray.push(filter.from.toLowerCase());
  }
  const optionsAddresses = extractOptionAddresses(dsOptions);
  if (!optionsAddresses) {
    if (filter.to) {
      toArray.push(filter.to.toLowerCase());
    } else if (filter.to === null) {
      toArray.push(null); //TODO, is this correct?
    }
  } else if (optionsAddresses && (filter.to || filter.to === null)) {
    logger.warn(
      `TransactionFilter 'to' conflict with 'address' in data source options`,
    );
  }
  if (filter.function) {
    funcArray.push(functionToSighash(filter.function));
  }

  if (toArray.length !== 0) {
    txConditions.to = toArray;
  }
  if (fromArray.length !== 0) {
    txConditions.from = fromArray;
  }

  if (funcArray.length !== 0) {
    txConditions.function = funcArray;
  }

  return txConditions;
}

function eventFilterToFatDictionaryCondition(
  filter: EthereumLogFilter,
  dsOptions: SubqlEthereumProcessorOptions | SubqlEthereumProcessorOptions[],
): EthFatDictionaryLogConditions {
  const logConditions: EthFatDictionaryLogConditions = {};
  logConditions.address = extractOptionAddresses(dsOptions);
  if (filter.topics) {
    for (let i = 0; i < Math.min(filter.topics.length, 4); i++) {
      const topic = filter.topics[i];
      if (!topic) {
        continue;
      }
      const field = `topics${i}`;
      // Initialized
      if (!logConditions[field]) {
        logConditions[field] = [];
      }
      if (topic === '!null') {
        logConditions[field] = []; // TODO, check if !null
      } else {
        logConditions[field].push(eventToTopic(topic));
      }
    }
  }
  return logConditions;
}

export function buildFatDictionaryQueries(
  dataSources: GroupedEthereumProjectDs[],
): EthFatDictionaryQueryEntry {
  const fatDictionaryConditions: EthFatDictionaryQueryEntry = {
    logs: [],
    transactions: [],
  };

  for (const ds of dataSources) {
    for (const handler of ds.mapping.handlers) {
      // No filters, cant use dictionary
      if (!handler.filter) return fatDictionaryConditions;

      switch (handler.kind) {
        case EthereumHandlerKind.Block:
          return fatDictionaryConditions;
        case EthereumHandlerKind.Call: {
          const filter = handler.filter as EthereumTransactionFilter;
          if (
            filter.from !== undefined ||
            filter.to !== undefined ||
            filter.function
          ) {
            fatDictionaryConditions.transactions.push(
              callFilterToFatDictionaryCondition(filter, ds.options),
            );
          } else {
            // do nothing;
          }
          break;
        }
        case EthereumHandlerKind.Event: {
          const filter = handler.filter as EthereumLogFilter;
          if (ds.groupedOptions) {
            fatDictionaryConditions.logs.push(
              eventFilterToFatDictionaryCondition(filter, ds.groupedOptions),
            );
          } else if (ds.options?.address || filter.topics) {
            fatDictionaryConditions.logs.push(
              eventFilterToFatDictionaryCondition(filter, ds.options),
            );
          } else {
            // do nothing;
          }
          break;
        }
        default:
      }
    }
  }

  //TODO, unique
  return fatDictionaryConditions;
  // return uniqBy(
  //   allDictionaryConditions,
  //   (item) =>
  //     `${item}|${JSON.stringify(
  //       sortBy(item.conditions, (c) => c.field),
  //     )}`,
  // );
}

@Injectable()
export class FetchService extends BaseFetchService<
  SubqlDatasource,
  IEthereumBlockDispatcher,
  DictionaryService,
  EthereumBlock,
  RawEthFatBlock
> {
  constructor(
    private apiService: ApiService,
    nodeConfig: NodeConfig,
    @Inject('IProjectService') projectService: ProjectService,
    @Inject('ISubqueryProject') project: SubqueryProject,
    @Inject('IBlockDispatcher')
    blockDispatcher: IEthereumBlockDispatcher,
    dictionaryService: DictionaryService,
    dynamicDsService: DynamicDsService,
    private unfinalizedBlocksService: UnfinalizedBlocksService,
    eventEmitter: EventEmitter2,
    schedulerRegistry: SchedulerRegistry,
    fatDictionaryService: EthFatDictionaryService,
  ) {
    super(
      nodeConfig,
      projectService,
      project.network,
      blockDispatcher,
      dictionaryService,
      dynamicDsService,
      eventEmitter,
      schedulerRegistry,
      fatDictionaryService,
    );
  }

  get api(): EthereumApi {
    return this.apiService.unsafeApi;
  }

  protected buildDictionaryQueryEntries(
    // Add name to dataousrces as templates have this set
    dataSources: (SubqlDatasource & { name?: string })[],
  ): DictionaryQueryEntry[] {
    const [normalDataSources, templateDataSources] = partition(
      dataSources,
      (ds) => !ds.name,
    );

    // Group templ
    const groupedDataSources = Object.values(
      groupBy(templateDataSources, (ds) => ds.name),
    ).map((grouped) => {
      if (grouped.length === 1) {
        return grouped[0];
      }

      const options = grouped.map((ds) => ds.options);
      const ref = grouped[0];

      return {
        ...ref,
        groupedOptions: options,
      };
    });

    const filteredDs = [...normalDataSources, ...groupedDataSources];

    return buildDictionaryQueryEntries(filteredDs);
  }

  // TODO, this is same as dictionary.
  protected buildFatDictionaryQueryEntries(
    dataSources: (SubqlDatasource & { name?: string })[],
  ): EthFatDictionaryQueryEntry {
    const [normalDataSources, templateDataSources] = partition(
      dataSources,
      (ds) => !ds.name,
    );
    // Group templ
    const groupedDataSources = Object.values(
      groupBy(templateDataSources, (ds) => ds.name),
    ).map((grouped) => {
      if (grouped.length === 1) {
        return grouped[0];
      }
      const options = grouped.map((ds) => ds.options);
      const ref = grouped[0];
      return {
        ...ref,
        groupedOptions: options,
      };
    });
    const filteredDs = [...normalDataSources, ...groupedDataSources];
    return buildFatDictionaryQueries(filteredDs);
  }

  protected getGenesisHash(): string {
    return this.apiService.networkMeta.genesisHash;
  }

  protected async getFinalizedHeight(): Promise<number> {
    const block = await this.api.getFinalizedBlock();

    const header = blockToHeader(block);

    this.unfinalizedBlocksService.registerFinalizedBlock(header);
    return header.blockHeight;
  }

  protected async getBestHeight(): Promise<number> {
    return this.api.getBestBlockHeight();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async getChainInterval(): Promise<number> {
    const CHAIN_INTERVAL = calcInterval(this.api) * INTERVAL_PERCENT;

    return Math.min(BLOCK_TIME_VARIANCE, CHAIN_INTERVAL);
  }

  protected getModulos(): number[] {
    return getModulos(
      this.projectService.getAllDataSources(),
      isCustomDs,
      EthereumHandlerKind.Block,
    );
  }

  protected async initBlockDispatcher(): Promise<void> {
    await this.blockDispatcher.init(this.resetForNewDs.bind(this));
  }

  protected async preLoopHook(): Promise<void> {
    // Ethereum doesn't need to do anything here
    return Promise.resolve();
  }
}
