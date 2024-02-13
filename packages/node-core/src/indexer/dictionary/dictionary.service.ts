// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import {EventEmitter2} from '@nestjs/event-emitter';
import {NETWORK_FAMILY} from '@subql/common';
import fetch from 'cross-fetch';
import {NodeConfig} from '../../configure';
import {getLogger} from '../../logger';
import {timeout} from '../../utils';
import {BlockHeightMap} from '../../utils/blockHeightMap';
import {DictionaryResponse, DictionaryVersion, IBlock, IDictionary, IDictionaryCtrl} from './types';
import {subqlFilterBlocksCapabilities} from './v2';
import {DictionaryV2Metadata} from './';

export async function inspectDictionaryVersion(
  endpoint: string,
  timeoutSec: number
): Promise<DictionaryVersion | undefined> {
  let resp: DictionaryV2Metadata;
  const timeoutMsg = 'Inspect dictionary version timeout';
  try {
    resp = await timeout(subqlFilterBlocksCapabilities(endpoint), timeoutSec, timeoutMsg);
    if (resp.supported.includes('complete')) {
      return DictionaryVersion.v2Complete;
    } else {
      return DictionaryVersion.v2Basic;
    }
  } catch (e: any) {
    if (e.message === timeoutMsg) {
      return undefined;
    }
    logger.warn(`${e}. Try to use dictionary V1`);
    return DictionaryVersion.v1;
  }
}

const logger = getLogger('DictionaryService');
export abstract class DictionaryService<DS, FB, D extends IDictionary<DS, FB>> implements IDictionaryCtrl<DS, FB> {
  protected _dictionaries: D[] = [];

  protected _currentDictionaryIndex: number | undefined;
  constructor(
    protected chainId: string,
    protected readonly nodeConfig: NodeConfig,
    protected readonly eventEmitter: EventEmitter2
  ) {}

  abstract initDictionaries(): Promise<void>;

  init(dictionaries: D[]): void {
    this._dictionaries = dictionaries;
  }

  get startHeight(): number {
    return this.dictionary.startHeight;
  }

  get dictionary(): D {
    if (this._dictionaries.length === 0) {
      throw new Error(`No dictionaries available to use`);
    }
    if (this._currentDictionaryIndex === undefined || this._currentDictionaryIndex < 0) {
      throw new Error(`Dictionary index is not set`);
    }
    return this._dictionaries[this._currentDictionaryIndex];
  }

  get useDictionary(): boolean {
    if (!!this._dictionaries.length && this._currentDictionaryIndex !== undefined) {
      return !!this.dictionary.metadataValid;
    }
    return false;
  }

  async findDictionary(height: number): Promise<void> {
    if (this._dictionaries.length === 0) {
      return;
    }
    // update dictionary metadata
    await Promise.all(
      this._dictionaries.map(async (dictionary) => {
        try {
          await dictionary.init();
          dictionary.heightValidation(height);
        } catch (e) {
          logger.warn(
            `When find dictionary, init metadata and height validation failed, please check ${
              (dictionary as any).dictionaryEndpoint
            }`
          );
        }
      })
    );

    const v2Index = this._dictionaries?.findIndex((d) => d.version === DictionaryVersion.v2Complete && d.metadataValid);
    const v1Index = (this._currentDictionaryIndex = this._dictionaries?.findIndex(
      (d) => d.version === DictionaryVersion.v1 && d.metadataValid
    ));
    // If workers are enable, we only support v1.
    // Otherwise, prioritise v2
    if (this.nodeConfig.workers !== undefined) {
      this._currentDictionaryIndex = v1Index >= 0 ? v1Index : undefined;
      logger.info('When workers currently only support v1 Dictionary, will use v1 dictionary');
    } else {
      this._currentDictionaryIndex = v2Index >= 0 ? v2Index : v1Index >= 0 ? v1Index : undefined;
    }
  }

  /**
   *
   * @param dataSources
   */

  buildDictionaryEntryMap(dataSources: BlockHeightMap<DS[]>): void {
    for (const dict of this._dictionaries) {
      dict.updateQueriesMap(dataSources);
    }
  }

  async scopedDictionaryEntries(
    startBlockHeight: number,
    queryEndBlock: number,
    scaledBatchSize: number
  ): Promise<(DictionaryResponse<number | IBlock<FB>> & {queryEndBlock: number}) | undefined> {
    const dict = await this.dictionary.getData(startBlockHeight, queryEndBlock, scaledBatchSize);
    // Check undefined
    if (!dict) return undefined;

    // Return the queryEndBlock to know if the scoped entry changed it.
    return {
      ...dict,
      queryEndBlock,
    };
  }

  protected async resolveDictionary(
    networkFamily: NETWORK_FAMILY,
    chainId: string,
    registryUrl: string
  ): Promise<string | undefined> {
    try {
      const response = await fetch(registryUrl);

      if (!response.ok) {
        throw new Error(`Bad response, code="${response.status}" body="${await response.text()}"`);
      }
      const dictionaryJson = await response.json();

      const dictionaries = dictionaryJson[networkFamily.toLowerCase()][chainId];

      if (Array.isArray(dictionaries) && dictionaries.length > 0) {
        // TODO choose alternatives
        return dictionaries[0];
      }
    } catch (error: any) {
      logger.error(error, 'An error occurred while fetching the dictionary:');
    }
  }
}
