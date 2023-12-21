// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import {MetaData as DictionaryV1Metadata} from '@subql/utils';
import {DictionaryV2Metadata} from './';

export type Dictionary<B> = {
  batchBlocks: number[] | B[];
  lastBufferedHeight: number;
};

export enum DictionaryVersion {
  v1 = 'v1',
  v2Basic = 'v2Basic',
  v2Complete = 'v2Complete',
}

export interface DictionaryServiceInterface {
  initMetadata(): Promise<void>;
  metadata: DictionaryV1Metadata | DictionaryV2Metadata;
  dictionaryValidation(metaData?: DictionaryV1Metadata | DictionaryV2Metadata, startBlockHeight?: number): boolean;
  // buildDictionaryQueryEntries(dataSources: DS[]): DictionaryV1QueryEntry[] | DictionaryV2QueryEntry;
  queryMapValidByHeight(height: number): boolean;
  getQueryEndBlock(startHeight: number, apiFinalizedHeight: number): number;
}
