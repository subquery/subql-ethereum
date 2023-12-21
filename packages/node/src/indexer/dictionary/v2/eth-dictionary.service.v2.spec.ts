// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { NodeConfig } from '@subql/node-core';
import {
  EthereumDatasourceKind,
  EthereumHandlerKind,
} from '@subql/types-ethereum';
import {
  EthereumProjectDs,
  SubqueryProject,
} from '../../../configure/SubqueryProject';
import { buildDictionaryV2QueryEntry } from '../v2';
import { EthDictionaryServiceV2 } from './eth-dictionary.service.v2';

const HTTP_ENDPOINT = 'https://polygon.api.onfinality.io/public';
const mockDs: EthereumProjectDs[] = [
  {
    kind: EthereumDatasourceKind.Runtime,
    assets: new Map(),
    startBlock: 3678215,
    mapping: {
      entryScript: '',
      file: './dist/index.js',
      handlers: [
        {
          handler: 'handleTransaction',
          kind: EthereumHandlerKind.Call,
          filter: {
            function: 'approve(address spender, uint256 rawAmount)',
          },
        },
        {
          handler: 'handleLog',
          kind: EthereumHandlerKind.Event,
          filter: {
            topics: [
              'Transfer(address indexed from, address indexed to, uint256 amount)',
            ],
          },
        },
      ],
    },
  },
];

const nodeConfig = new NodeConfig({
  subquery: 'polygon-starter',
  subqueryName: 'polygon-starter',
  dictionaryTimeout: 10,
  networkEndpoint: [HTTP_ENDPOINT],
});

const fatDictionaryService = new EthDictionaryServiceV2(
  {} as SubqueryProject,
  nodeConfig,
  undefined,
  '',
);

const dictionaryQueryEntries = buildDictionaryV2QueryEntry(mockDs);

let fatDictionaryQueryEntries;
// beforeAll(async () => {
//   await fatDictionaryService.initDictionary();
//   // manually set up dictionary entry map
//   fatDictionaryQueryEntries = fatDictionaryService.dictionaryFatQuery(
//     dictionaryQueryEntries,
//   );
// });
//
// it('convert ds to fat dictionary queries', () => {
//   //Polygon
//   console.log(fatDictionaryQueryEntries);
//   expect(fatDictionaryQueryEntries.logs.length).toBe(1);
//   expect(fatDictionaryQueryEntries.transactions.length).toBe(1);
// }, 5000000);
//
// let fatBlock3678215;
// let fatBlock3678250;
//
// it('query fat dictionary should return response fat blocks', async () => {
//   //Polygon
//   const fatBlocks = await fatDictionaryService.queryFatDictionary(
//     3678215,
//     (fatDictionaryService as any)._metadata.end,
//     2,
//     dictionaryQueryEntries,
//   );
//
//   expect(fatBlocks.BlockRange).toStrictEqual([3678215, 3678250]);
//
//   fatBlock3678215 = fatBlocks.Blocks[0];
//   fatBlock3678250 = fatBlocks.Blocks[1];
//
//   expect(Number(fatBlock3678215.Header.number)).toBe(3678215);
//   expect(Number(fatBlock3678250.Header.number)).toBe(3678250);
//
//   // To match with dictionaryQueryEntries[0].func
//   expect(fatBlock3678215.Transactions[0].func).toBe('0x60806040');
//
//   expect(fatBlock3678250.Logs.length).toBe(1);
//   // This matches with dictionaryQueryEntries[0].topics
//   expect(fatBlock3678250.Logs[0].topics).toContain(
//     '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
//   );
// }, 5000000);
//
// it('able to convert raw fatBlocks into eth blocks', async () => {
//   //Polygon
//   const fatBlocks = await fatDictionaryService.queryFatDictionary(
//     3678215,
//     (fatDictionaryService as any)._metadata.end,
//     2,
//     dictionaryQueryEntries,
//   );
//
//   expect(fatBlocks.BlockRange).toStrictEqual([3678215, 3678250]);
//
//   const ethBlocks =
//     fatDictionaryService.convertResponseBlocks(fatBlocks).blocks;
//   console.log(ethBlocks);
//
//   // Can include input and hash
//   // https://polygonscan.com/tx/0xb1b5f7882fa8d62d3650948c08066e928b7b5c9d607d2fe8c7e6ce57caf06774
//   expect(ethBlocks[1].transactions[1].hash).toBe(
//     `0xb1b5f7882fa8d62d3650948c08066e928b7b5c9d607d2fe8c7e6ce57caf06774`,
//   );
//   expect(ethBlocks[1].transactions[1].input).toBe(
//     `0x23b872dd000000000000000000000000244a79a2e79e8d884d9c9cc425d88f9e2ed988ca000000000000000000000000d22c4c383ce5efa0364d5fab5ce1313c24a52bda0000000000000000000000000000000000000000000000000000000000000159`,
//   );
//
//   // relate logs
//   // https://polygonscan.com/tx/0xb1b5f7882fa8d62d3650948c08066e928b7b5c9d607d2fe8c7e6ce57caf06774#eventlog
//   expect(ethBlocks[1].logs[0].data).toBe(`0x`);
// }, 5000000);
