/* eslint-disable */
import { JsonRpcProvider } from './json-rpc-provider';
import { JsonRpcProvider as BaseJsonRpcProvider, JsonRpcPayload } from 'ethers';
// import { JsonRpcBatchProvider } from './json-rpc-batch-provider';

jest.setTimeout(100000);
describe('JsonRpcBatchProvider', () => {
  // let batchProvider: JsonRpcBatchProvider;
  let provider: JsonRpcProvider;
  let mockSend: jest.SpyInstance;
  let _mockSend: jest.SpyInstance;

  beforeEach(async () => {
    const callBack = (error: any) => {
      if (error.error.message === 'Batch size...') {
        provider = new JsonRpcProvider(
          // with new options
          'https://eth.api.onfinality.io/public',
          undefined,
          {
            batchMaxCount: 1,
          },
        );
      }
    };
    // Create a new instance of the JsonRpcBatchProvider before each test
    // batchProvider = new JsonRpcBatchProvider('http://localhost:8545');
    provider = new JsonRpcProvider(
      'https://eth.api.onfinality.io/public',
      undefined,
      { batchMaxCount: 50 },
      // callBack
    );
    mockSend = jest.spyOn(BaseJsonRpcProvider.prototype, 'send');
    _mockSend = jest.spyOn(BaseJsonRpcProvider.prototype, '_send');
  });

  afterEach(() => {
    provider.destroy();
  });

  it('Ensure chainId request is cached', async () => {
    // On first request is made on _detectNetwork, when initializing
    await provider._start();
    await provider.send('eth_chainId', []);

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith('eth_chainId', expect.anything());
  });
  it('adjustBatchSize properly adjusts batch size based on success rate', async () => {
    const requestCount = 10; // greater than 25 fails test when not using implementation
    const promises = [];

    _mockSend.mockImplementation(
      async (payload: JsonRpcPayload | Array<JsonRpcPayload>) => {
        const payloads = Array.isArray(payload) ? payload : [payload];
        return payloads.map((p) => ({
          id: p.id,
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Batch size limit exceeded' },
        }));
      },
    );

    for (let i = 0; i < requestCount; i++) {
      const promise = provider.send('eth_getBlockByNumber', [
        '0x2dccb0c',
        true,
      ]);
      promises.push(promise);
    }
    try {
      await Promise.all(promises);
    } catch (e) {
      // const v = await provider.listeners('error')
      // console.log('listener', v)
    }

    // Mock _send to return an error
    // underscore send doesnt need to be mocked?
    // mock_Send.mockImplementation(
    //     async (payload: JsonRpcPayload | Array<JsonRpcPayload> ) => {
    //
    //     }
    // )

    /*
      _send
      // prepares the request
      // calls .send()
        // creates a promise for the call
        // pushes to payload
        // calls .#scheduleDrain()
            // which then using the payload
            // calls _send for the result
        // returns a promise
      // await the response
      // returns the resp


       */

    // await provider._start();
    // provider.send = jest.fn(() => Promise.reject(new Error('Request failed')));
    // try {
    //     await provider.send('eth_getBlockByNumber', [
    //         "0x2dccb0c",
    //         false
    //     ]);
    // } catch (e) {
    //     console.log(e)
    // }
    //
  });

  //
  // test('adjustBatchSize properly adjusts batch size based on success rate', async () => {
  //   // Mock fetchJson to return a successful response
  //   fetchJsonMock.mockImplementation(
  //     async (connection: ConnectionInfo, payload: string) => {
  //       const requests = JSON.parse(payload);
  //       return requests.map((request: any) => ({
  //         id: request.id,
  //         jsonrpc: '2.0',
  //         result: '0x1',
  //       }));
  //     },
  //   );
  //
  //   // Execute the send method multiple times to simulate successful requests
  //   const requestCount = 20;
  //   const promises = [];
  //   for (let i = 0; i < requestCount; i++) {
  //     const promise = batchProvider.send('eth_call', []);
  //     promises.push(promise);
  //   }
  //   await Promise.all(promises);
  //
  //   // Check if the batch size has increased due to the success rate
  //   expect(batchProvider['batchSize']).toBeGreaterThan(1);
  //
  //   // Now, mock fetchJson to return an error response
  //   fetchJsonMock.mockImplementation(
  //     async (connection: ConnectionInfo, payload: string) => {
  //       const requests = JSON.parse(payload);
  //       return requests.map((request: any) => ({
  //         id: request.id,
  //         jsonrpc: '2.0',
  //         error: { code: -32603, message: 'Batch size limit exceeded' },
  //       }));
  //     },
  //   );
  //
  //   // Execute the send method multiple times to simulate failed requests
  //   const failedPromises = [];
  //   for (let i = 0; i < requestCount + 10; i++) {
  //     const failedPromise = batchProvider._send({
  //       id: 1,
  //       method: 'eth_call',
  //       params: [],
  //       jsonrpc: '2.0',
  //     });
  //     failedPromises.push(failedPromise);
  //   }
  //
  //   try {
  //     await Promise.all(failedPromises);
  //   } catch {
  //     // ignore error
  //   }
  //
  //   // Check if the batch size has decreased due to the failure rate
  //   expect(batchProvider['batchSize']).toBeLessThan(2);
  // });
});
