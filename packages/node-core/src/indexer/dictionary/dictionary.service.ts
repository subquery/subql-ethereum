// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import {EventEmitter2} from '@nestjs/event-emitter';
import {NETWORK_FAMILY} from '@subql/common';
import fetch from 'cross-fetch';
import {NodeConfig} from '../../configure';
import {getLogger} from '../../logger';
import {BlockHeightMap} from '../../utils/blockHeightMap';
import {DictionaryResponse, DictionaryVersion, IDictionary, IDictionaryCtrl} from './types';
import {subqlFilterBlocksCapabilities} from './utils';
import {DictionaryV1} from './v1';
import {DictionaryV2} from './v2';
import {DictionaryV2Metadata} from './';

async function inspectDictionaryVersion(endpoint: string): Promise<DictionaryVersion> {
  if (endpoint.includes('/rpc')) {
    let resp: DictionaryV2Metadata;
    try {
      resp = await subqlFilterBlocksCapabilities(endpoint);
      if (resp.supported.includes('complete')) {
        return DictionaryVersion.v2Complete;
      } else {
        return DictionaryVersion.v2Basic;
      }
    } catch (e) {
      logger.warn(`${e}. Try to use dictionary V1`);
      return DictionaryVersion.v1;
    }
  }
  return DictionaryVersion.v1;
}

const logger = getLogger('DictionaryService');
export abstract class DictionaryService<RFB, FB, DS, D extends DictionaryV1<DS>>
  implements IDictionaryCtrl<DS, FB, IDictionary<DS, FB>>
{
  protected _dictionaries: (DictionaryV2<RFB, FB, DS> | D)[] = [];
  protected _currentDictionaryIndex: number | undefined;
  // Keep in memory in order one of dictionary failed then we can switch
  protected _dictionaryV1Endpoints: string[] = [];
  protected _dictionaryV2Endpoints: string[] = [];

  constructor(
    protected chainId: string,
    protected readonly nodeConfig: NodeConfig,
    protected readonly eventEmitter: EventEmitter2
  ) {}

  abstract initDictionariesV1(): Promise<D[]>;
  abstract initDictionariesV2(): Promise<DictionaryV2<RFB, FB, DS>[]> | DictionaryV2<RFB, FB, DS>[];

  async initDictionaries(apiGenesisHash: string): Promise<void> {
    // For now, treat dictionary resolver as V1
    if (this.nodeConfig.networkDictionaries) {
      for (const endpoint of this.nodeConfig.networkDictionaries) {
        const version = await inspectDictionaryVersion(endpoint);
        if (version === DictionaryVersion.v1) {
          this._dictionaryV1Endpoints.push(endpoint);
        } else {
          this._dictionaryV2Endpoints.push(endpoint);
        }
      }
    }
    this._dictionaries.push(...(await this.initDictionariesV1()));
    this._dictionaries.push(...(await this.initDictionariesV2()));
  }

  get dictionary(): DictionaryV2<RFB, FB, DS> | D {
    if (this._dictionaries.length === 0) {
      throw new Error(`No dictionaries available to use`);
    }
    if (this._currentDictionaryIndex === undefined || this._currentDictionaryIndex <= 0) {
      throw new Error(`Dictionary index is not set`);
    }
    return this._dictionaries[this._currentDictionaryIndex];
  }

  get useDictionary(): boolean {
    if (
      (!!this.nodeConfig.networkDictionaries || !!this.nodeConfig.dictionaryResolver) &&
      this._currentDictionaryIndex !== undefined
    ) {
      return !!this.dictionary.metadataValid;
    }
    return false;
  }

  async findDictionary(height: number): Promise<void> {
    if (this._dictionaries.length === 0) {
      return;
    }
    // update dictionary metadata
    for (const dictionary of this._dictionaries) {
      await dictionary.initMetadata();
      dictionary.heightValidation(height);
    }
    const v2Index = this._dictionaries?.findIndex((d) => d.version === DictionaryVersion.v2Complete && d.metadataValid);
    const v1Index = (this._currentDictionaryIndex = this._dictionaries?.findIndex(
      (d) => d.version === DictionaryVersion.v1 && d.metadataValid
    ));
    // Prioritise v2
    this._currentDictionaryIndex = v2Index >= 0 ? v2Index : v1Index >= 0 ? v1Index : undefined;
  }

  /**
   *
   * @param dataSources
   */

  buildDictionaryEntryMap(dataSources: BlockHeightMap<DS[]>): void {
    if (this.useDictionary) {
      this.dictionary.updateQueriesMap(dataSources);
    }
    return;
  }

  async scopedDictionaryEntries(
    startBlockHeight: number,
    queryEndBlock: number,
    scaledBatchSize: number
  ): Promise<(DictionaryResponse<number | FB> & {queryEndBlock: number}) | undefined> {
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
