// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { INestApplication } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import {
  ConnectionPoolService,
  ConnectionPoolStateManager,
  delay,
  NodeConfig,
} from '@subql/node-core';
import { GraphQLSchema } from 'graphql';
import { range } from 'lodash';
import { SubqueryProject } from '../configure/SubqueryProject';
import { EthereumApiService } from './api.service.ethereum';

// Add api key to work
const WS_ENDPOINT = 'wss://eth.api.onfinality.io/ws?apikey=';
const HTTP_ENDPOINT = 'https://eth.api.onfinality.io/public';

function testSubqueryProject(endpoint: string): SubqueryProject {
  return {
    network: {
      endpoint,
      chainId: '1',
    },
    dataSources: [],
    id: 'test',
    root: './',
    schema: new GraphQLSchema({}),
    templates: [],
  } as any;
}

const prepareApiService = async (
  endpoint: string = HTTP_ENDPOINT,
): Promise<[EthereumApiService, INestApplication]> => {
  const module = await Test.createTestingModule({
    providers: [
      ConnectionPoolService,
      ConnectionPoolStateManager,
      {
        provide: NodeConfig,
        useFactory: () => ({}),
      },
      {
        provide: 'ISubqueryProject',
        useFactory: () => testSubqueryProject(endpoint),
      },
      EthereumApiService,
    ],
    imports: [EventEmitterModule.forRoot()],
  }).compile();

  const app = module.createNestApplication();
  await app.init();
  const apiService = app.get(EthereumApiService);
  await apiService.init();
  return [apiService, app];
};

jest.setTimeout(90000);
describe('ApiService', () => {
  let apiService: EthereumApiService;
  let app: INestApplication;

  beforeEach(async () => {
    [apiService, app] = await prepareApiService();
  });

  afterEach(async () => {
    return app?.close();
  });

  it('can instantiate api', async () => {
    console.log(apiService.api.getChainId());
    await delay(0.5);
  });

  it('can fetch blocks', async () => {
    await apiService.api.fetchBlocks(range(12369621, 12369625));
    await delay(0.5);
  });

  it('can get the finalized height', async () => {
    const height = await apiService.api.getFinalizedBlockHeight();

    console.log('Finalized height', height);
    expect(height).toBeGreaterThan(16_000_000);
  });

  it('ensure api errorCode is exposed when throwing', async () => {
    expect.assertions(1);
    return apiService
      .safeApi(17520376)
      .getCode('0x75F0398549C9fDEa03BbDde388361827cb376D5')
      .catch((e) => expect(e.code).toBe('INVALID_ARGUMENT'));
  });
  it('should not retry on any errors not in the retry list', async () => {
    const callSpy = jest.spyOn(apiService.unsafeApi, 'getSafeApi');
    await apiService
      .safeApi(17520376)
      .getCode('0x75F0398549C9fDEa03BbDde388361827cb376D5')
      .catch((e) => expect(e.code).toBe('INVALID_ARGUMENT'));

    expect(callSpy).toHaveBeenCalledTimes(1);
  });
});
