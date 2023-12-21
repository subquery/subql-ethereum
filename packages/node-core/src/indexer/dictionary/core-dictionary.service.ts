// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import assert from 'assert';
import {EventEmitter2} from '@nestjs/event-emitter';
import {BlockHeightMap} from '@subql/node-core/utils/blockHeightMap';
import {DictionaryQueryEntry as DictionaryV1QueryEntry} from '@subql/types-core/dist/project/types';
import {MetaData as DictionaryV1Metadata} from '@subql/utils';
import {DictionaryServiceInterface, DictionaryV2Metadata, DictionaryV2QueryEntry} from '../';
import {NodeConfig} from '../../configure';

export abstract class CoreDictionaryService<DS> implements DictionaryServiceInterface {
  queriesMap?: BlockHeightMap<DictionaryV1QueryEntry[] | DictionaryV2QueryEntry>;
  protected _startHeight?: number;
  protected _genesisHash?: string;
  protected _metadata: DictionaryV1Metadata | DictionaryV2Metadata | undefined;
  metadataValid: boolean | undefined;

  constructor(
    readonly dictionaryEndpoint: string | undefined,
    protected chainId: string,
    protected readonly nodeConfig: NodeConfig,
    protected readonly eventEmitter: EventEmitter2
  ) {}

  abstract initMetadata(): Promise<void>;
  abstract get metadata(): DictionaryV1Metadata | DictionaryV2Metadata;
  abstract dictionaryValidation(
    metaData?: DictionaryV1Metadata | DictionaryV2Metadata,
    startBlockHeight?: number
  ): boolean;
  abstract buildDictionaryQueryEntries(dataSources: DS[]): DictionaryV1QueryEntry[] | DictionaryV2QueryEntry;
  abstract queryMapValidByHeight(height: number): boolean;
  abstract getQueryEndBlock(startHeight: number, apiFinalizedHeight: number): number;

  get startHeight(): number {
    if (!this._startHeight) {
      throw new Error('Dictionary start height is not set');
    }
    return this._startHeight;
  }

  get useDictionary(): boolean {
    return (!!this.dictionaryEndpoint || !!this.nodeConfig.dictionaryResolver) && !!this.metadataValid;
  }

  get apiGenesisHash(): string {
    assert(this._genesisHash, new Error('Endpoint genesis hash is not set in dictionary'));
    return this._genesisHash;
  }

  setDictionaryStartHeight(start: number | undefined): void {
    // Since not all dictionary has adopted start height, if it is not set, we just consider it is 1.
    if (this._startHeight !== undefined) {
      return;
    }
    this._startHeight = start ?? 1;
  }

  // register genesisHash, also validate with metadata
  metadataValidation(genesisHash: string): boolean {
    this._genesisHash = genesisHash;
    return this.dictionaryValidation(this.metadata);
  }

  updateQueriesMap(dataSources: BlockHeightMap<DS[]>): void {
    this.queriesMap = dataSources.map(this.buildDictionaryQueryEntries);
  }
}
