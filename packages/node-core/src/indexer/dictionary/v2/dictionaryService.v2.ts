// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import {Injectable} from '@nestjs/common';
import {EventEmitter2} from '@nestjs/event-emitter';
import axios, {AxiosInstance} from 'axios';
import {NodeConfig} from '../../../configure';
import {getLogger} from '../../../logger';
import {BlockHeightMap} from '../../../utils/blockHeightMap';
import {CoreMetadata} from '../types';
import {subqlFilterBlocksCapabilities} from '../utils';
import {
  DictionaryV2Metadata,
  FatDictionaryResponse,
  RawFatDictionaryResponseData,
  DictionaryV2QueryEntry,
} from './types';

const logger = getLogger('fat-dictionary');

@Injectable()
export class DictionaryServiceV2<RFB, FB> {
  queriesMap?: BlockHeightMap<DictionaryV2QueryEntry>;
  protected _startHeight?: number;
  private _metadata: DictionaryV2Metadata | undefined;
  private _validDictionary = false;

  protected dictionaryApi: AxiosInstance;

  constructor(
    readonly dictionaryEndpoint: string,
    protected chainId: string,
    protected readonly nodeConfig: NodeConfig,
    private readonly eventEmitter: EventEmitter2
  ) {
    this.dictionaryApi = axios.create({
      baseURL: dictionaryEndpoint,
    });
  }

  static create(dictionaryEndpoint: string, chainId: string, nodeConfig: NodeConfig, eventEmitter: EventEmitter2) {
    return new DictionaryServiceV2(dictionaryEndpoint, chainId, nodeConfig, eventEmitter);
  }

  private convertMetaToCore(metaV2: DictionaryV2Metadata): CoreMetadata {
    return {
      startHeight: metaV2.start,
      endHeight: metaV2.end,
      genesisHash: metaV2.genesisHash,
      chain: this.chainId,
    };
  }

  async getMetadata(): Promise<CoreMetadata | undefined> {
    const cap = await subqlFilterBlocksCapabilities(this.dictionaryEndpoint);
    if (cap !== undefined) {
      return this.convertMetaToCore(cap);
    }
    return undefined;
  }

  get metadata(): DictionaryV2Metadata {
    if (!this._metadata) {
      throw new Error(`Fat dictionary _metadata haven't init yet`);
    }
    return this._metadata;
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

  // abstract queryFatDictionary(
  //   startBlock: number,
  //   queryEndBlock: number,
  //   limit: number,
  //   conditions?: FatDictionaryQueryEntry
  // ): Promise<RawFatDictionaryResponseData<RFB> | undefined>;
  //
  // abstract convertResponseBlocks(data: RawFatDictionaryResponseData<RFB>): FatDictionaryResponse<FB> | undefined;
  //
  //
  // async scopedQueryFatDictionary(
  //   startBlockHeight: number,
  //   limit: number
  // ): Promise<FatDictionaryResponse<FB> | undefined> {
  //   const queryDetails = this.queriesMap?.getDetails(startBlockHeight);
  //   const queryEntry: FatDictionaryQueryEntry = queryDetails?.value ?? {};
  //
  //   // Same as capability end block or it can be undefined
  //   const metaEndBlock = this.metadata.end;
  //   const queryEndBlock =
  //     queryDetails?.endHeight && queryDetails?.endHeight < metaEndBlock ? queryDetails.endHeight : metaEndBlock;
  //
  //   try {
  //     const dict = await this.queryFatDictionary(startBlockHeight, queryEndBlock, limit, queryEntry);
  //
  //     if (dict === undefined) {
  //       return;
  //     }
  //     // Return the queryEndBlock to know if the scoped entry changed it.
  //     return this.convertResponseBlocks(dict);
  //   } catch (e) {
  //     // TODO, return undefined, should add logic to fall back to v1 method
  //   }
  // }
  //
}
