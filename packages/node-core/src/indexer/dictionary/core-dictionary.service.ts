// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import assert from 'assert';
import {Injectable} from '@nestjs/common';
import {EventEmitter2} from '@nestjs/event-emitter';
import {BaseDataSource} from '@subql/common';
import {DictionaryQueryEntry as DictionaryV1QueryEntry} from '@subql/types-core';
import {NodeConfig} from '../../configure';
import {IndexerEvent} from '../../events';
import {getLogger} from '../../logger';
import {BlockHeightMap} from '../../utils/blockHeightMap';
import {DictionaryInspectionService} from './dictionaryInspection.service';
import {CoreMetadata} from './types';
import {Dictionary, DictionaryServiceV1} from './v1';
import {DictionaryServiceV2, DictionaryV2QueryEntry} from './v2';

const logger = getLogger('core-dictionary');

@Injectable()
export abstract class DictionaryService<RFB, FB, D extends DictionaryServiceV1> {
  protected _dictionary: DictionaryServiceV2<RFB, FB> | D | undefined;
  protected dictionaryInspectionService: DictionaryInspectionService;
  private _startHeight: number | undefined;
  private _genesisHash: string | undefined;
  private metadataValid?: boolean;
  queriesMap?: BlockHeightMap<DictionaryV1QueryEntry[] | DictionaryV2QueryEntry>;

  constructor(
    readonly dictionaryEndpoint: string | undefined,
    protected chainId: string,
    protected readonly nodeConfig: NodeConfig,
    protected readonly eventEmitter: EventEmitter2,
    protected readonly metadataKeys = ['lastProcessedHeight', 'genesisHash'] // Cosmos uses chain instead of genesisHash
  ) {
    this.dictionaryInspectionService = new DictionaryInspectionService(this.nodeConfig);
  }

  abstract initDictionary(genesisHash: string): Promise<void>;

  get dictionary(): DictionaryServiceV2<RFB, FB> | D {
    if (!this._dictionary) {
      throw new Error(`Dictionary not been init`);
    }
    return this._dictionary;
  }

  get useDictionary(): boolean {
    return (!!this.dictionaryEndpoint || !!this.nodeConfig.dictionaryResolver) && !!this.metadataValid;
  }

  protected async initValidation(genesisHash: string): Promise<boolean> {
    this._genesisHash = genesisHash;
    const metadata = await this.getMetadata();
    return this.dictionaryValidation(metadata);
  }

  get startHeight(): number {
    if (!this._startHeight) {
      throw new Error('Dictionary start height is not set');
    }
    return this._startHeight;
  }

  isV2Dictionary(): boolean {
    return (
      this.dictionaryInspectionService.version === 'v2Basic' ||
      this.dictionaryInspectionService.version === 'v2Complete'
    );
  }

  isV1Dictionary(): boolean {
    return this.dictionaryInspectionService.version === 'v1';
  }

  get apiGenesisHash(): string {
    assert(this._genesisHash, new Error('Endpoint genesis hash is not set in dictionary'));
    return this._genesisHash;
  }

  async getMetadata(): Promise<CoreMetadata | undefined> {
    const metadata = await this.dictionary.getMetadata();
    this.setDictionaryStartHeight(metadata?.startHeight);
    return metadata;
  }

  private setDictionaryStartHeight(start: number | undefined): void {
    // Since not all dictionary has adopted start height, if it is not set, we just consider it is 1.
    if (this._startHeight !== undefined) {
      return;
    }
    this._startHeight = start ?? 1;
  }

  /**
   *
   * @param startBlock
   * @param queryEndBlock this block number will limit the max query range, increase dictionary query speed
   * @param batchSize
   * @param conditions
   */

  buildDictionaryEntryMap<DS extends BaseDataSource>(dataSources: BlockHeightMap<DS[]>): void {
    this.queriesMap = this.buildDictionaryQueryEntries(dataSources);
  }

  protected abstract buildDictionaryQueryEntries<DS extends BaseDataSource>(
    dataSources: BlockHeightMap<DS[]>
  ): BlockHeightMap<DictionaryV1QueryEntry[] | DictionaryV2QueryEntry>;

  abstract scopedDictionaryEntries(
    startBlockHeight: number,
    queryEndBlock: number,
    scaledBatchSize: number
  ): Promise<(Dictionary<number | RFB> & {queryEndBlock: number}) | undefined>;

  //
  // // Base validation is required, and specific validation for each network should be implemented accordingly
  protected validateChainMeta(metaData: CoreMetadata): boolean {
    return (
      metaData.chain === this.chainId ||
      metaData.genesisHash === this.chainId ||
      this.apiGenesisHash === metaData.genesisHash
    );
  }

  private dictionaryValidation(metaData?: CoreMetadata, startBlockHeight?: number): boolean {
    const validate = (): boolean => {
      try {
        if (!metaData) {
          return false;
        }
        // Some dictionaries rely on chain others rely on genesisHash
        if (!this.validateChainMeta(metaData)) {
          logger.error(
            'The dictionary that you have specified does not match the chain you are indexing, it will be ignored. Please update your project manifest to reference the correct dictionary'
          );
          return false;
        }

        if (startBlockHeight !== undefined && metaData.endHeight < startBlockHeight) {
          logger.warn(`Dictionary indexed block is behind current indexing block height`);
          return false;
        }
        return true;
      } catch (e: any) {
        logger.error(e, 'Unable to validate dictionary metadata');
        return false;
      }
    };

    const valid = validate();

    this.metadataValid = valid;
    this.eventEmitter.emit(IndexerEvent.UsingDictionary, {
      value: Number(this.useDictionary),
    });
    this.eventEmitter.emit(IndexerEvent.SkipDictionary);

    return valid;
  }
}
