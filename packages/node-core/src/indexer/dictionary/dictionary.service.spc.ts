// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import {NETWORK_FAMILY} from '@subql/common';
import {DictionaryV1} from './v1';

describe('Dictionary service', function () {
  it('can use the dictionary registry to resolve a url', async () => {
    const dictUrl: string = await (DictionaryV1 as any).resolveDictionary(
      NETWORK_FAMILY.ethereum,
      1,
      'https://github.com/subquery/templates/raw/main/dictionary.json'
    );

    expect(dictUrl).toEqual('https://dict-tyk.subquery.network/query/eth-mainnet');
  });
});
