// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  NodeConfig,
  FatDictionaryResponse,
  DictionaryV2,
  RawFatDictionaryResponseData,
  DictionaryResponse,
  getLogger,
  DictionaryV2QueryEntry,
  IBlock,
} from '@subql/node-core';
import {
  EthereumBlock,
  EthereumHandlerKind,
  EthereumLogFilter,
  EthereumTransactionFilter,
  SubqlDatasource,
  SubqlEthereumProcessorOptions,
} from '@subql/types-ethereum';
import { SubqueryProject } from '../../../configure/SubqueryProject';
import { eventToTopic, functionToSighash } from '../../../utils/string';
import { yargsOptions } from '../../../yargs';
import { ethFilterDs } from '../utils';
import { GroupedEthereumProjectDs } from '../v1';
import {
  RawEthFatBlock,
  EthDictionaryV2QueryEntry,
  EthFatDictionaryTxConditions,
  EthFatDictionaryLogConditions,
} from './types';
import { rawFatBlockToEthBlock } from './utils';

const MIN_FAT_FETCH_LIMIT = 200;
const FAT_BLOCKS_QUERY_METHOD = `subql_filterBlocks`;

const logger = getLogger('eth-dictionary v2');

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

export class EthDictionaryV2 extends DictionaryV2<
  EthereumBlock,
  SubqlDatasource,
  EthDictionaryV2QueryEntry
> {
  protected buildDictionaryQueryEntries(
    dataSources: SubqlDatasource[],
  ): DictionaryV2QueryEntry {
    const filteredDs = ethFilterDs(dataSources);
    return buildDictionaryV2QueryEntry(filteredDs);
  }

  constructor(
    endpoint: string,
    nodeConfig: NodeConfig,
    eventEmitter: EventEmitter2,
    project: SubqueryProject,
    chainId?: string,
  ) {
    super(
      endpoint,
      chainId ?? project.network.chainId,
      nodeConfig,
      eventEmitter,
    );
  }

  /**
   *
   * @param startBlock
   * @param queryEndBlock this block number will limit the max query range, increase dictionary query speed
   * @param batchSize
   * @param conditions
   */
  async getData(
    startBlock: number,
    queryEndBlock: number,
    limit = MIN_FAT_FETCH_LIMIT,
  ): Promise<DictionaryResponse<IBlock<EthereumBlock>> | undefined> {
    const queryDetails = this.queriesMap?.getDetails(startBlock);
    const conditions = queryDetails?.value;
    queryEndBlock = this.metadata.end;

    if (!conditions) {
      return undefined;
    }
    const requestData = {
      jsonrpc: '2.0',
      method: FAT_BLOCKS_QUERY_METHOD,
      id: 1,
      params: [
        startBlock,
        queryEndBlock,
        limit,
        conditions,
        { blockHeader: true, logs: true, transactions: { data: true } },
      ],
    };

    try {
      const response = await this.dictionaryApi.post<{ result?: RawFatDictionaryResponseData<RawEthFatBlock>, error?: { code: number; message: string;}}>(
        this.dictionaryEndpoint,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      if (response.data.error) {
        throw new Error(response.data.error.message);
      }
      const ethBlocks = this.convertResponseBlocks(response.data.result);
      return {
        batchBlocks: ethBlocks.blocks,
        lastBufferedHeight: ethBlocks.end,
      };
    } catch (error) {
      // Handle the error as needed
      throw new Error(`V2 dictionary get query failed ${error}`);
    }
  }

  convertResponseBlocks(
    data: RawFatDictionaryResponseData<RawEthFatBlock>,
  ): FatDictionaryResponse<IBlock<EthereumBlock>> | undefined {
    const blocks: IBlock<EthereumBlock>[] = [];
    for (const block of data.blocks) {
      blocks.push(rawFatBlockToEthBlock(block));
    }
    if (blocks.length !== 0) {
      return {
        blocks: blocks,
        start: blocks[0].block.number,
        end: blocks[blocks.length - 1].block.number,
      };
    } else {
      return undefined;
    }
  }
}
