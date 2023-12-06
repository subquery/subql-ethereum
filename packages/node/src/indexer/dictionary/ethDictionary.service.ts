// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Dictionary,
  DictionaryV2QueryEntry,
  getLogger,
  NodeConfig,
} from '@subql/node-core';
import { DictionaryService } from '@subql/node-core/indexer/dictionary/core-dictionary.service';
import { BlockHeightMap } from '@subql/node-core/utils/blockHeightMap';
import {
  DictionaryQueryCondition,
  DictionaryQueryEntry as DictionaryV1QueryEntry,
} from '@subql/types-core';
import {
  EthereumBlock,
  EthereumHandlerKind,
  EthereumLogFilter,
  EthereumTransactionFilter,
  SubqlDatasource,
  SubqlEthereumProcessorOptions,
} from '@subql/types-ethereum';
import { groupBy, partition, sortBy, uniqBy } from 'lodash';
import { SubqueryProject } from '../../configure/SubqueryProject';
import { eventToTopic, functionToSighash } from '../../utils/string';
import { yargsOptions } from '../../yargs';
import { EthDictionaryServiceV1 } from './v1/eth-dictionary.service.v1';
import {
  EthDictionaryServiceV2,
  EthDictionaryV2QueryEntry,
  EthFatDictionaryLogConditions,
  EthFatDictionaryTxConditions,
  RawEthFatBlock,
} from './v2';

const logger = getLogger('eth-dictionary');

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
): DictionaryV1QueryEntry {
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
): DictionaryV1QueryEntry {
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
export function buildDictionaryV1QueryEntries(
  dataSources: GroupedEthereumProjectDs[],
): DictionaryV1QueryEntry[] {
  const queryEntries: DictionaryV1QueryEntry[] = [];

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

export function buildDictionaryV2QueryEntry(
  dataSources: GroupedEthereumProjectDs[],
): EthDictionaryV2QueryEntry {
  const fatDictionaryConditions: EthDictionaryV2QueryEntry = {
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

export class EthDictionaryService extends DictionaryService<
  RawEthFatBlock,
  EthereumBlock,
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

  protected buildDictionaryQueryEntries<DS>(
    dataSources: BlockHeightMap<DS[]>,
  ): BlockHeightMap<DictionaryV1QueryEntry[] | DictionaryV2QueryEntry> {
    // TODO, is there better way to define type?
    const entries = dataSources.map((d) =>
      this._buildDictionaryQueryEntries(
        d as unknown as (SubqlDatasource & { name?: string })[],
      ),
    );
    return entries;
  }

  private _buildDictionaryQueryEntries(
    // Add name to dataousrces as templates have this set
    dataSources: (SubqlDatasource & { name?: string })[],
  ): DictionaryV1QueryEntry[] | EthDictionaryV2QueryEntry {
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
    if (this.isV2Dictionary()) {
      return buildDictionaryV2QueryEntry(filteredDs);
    } else {
      return buildDictionaryV1QueryEntries(filteredDs);
    }
  }

  async initDictionary(genesisHash: string): Promise<void> {
    if (!this.project) {
      throw new Error(`Project in Dictionary service not initialized `);
    }
    await this.dictionaryInspectionService.inspectDictionaryVersion();
    if (this.isV1Dictionary()) {
      this._dictionary = await EthDictionaryServiceV1.create(
        this.project,
        this.nodeConfig,
        this.eventEmitter,
      );
    } else {
      if (!this.dictionaryEndpoint) {
        throw new Error(
          `Using dictionary v2 but dictionary endpoint not given`,
        );
      }
      this._dictionary = EthDictionaryServiceV2.create(
        this.dictionaryEndpoint,
        this.chainId,
        this.nodeConfig,
        this.eventEmitter,
      );
    }
    await this.initValidation(genesisHash);
  }

  //TODO
  async scopedDictionaryEntries(
    startBlockHeight: number,
    queryEndBlock: number,
    scaledBatchSize: number,
  ): Promise<
    | (Dictionary<number | RawEthFatBlock> & { queryEndBlock: number })
    | undefined
  > {
    return Promise.resolve(undefined);
  }
}
