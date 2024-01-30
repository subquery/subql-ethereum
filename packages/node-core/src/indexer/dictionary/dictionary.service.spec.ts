// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import {EventEmitter2} from '@nestjs/event-emitter';
import {NETWORK_FAMILY} from '@subql/common';
import {DictionaryQueryEntry} from '@subql/types-core';
import {NodeConfig} from '../..';
import {DictionaryService} from './dictionary.service';
import {DictionaryResponse} from './types';
import {DictionaryV1} from './v1';
import {testDictionaryV1} from './v1/dictionaryV1.test';
import {DictionaryV2, DictionaryV2QueryEntry} from './v2';

interface testRFB {
  Header: {
    number: bigint;
    gasLimit: bigint;
    hash: string;
  };
}

interface testFB {
  gasLimit: bigint;
  gasUsed: bigint;
  hash: string;
}

class testDictionaryV2 extends DictionaryV2<testRFB, testFB, any, any> {
  buildDictionaryQueryEntries(dataSources: any[]): DictionaryV2QueryEntry {
    return {};
  }

  async getData(
    startBlock: number,
    queryEndBlock: number,
    limit: number
  ): Promise<DictionaryResponse<testFB> | undefined> {
    return Promise.resolve(undefined);
  }
}

class testDictionaryService extends DictionaryService<testRFB, testFB, any, testDictionaryV1> {
  protected async initDictionariesV1(): Promise<testDictionaryV1[]> {
    const dictionaries = [
      ...(await Promise.all(
        this._dictionaryV1Endpoints.map(
          (endpoint) => new testDictionaryV1(endpoint, 'mockChainId', this.nodeConfig, this.eventEmitter)
        )
      )),
    ];
    return dictionaries;
  }

  protected initDictionariesV2(): DictionaryV2<testRFB, testFB, any>[] {
    const dictionaries = this._dictionaryV2Endpoints.map(
      (endpoint) => new testDictionaryV2(endpoint, 'mockChainId', this.nodeConfig, this.eventEmitter)
    );
    return dictionaries;
  }
}

describe('Dictionary service', function () {
  let dictionaryService: testDictionaryService;

  beforeAll(async () => {
    const nodeConfig = new NodeConfig({
      subquery: 'dictionaryService',
      subqueryName: 'asdf',
      networkEndpoint: ['wss://eth.api.onfinality.io/public-ws'],
      dictionaryTimeout: 10,
      dictionaryResolver: false,
      networkDictionary: [
        'https://gx.api.subquery.network/sq/subquery/eth-dictionary',
        'https://dict-tyk.subquery.network/query/eth-mainnet',
        'http://localhost:3000/rpc',
      ],
    });

    dictionaryService = new testDictionaryService('0xchainId', nodeConfig, new EventEmitter2());
    await dictionaryService.initDictionaries('0xGenesisHash');
  });
  it('can use the dictionary registry to resolve a url', async () => {
    const dictUrl: string = await (DictionaryV1 as any).resolveDictionary(
      NETWORK_FAMILY.ethereum,
      1,
      'https://github.com/subquery/templates/raw/main/dictionary.json'
    );

    expect(dictUrl).toEqual('https://dict-tyk.subquery.network/query/eth-mainnet');
  });

  it('init Dictionaries with mutiple endpoints, can be valid and non-valid', () => {
    expect((dictionaryService as any)._dictionaries.length).toBe(3);
  });

  it('can find valid dictionary with height', async () => {
    // If we haven't set dictionary
    expect(() => dictionaryService.dictionary).toThrow(`Dictionary index is not set`);

    await dictionaryService.findDictionary(1);
    expect(dictionaryService.dictionary).toBeTruthy();
    // Current only valid endpoint been provided
    expect(dictionaryService.dictionary.dictionaryEndpoint).toBe('https://dict-tyk.subquery.network/query/eth-mainnet');

    expect(dictionaryService.useDictionary).toBeTruthy();
  });

  it('scopedDictionaryEntries, dictionary get data should be called', async () => {
    await dictionaryService.findDictionary(1000);

    const spyDictionary = jest.spyOn(dictionaryService.dictionary, 'getData');

    const blocks = await dictionaryService.scopedDictionaryEntries(1000, 11000, 100);
    expect(spyDictionary).toHaveBeenCalled();
    expect(blocks).toBeTruthy();
  });

  // mock dictionary end height, and switch dictionary
});
