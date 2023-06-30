/* eslint-disable */
import { JsonRpcBatchProvider } from './json-rpc-batch-provider';

describe('JsonRpcBatchProvider', () => {
  let batchProvider: JsonRpcBatchProvider;

  beforeEach(() => {
    // Create a new instance of the JsonRpcBatchProvider before each test
    batchProvider = new JsonRpcBatchProvider('http://localhost:8545');
  });

  test('adjustBatchSize properly adjusts batch size based on success rate', async () => {
    // Mock the `runRequests` method to simulate success and failure scenarios
    const mockRunRequests = jest.spyOn(batchProvider as any, 'runRequests');
    mockRunRequests.mockImplementation(async () => {
      if (Math.random() < 0.95) {
        batchProvider['successfulBatchCount']++;
      } else {
        batchProvider['failedBatchCount']++;
      }
      batchProvider['adjustBatchSize']();
    });

    // Execute the mocked `runRequests` method the same number of times as the `batchSizeAdjustmentInterval`
    const batchSizeAdjustmentInterval = (batchProvider as any)
      .batchSizeAdjustmentInterval;
    for (let i = 0; i < batchSizeAdjustmentInterval; i++) {
      await (batchProvider as any).runRequests();
    }

    const finalBatchSize = batchProvider['batchSize'];
    const successRate =
      batchProvider['successfulBatchCount'] / batchSizeAdjustmentInterval;

    // Check if the final batch size is properly adjusted based on the success rate
    if (successRate < 0.9) {
      expect(finalBatchSize).toBeLessThanOrEqual(1); // The minimum batch size should be 1
    } else if (successRate > 0.95) {
      expect(finalBatchSize).toBeGreaterThanOrEqual(2); // The batch size should increase
    } else {
      expect(finalBatchSize).toBe(1); // The batch size should remain the same
    }
  });
});
