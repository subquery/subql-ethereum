// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import {EventEmitter2} from '@nestjs/event-emitter';
import axios, {AxiosInstance} from 'axios';
import {Dictionary} from '..';
import {NodeConfig} from '../../../configure';
import {BlockHeightMap} from '../../../utils/blockHeightMap';
import {CoreDictionaryService} from '../coreDictionary.service';
import {subqlFilterBlocksCapabilities} from '../utils';
import {DictionaryV2Metadata, DictionaryV2QueryEntry} from './types';

export abstract class DictionaryServiceV2<
  RFB,
  FB,
  DS,
  QE extends DictionaryV2QueryEntry = DictionaryV2QueryEntry
> extends CoreDictionaryService<DS> {
  queriesMap?: BlockHeightMap<QE>;
  protected _metadata: DictionaryV2Metadata | undefined;
  protected dictionaryApi: AxiosInstance;

  constructor(
    readonly dictionaryEndpoint: string,
    protected chainId: string,
    protected readonly nodeConfig: NodeConfig,
    protected readonly eventEmitter: EventEmitter2
  ) {
    super(dictionaryEndpoint, chainId, nodeConfig, eventEmitter);
    this.dictionaryApi = axios.create({
      baseURL: dictionaryEndpoint,
    });
  }

  abstract buildDictionaryQueryEntries(dataSources: DS[]): DictionaryV2QueryEntry;

  async initMetadata(): Promise<void> {
    this._metadata = await subqlFilterBlocksCapabilities(this.dictionaryEndpoint);
    this.setDictionaryStartHeight(this._metadata.start);
  }

  get metadata(): DictionaryV2Metadata {
    if (!this._metadata) {
      throw new Error(`Fat dictionary _metadata haven't init yet`);
    }
    return this._metadata;
  }

  getQueryEndBlock(startBlockHeight: number, apiFinalizedHeight: number): number {
    return this.metadata.end;
  }

  abstract getDictionary(startBlock: number, queryEndBlock: number, limit: number): Promise<Dictionary<FB> | undefined>;

  queryMapValidByHeight(height: number): boolean {
    return !!this.queriesMap?.get(height);
  }

  dictionaryValidation(metaData?: DictionaryV2Metadata, startBlockHeight?: number): boolean {
    // return this._validDictionary && currentHeight >= this.metadata.start && currentHeight < this.metadata.end;
    // TODO
    this.metadataValid = true;
    return true;
  }
}
