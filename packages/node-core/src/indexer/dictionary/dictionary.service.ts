// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import {Injectable} from '@nestjs/common';
import {EventEmitter2} from '@nestjs/event-emitter';
import {NETWORK_FAMILY} from '@subql/common';
import fetch from 'cross-fetch';
import {NodeConfig} from '../../configure';
import {getLogger} from '../../logger';
import {BlockHeightMap} from '../../utils/blockHeightMap';
import {Dictionary} from './types';
import {subqlFilterBlocksCapabilities} from './utils';
import {DictionaryServiceV1} from './v1';
import {DictionaryServiceV2} from './v2';
import {DictionaryV2Metadata, DictionaryVersion} from './';

const logger = getLogger('DictionaryService');

export abstract class DictionaryService<RFB, FB, DS, D extends DictionaryServiceV1<DS>> {
  protected _dictionary: DictionaryServiceV2<RFB, FB, DS> | D | undefined;
  private _dictionaryVersion: DictionaryVersion | undefined;

  constructor(
    readonly dictionaryEndpoint: string | undefined,
    protected chainId: string,
    protected readonly nodeConfig: NodeConfig,
    protected readonly eventEmitter: EventEmitter2,
    protected readonly metadataKeys = ['lastProcessedHeight', 'genesisHash'] // Cosmos uses chain instead of genesisHash
  ) {}

  get version(): DictionaryVersion {
    if (!this._dictionaryVersion) {
      throw new Error(`Dictionary version not been inspected`);
    }
    return this._dictionaryVersion;
  }

  // TODO, we might need to check v1 valid
  async inspectDictionaryVersion(): Promise<void> {
    if (!(this.nodeConfig.networkDictionary || this.nodeConfig.dictionaryResolver)) {
      throw new Error();
    }

    if (this.nodeConfig.networkDictionary && this.nodeConfig.networkDictionary.includes('/rpc')) {
      let resp: DictionaryV2Metadata;
      try {
        resp = await subqlFilterBlocksCapabilities(this.nodeConfig.networkDictionary);
        if (resp.supported.includes('complete')) {
          this._dictionaryVersion = DictionaryVersion.v2Complete;
        } else {
          this._dictionaryVersion = DictionaryVersion.v2Basic;
        }
      } catch (e) {
        logger.warn(`${e}. Try to use dictionary V1`);
        this._dictionaryVersion = DictionaryVersion.v1;
      }
    } else if (this.nodeConfig.dictionaryResolver) {
      this._dictionaryVersion = DictionaryVersion.v1;
    }
  }

  abstract initDictionary(): Promise<void>;

  get dictionary(): DictionaryServiceV2<RFB, FB, DS> | D {
    if (!this._dictionary) {
      throw new Error(`Dictionary not been init`);
    }
    return this._dictionary;
  }

  get useDictionary(): boolean {
    return (!!this.dictionaryEndpoint || !!this.nodeConfig.dictionaryResolver) && !!this.dictionary.metadataValid;
  }

  /**
   *
   * @param genesisHash
   * @protected
   */
  async initValidation(genesisHash: string): Promise<boolean> {
    await this.dictionary.initMetadata();
    return this.dictionary.metadataValidation(genesisHash);
  }

  /**
   *
   * @param dataSources
   */

  buildDictionaryEntryMap(dataSources: BlockHeightMap<DS[]>): void {
    // this.dictionary.buildDictionaryQueryEntries(dataSources);

    this.dictionary.updateQueriesMap(dataSources);
  }

  async scopedDictionaryEntries(
    startBlockHeight: number,
    queryEndBlock: number,
    scaledBatchSize: number
  ): Promise<(Dictionary<number | FB> & {queryEndBlock: number}) | undefined> {
    const dict = await this.dictionary.getDictionary(startBlockHeight, queryEndBlock, scaledBatchSize);
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
