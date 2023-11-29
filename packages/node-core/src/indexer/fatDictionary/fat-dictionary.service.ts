// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import assert from 'assert';
import {Injectable} from '@nestjs/common';
import {getLogger} from '@subql/node-core/logger';
import {BaseDataSource} from '@subql/types-core';
import axios, {AxiosInstance, AxiosResponse} from 'axios';
import {NodeConfig} from '../../configure';
import {BlockHeightMap} from '../../utils/blockHeightMap';
import {
  FatDictionaryQueryEntry,
  FatDictionaryMetadata,
  FatDictionaryResponse,
  RawFatDictionaryResponseData,
} from './types';

const FAT_META_QUERY_METHOD = `subql_filterBlocksCapabilities`;
const logger = getLogger('fat-dictionary');

@Injectable()
export abstract class FatDictionaryService<RFB, FB> {
  queriesMap?: BlockHeightMap<FatDictionaryQueryEntry>;
  protected _startHeight?: number;
  private _metadata: FatDictionaryMetadata | undefined;
  private _validDictionary = false;

  protected dictionaryApi: AxiosInstance;

  constructor(protected readonly nodeConfig: NodeConfig) {
    this.dictionaryApi = axios.create({
      baseURL: nodeConfig.fatDictionary,
    });
  }

  async initDictionary(genesisHash: string): Promise<void> {
    try {
      const metadata = await this.subqlFilterBlocksCapabilities();
      this._metadata = {
        start: metadata.data.result.availableBlocks[0].startHeight,
        end: metadata.data.result.availableBlocks[0].endHeight,
        genesisHash: metadata.data.result.genesisHash,
        filters: metadata.data.result.filters,
        supported: metadata.data.result.supportedRespnses,
      };
      if (genesisHash === this._metadata.genesisHash) {
        this._validDictionary = true;
      }
    } catch (e) {
      this._validDictionary = false;
      logger.warn(`Fat dictionary is not valid, ${e}`);
    }
  }

  get metadata(): FatDictionaryMetadata {
    if (!this._metadata) {
      throw new Error(`Fat dictionary _metadata haven't init yet`);
    }
    return this._metadata;
  }

  get dictionaryEndpoint(): string {
    assert(this.nodeConfig.fatDictionary, 'fat dictionary not in node config');
    return this.nodeConfig.fatDictionary;
  }

  async subqlFilterBlocksCapabilities(): Promise<AxiosResponse> {
    const requestData = {
      jsonrpc: '2.0',
      method: FAT_META_QUERY_METHOD,
      id: 1,
    };
    try {
      const response = await this.dictionaryApi.post(this.dictionaryEndpoint, requestData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response;
    } catch (error) {
      // Handle the error as needed
      throw new Error(`Fat dictionary get capacity failed ${error}`);
    }
  }

  useFatDictionary(currentHeight: number): boolean {
    return this._validDictionary && currentHeight >= this.metadata.start && currentHeight < this.metadata.end;
  }

  get startHeight(): number {
    if (!this._startHeight) {
      throw new Error('Dictionary start height is not set');
    }
    return this._startHeight;
  }
  /**
   *
   * @param startBlock
   * @param queryEndBlock this block number will limit the max query range, increase dictionary query speed
   * @param batchSize
   * @param conditions
   */

  abstract queryFatDictionary(
    startBlock: number,
    queryEndBlock: number,
    limit: number,
    conditions?: FatDictionaryQueryEntry
  ): Promise<RawFatDictionaryResponseData<RFB> | undefined>;

  abstract convertResponseBlocks(data: RawFatDictionaryResponseData<RFB>): FatDictionaryResponse<FB> | undefined;

  buildFatDictionaryQueryMap<DS extends BaseDataSource>(
    dataSources: BlockHeightMap<DS[]>,
    buildDictionaryQueryEntries: (dataSources: DS[]) => FatDictionaryQueryEntry
  ): void {
    this.queriesMap = dataSources.map(buildDictionaryQueryEntries);
  }

  async scopedQueryFatDictionary(
    startBlockHeight: number,
    limit: number
  ): Promise<FatDictionaryResponse<FB> | undefined> {
    const queryDetails = this.queriesMap?.getDetails(startBlockHeight);
    const queryEntry: FatDictionaryQueryEntry = queryDetails?.value ?? {};

    // Same as capability end block or it can be undefined
    const metaEndBlock = this.metadata.end;
    const queryEndBlock =
      queryDetails?.endHeight && queryDetails?.endHeight < metaEndBlock ? queryDetails.endHeight : metaEndBlock;

    try {
      const dict = await this.queryFatDictionary(startBlockHeight, queryEndBlock, limit, queryEntry);

      if (dict === undefined) {
        return;
      }
      // Return the queryEndBlock to know if the scoped entry changed it.
      return this.convertResponseBlocks(dict);
    } catch (e) {
      // TODO, return undefined, should add logic to fall back to v1 method
    }
  }
}
