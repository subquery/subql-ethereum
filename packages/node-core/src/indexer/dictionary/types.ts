// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import {BlockHeightMap} from '../../utils/blockHeightMap';

export type DictionaryResponse<B = number> = {
  batchBlocks: B[];
  lastBufferedHeight: number;
};

export enum DictionaryVersion {
  v1 = 'v1',
  v2Basic = 'v2Basic',
  v2Complete = 'v2Complete',
}

export interface IDictionary<DS, FB> {
  metadataValid: boolean | undefined;
  getData(
    startBlock: number,
    queryEndBlock: number,
    limit: number
  ): Promise<DictionaryResponse<IBlock<FB> | number> | undefined>;
  init(): Promise<void>;
  queryMapValidByHeight(height: number): boolean;
  getQueryEndBlock(startHeight: number, apiFinalizedHeight: number): number;
  version: DictionaryVersion;
  startHeight: number;
  heightValidation(height: number): boolean;
  updateQueriesMap(dataSources: BlockHeightMap<DS[]>): void;
}

export interface IDictionaryCtrl<DS, FB> {
  initDictionaries(): void;
  startHeight: number;
  useDictionary: boolean;
  findDictionary(height: number): Promise<void>;
  buildDictionaryEntryMap(dataSources: BlockHeightMap<DS[]>): void;
  scopedDictionaryEntries(
    startBlockHeight: number,
    queryEndBlock: number,
    scaledBatchSize: number
  ): Promise<(DictionaryResponse<number | IBlock<FB>> & {queryEndBlock: number}) | undefined>;
}

export interface IBlock<B> {
  getHeader(): {
    hash: string;
    height: number;
    parentHash?: string;
  };
  block: B;
}
