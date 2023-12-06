// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import {NodeConfig} from '../../configure';
import {getLogger} from '../../logger';
import {subqlFilterBlocksCapabilities} from '../dictionary/utils';
import {DictionaryV2Metadata} from './v2';

export enum DictionaryVersion {
  v1 = 'v1',
  v2Basic = 'v2Basic',
  v2Complete = 'v2Complete',
}

const logger = getLogger('dictionary-inspection');

export class DictionaryInspectionService {
  private _dictionaryVersion: DictionaryVersion | undefined;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  constructor(protected readonly nodeConfig: NodeConfig) {}

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
        logger.warn(`${e}. Switch to use dictionary V1`);
        this._dictionaryVersion = DictionaryVersion.v1;
      }
    } else if (this.nodeConfig.dictionaryResolver) {
      this._dictionaryVersion = DictionaryVersion.v1;
    }
  }
}
