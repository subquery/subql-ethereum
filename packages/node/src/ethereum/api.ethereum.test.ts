// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import path from 'path';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  EthereumDatasourceKind,
  EthereumHandlerKind,
  EthereumLogFilter,
  SubqlRuntimeDatasource,
} from '@subql/types-ethereum';
import { EthereumApi } from './api.ethereum';
import { EthereumBlockWrapped } from './block.ethereum';

// Add api key to work
const HTTP_ENDPOINT = 'https://eth.api.onfinality.io/public';

const ds: SubqlRuntimeDatasource = {
  mapping: {
    file: '',
    handlers: [
      {
        handler: 'test',
        kind: EthereumHandlerKind.Call,
        filter: { function: '0x23b872dd' },
      },
    ],
  },
  kind: EthereumDatasourceKind.Runtime,
  startBlock: 16258633,
  options: { abi: 'erc721' },
  assets: {
    erc721: { file: path.join(__dirname, '../../test/erc721.json') },
  } as unknown as Map<string, { file: string }>,
};

jest.setTimeout(90000);
describe('Api.ethereum', () => {
  let ethApi: EthereumApi;
  const eventEmitter = new EventEmitter2();
  let blockData: EthereumBlockWrapped;
  beforeEach(async () => {
    ethApi = new EthereumApi(HTTP_ENDPOINT, eventEmitter);
    await ethApi.init();
    blockData = await ethApi.fetchBlock(16258633, true);
  });

  it('Should format transaction in logs, and the transaction gas should be bigInt type', () => {
    expect(typeof blockData.logs[0].transaction.gas).toBe('bigint');
    expect(typeof blockData.logs[0].transaction.blockNumber).toBe('number');
    expect(typeof blockData.logs[0].transaction.gasPrice).toBe('bigint');
    expect(typeof blockData.logs[0].transaction.maxPriorityFeePerGas).toBe(
      'bigint',
    );
    expect(typeof blockData.logs[0].transaction.transactionIndex).toBe(
      'bigint',
    );
  });

  it('Decode nested logs in transactions', async () => {
    // Erc721
    const tx = blockData.transactions.find(
      (e) =>
        e.hash ===
        '0x8e419d0e36d7f9c099a001fded516bd168edd9d27b4aec2bcd56ba3b3b955ccc',
    );
    const parsedTx = await ethApi.parseTransaction(tx, ds);
    expect(parsedTx.logs[0].args).toBeTruthy();
  });

  it('Should return raw logs, if decode fails', async () => {
    // not Erc721
    const tx = blockData.transactions.find(
      (e) =>
        e.hash ===
        '0xed62f7a7720fe6ae05dec45ad9dd4f53034a0aae2c140d229b1151504ee9a6c9',
    );
    const parsedLog = await ethApi.parseLog(tx.logs[0], ds);
    expect(parsedLog).not.toHaveProperty('args');
    expect(parsedLog).toBeTruthy();
  });
  it('Null filter support', async () => {
    const beamEndpoint = 'https://rpc.api.moonbeam.network';
    ethApi = new EthereumApi(beamEndpoint, eventEmitter);
    await ethApi.init();
    blockData = await ethApi.fetchBlock(2847447, true);
    const result = blockData.transactions.filter((tx) => {
      if (
        EthereumBlockWrapped.filterTransactionsProcessor(
          tx,
          { to: null },
          '0x72a33394f0652e2bf15d7901f3cd46863d968424',
        )
      ) {
        return tx.hash;
      }
    });
    expect(result[0].hash).toBe(
      '0x24bef923522a4d6a79f9ab9242a74fb987dce94002c0f107c2a7d0b7e24bcf05',
    );
    expect(result.length).toBe(1);
  });

  it('!null filter support for logs, expect to filter out', async () => {
    const beamEndpoint = 'https://rpc.api.moonbeam.network';
    ethApi = new EthereumApi(beamEndpoint, eventEmitter);
    await ethApi.init();
    const filter_1: EthereumLogFilter = {
      topics: [
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        undefined,
        undefined,
        '!null',
      ],
    };

    const filter_2: EthereumLogFilter = {
      topics: [
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      ],
    };

    blockData = await ethApi.fetchBlock(4015990, true);
    const transaction = blockData.transactions.find(
      (tx) =>
        tx.hash ===
        '0xeb2e443f2d4e784193fa13bbbae2b85e6ee459e7b7b53f8ca098ffae9b25b059',
    );
    const erc20Transfers = transaction.logs.filter((log) => {
      if (EthereumBlockWrapped.filterLogsProcessor(log, filter_2)) {
        return log;
      }
    });
    const erc721Transfers = transaction.logs.filter((log) => {
      if (EthereumBlockWrapped.filterLogsProcessor(log, filter_1)) {
        return log;
      }
    });

    expect(erc20Transfers.length).toBe(7);
    expect(erc721Transfers.length).toBe(2);
  });

  it('Null filter support, for undefined transaction.to', async () => {
    const beamEndpoint = 'https://rpc.api.moonbeam.network';
    ethApi = new EthereumApi(beamEndpoint, eventEmitter);
    await ethApi.init();
    blockData = await ethApi.fetchBlock(2847447, true);
    blockData.transactions[1].to = undefined;
    const result = blockData.transactions.filter((tx) => {
      if (
        EthereumBlockWrapped.filterTransactionsProcessor(
          tx,
          { to: null },
          '0x72a33394f0652e2bf15d7901f3cd46863d968424',
        )
      ) {
        return tx.hash;
      }
    });
    expect(result[0].hash).toBe(
      '0x24bef923522a4d6a79f9ab9242a74fb987dce94002c0f107c2a7d0b7e24bcf05',
    );
    expect(result.length).toBe(1);
  });

  it('Should return all tx if filter.to is not defined', async () => {
    const beamEndpoint = 'https://rpc.api.moonbeam.network';
    ethApi = new EthereumApi(beamEndpoint, eventEmitter);
    await ethApi.init();
    blockData = await ethApi.fetchBlock(2847447, true);
    const result = blockData.transactions.filter((tx) => {
      if (
        EthereumBlockWrapped.filterTransactionsProcessor(
          tx,
          undefined,
          '0x72a33394f0652e2bf15d7901f3cd46863d968424',
        )
      ) {
        return tx.hash;
      }
    });
    expect(result.length).toBe(2);
  });

  it('filter.to Should support only null not undefined', async () => {
    const beamEndpoint = 'https://rpc.api.moonbeam.network';
    ethApi = new EthereumApi(beamEndpoint, eventEmitter);
    await ethApi.init();
    blockData = await ethApi.fetchBlock(2847447, true);
    const result = blockData.transactions.filter((tx) => {
      if (
        EthereumBlockWrapped.filterTransactionsProcessor(
          tx,
          { to: undefined },
          '0x72a33394f0652e2bf15d7901f3cd46863d968424',
        )
      ) {
        return tx.hash;
      }
    });
    expect(result.length).toBe(0);
  });
  it('If transaction is undefined, with null filter, should be supported', async () => {
    const beamEndpoint = 'https://rpc.api.moonbeam.network';
    ethApi = new EthereumApi(beamEndpoint, eventEmitter);
    await ethApi.init();
    blockData = await ethApi.fetchBlock(2847447, true);
    const result = blockData.transactions.filter((tx) => {
      tx.to = undefined;
      if (
        EthereumBlockWrapped.filterTransactionsProcessor(
          tx,
          { to: null },
          '0x72a33394f0652e2bf15d7901f3cd46863d968424',
        )
      ) {
        return tx.hash;
      }
    });
    expect(result.length).toBe(2);
  });

  it('Resolves the correct tags for finalization', async () => {
    // Ethereum
    expect((ethApi as any).supportsFinalization).toBeTruthy();

    // Moonbeam
    ethApi = new EthereumApi('https://rpc.api.moonbeam.network', eventEmitter);
    await ethApi.init();

    expect((ethApi as any).supportsFinalization).toBeTruthy();

    // BSC
    ethApi = new EthereumApi('https://bsc-dataseed.binance.org', eventEmitter);
    await ethApi.init();

    expect((ethApi as any).supportsFinalized).toBeFalsy();

    // Polygon
    ethApi = new EthereumApi(
      'https://polygon.api.onfinality.io/public',
      eventEmitter,
    );
    await ethApi.init();

    expect((ethApi as any).supportsFinalized).toBeFalsy();
  });
});
