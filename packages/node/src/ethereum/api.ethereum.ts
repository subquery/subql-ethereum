// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import fs from 'fs';
import http from 'http';
import https from 'https';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getLogger, timeout } from '@subql/node-core';
import {
  ApiWrapper,
  EthereumBlock,
  EthereumTransaction,
  EthereumResult,
  EthereumLog,
  SubqlRuntimeDatasource,
  LightEthereumBlock,
  LightEthereumLog,
} from '@subql/types-ethereum';
import CacheableLookup from 'cacheable-lookup';
import {
  BlockTag,
  Provider,
  Block,
  hashMessage,
  Interface,
  TransactionReceipt,
  WebSocketProvider,
  JsonRpcProvider as BaseJsonRpcProvider,
  dataSlice,
  FetchRequest,
  toQuantity,
  JsonRpcApiProviderOptions,
  Network,
} from 'ethers';
import { retryOnFailEth } from '../utils/project';
import { CeloJsonRpcBatchProvider } from './ethers/celo/celo-json-rpc-batch-provider';
import { CeloJsonRpcProvider } from './ethers/celo/celo-json-rpc-provider';
import { CeloWsProvider } from './ethers/celo/celo-ws-provider';
import { JsonRpcProvider } from './ethers/json-rpc-provider';
import SafeEthProvider from './safe-api';
import {
  formatBlock,
  formatLog,
  formatReceipt,
  formatTransaction,
} from './utils.ethereum';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version: packageVersion } = require('../../package.json');

const logger = getLogger('api.ethereum');

async function loadAssets(
  ds: SubqlRuntimeDatasource,
): Promise<Record<string, string>> {
  if (!ds.assets) {
    return {};
  }
  const res: Record<string, string> = {};

  for (const [name, { file }] of Object.entries(ds.assets)) {
    try {
      res[name] = await fs.promises.readFile(file, { encoding: 'utf8' });
    } catch (e) {
      throw new Error(`Failed to load datasource asset ${file}`);
    }
  }

  return res;
}

function getHttpAgents() {
  // By default Nodejs doesn't cache DNS lookups
  // https://httptoolkit.com/blog/configuring-nodejs-dns/
  const lookup = new CacheableLookup();

  const options: http.AgentOptions = {
    keepAlive: true,
    /*, maxSockets: 100*/
  };

  const httpAgent = new http.Agent(options);
  const httpsAgent = new https.Agent(options);

  lookup.install(httpAgent);
  lookup.install(httpsAgent);

  return {
    http: httpAgent,
    https: httpsAgent,
  };
}

export class EthereumApi implements ApiWrapper {
    private client: BaseJsonRpcProvider | WebSocketProvider;

  // This is used within the sandbox when HTTP is used
  private nonBatchClient?: BaseJsonRpcProvider;
  private genesisBlock: Record<string, any>;
  private contractInterfaces: Record<string, Interface> = {};
  private chainId: number;
  private name: string;
  private isCelo: boolean = null;

  // Ethereum POS
  private supportsFinalization = true;
    // Default providerConfigs
    /*
    const defaultOptions = {
        polling: false,
        staticNetwork: null,
        batchStallTime: 10,
        batchMaxSize: (1 << 20),
        batchMaxCount: 100,
        cacheTimeout: 250,
        pollingInterval: 4000
      };
     */
  /**
   * @param {string} endpoint - The endpoint of the RPC provider
   * @param {number} blockConfirmations - Used to determine how many blocks behind the head a block is considered finalized. Not used if the network has a concrete finalization mechanism.
   * @param {object} eventEmitter - Used to monitor the number of RPC requests
   */
  constructor(
    private endpoint: string,
    private blockConfirmations: number,
    private eventEmitter: EventEmitter2,
  ) {
    const { hostname, protocol, searchParams } = new URL(endpoint);
    this.createClient();
  }

  private async createClient(options?: JsonRpcApiProviderOptions) {
    const { protocol, searchParams } = new URL(this.endpoint);
    const protocolStr = protocol.replace(':', '');

    logger.info(`Api host: ${hostname}, method: ${protocolStr}`);
    if (protocolStr === 'https' || protocolStr === 'http') {
      const connection = new FetchRequest(this.endpoint.split('?')[0]);
      connection.setHeader('User-Agent', `Subquery-Node ${packageVersion}`);
      connection.setThrottleParams({ maxAttempts: 5, slotInterval: 1 });
      connection.allowGzip = true;

      searchParams.forEach((value, name) => {
        (connection.headers as any)[name] = value;
      });

      this.client = new JsonRpcProvider(
        connection,
        undefined,
        options,
        this.handleRpcError.bind(this),
      );
      this.nonBatchClient = new JsonRpcProvider(
        connection,
        undefined,
        { batchMaxCount: 1 },
        this.handleRpcError.bind(this),
      );
    } else if (protocolStr === 'ws' || protocolStr === 'wss') {
      this.client = new WebSocketProvider(this.endpoint);
    } else {
      throw new Error(`Unsupported protocol: ${protocol}`);
    }

    // Now that we have a basic client established, check if it's for Celo

    // If the client is for Celo, reinitialize it with the specific Celo logic
    if (this.isCelo === null) {
      // Check the network's chainId only if isCelo isn't already determined.
      const network = await this.client.getNetwork();
      this.isCelo = network.chainId === BigInt(42220);
    }

    if (this.isCelo) {
      if (this.client instanceof WebSocketProvider) {
        this.client = new CeloWsProvider(this.endpoint);
      } else {
        const connectionUrl = this.client._getConnection().url;
        this.client = new CeloJsonRpcProvider(
          connectionUrl,
          undefined,
          options,
          // this.handleRpcError.bind(this)
        );
        this.nonBatchClient = new CeloJsonRpcProvider(
          connectionUrl,
          undefined,
          { batchMaxCount: 1 },
          // this.handleRpcError.bind(this)
        );
      }
    }
  }

  async init(): Promise<void> {
    this.injectClient();
    const network = await this.client.getNetwork();
    this.isCelo = network.chainId === BigInt(42220);

    try {
      const [genesisBlock, supportsFinalization, supportsSafe] =
        await Promise.all([
          this.client.getBlock('earliest'),
          this.getSupportsTag('finalized'),
          this.getSupportsTag('safe'),
        ]);

      this.genesisBlock = genesisBlock;
      this.supportsFinalization = supportsFinalization && supportsSafe;
      this.chainId = Number(network.chainId);
      this.name = network.name;
    } catch (e) {
      if ((e as Error).message.startsWith('Invalid response')) {
        this.client = this.nonBatchClient;

        logger.warn(
          `The RPC Node at ${this.endpoint} cannot process batch requests. ` +
            `Switching to non-batch mode for subsequent requests. Please consider checking if batch processing is supported on the RPC node.`,
        );

        return this.init();
      }

      throw e;
    }
  }

  private async getSupportsTag(tag: BlockTag): Promise<boolean> {
    try {
      // We set the timeout here because theres a bug in ethers where it will never resolve
      // It was happening with arbitrum on a syncing node
      const result = await timeout(this.client.getBlock(tag), 2);

      return true;
    } catch (e) {
      logger.info(`Chain doesnt support ${tag} tag`);
      return false;
    }
  }

  private injectClient(): void {
    const orig = this.client.send.bind(this.client);
    Object.defineProperty(this.client, 'send', {
      value: (...args) => {
        this.eventEmitter.emit('rpcCall');
        return orig(...args);
      },
    });
  }

  async getFinalizedBlock(): Promise<Block> {
    const height = this.supportsFinalization
      ? 'finalized'
      : (await this.getBestBlockHeight()) - this.blockConfirmations;

    const block = await this.client.getBlock(height);
    // The finalized block could sometimes fail to fetch,
    // due to some nodes on the network falling behind the synced node.
    if (!block) {
      throw new Error(`get finalized block "${height}" failed `);
    }
    return block;
  }

  async getFinalizedBlockHeight(): Promise<number> {
    return (await this.getFinalizedBlock()).number;
  }

  async getBestBlockHeight(): Promise<number> {
    const tag = this.supportsFinalization ? 'safe' : 'latest';
    return (await this.client.getBlock(tag)).number;
  }

  getRuntimeChain(): string {
    return this.name;
  }

  getChainId(): number {
    return this.chainId;
  }

  getGenesisHash(): string {
    return this.genesisBlock.hash;
  }

  getSpecName(): string {
    return 'ethereum';
  }

  async getBlockByHeightOrHash(heightOrHash: number | string): Promise<Block> {
    if (typeof heightOrHash === 'number') {
      heightOrHash = toQuantity(heightOrHash);
    }
    return this.client.getBlock(heightOrHash);
  }

  private batchSize = 500;
  private successfulBatchCount = 0;
  private failedBatchCount = 0;
  private batchSizeAdjustmentInterval = 10; // Adjust batch size after every 10 batches

  private adjustBatchSize(success: boolean) {
    success ? this.successfulBatchCount++ : this.failedBatchCount++;
    const totalBatches = this.successfulBatchCount + this.failedBatchCount;

    if (totalBatches % this.batchSizeAdjustmentInterval === 0) {
      const successRate = this.successfulBatchCount / totalBatches;

      // Adjust the batch size based on the success rate.
      if (successRate < 0.9 && this.batchSize > 1) {
        this.batchSize--;
      } else if (successRate > 0.95 && this.batchSize < 10) {
        this.batchSize++;
      }

      // Reset the counters
      this.successfulBatchCount = 0;
      this.failedBatchCount = 0;
    }
  }
  // private stashedPayloads:JsonRpcPayload[] = []

  private async handleRpcError(e: any): Promise<void> {
    // I think ethers is swallowing the error, hence it is returning SERVER_ERROR instead of Batch related errors
    //         id: p.id,
    //         jsonrpc: '2.0',
    //         error: { code: -32603, message: 'Batch size limit exceeded' },

    console.log('handle error ', e);
    if (
      e.error?.message === 'Batch size limit exceeded' ||
      e.error?.message === 'exceeded project rate limit' || // infura
      e.error?.message.includes('Failed to buffer the request body') ||
      e.error?.message.includes('Too Many Requests') ||
      e.error?.message.includes('Request Entity Too Large') ||
      e?.code === 'SERVER_ERROR' // this is hard to detect
      // error.error?.message === 'Batch size is too large' // why is this on different condition
    ) {
      // this.client.pause()
      // this.stashedPayloads.push(e.error.payload)
      console.log('recreating cilent');
      /*
      if current batch has not been re
       */
      this.adjustBatchSize(false);
      await this.createClient({ batchMaxCount: this.batchSize });
    } else {
      throw e;
    }
  }

  private async getBlockPromise(num: number, includeTx = true): Promise<any> {
    const rawBlock = await this.client.send('eth_getBlockByNumber', [
      toQuantity(num),
      includeTx,
    ]);

    if (!rawBlock) {
      throw new Error(`Failed to fetch block ${num}`);
    }

    const block = formatBlock(rawBlock);

    block.stateRoot = hashMessage(block.stateRoot);

    return block;
  }

  async getTransactionReceipt(
    transactionHash: string | Promise<string>,
  ): Promise<TransactionReceipt> {
    return retryOnFailEth<TransactionReceipt>(
      this.client.getTransactionReceipt.bind(this.client, transactionHash),
    );
  }

  async fetchBlock(blockNumber: number): Promise<EthereumBlock> {
    try {
      const block = await this.getBlockPromise(blockNumber, true);
      const logsRaw = await this.client.getLogs({ blockHash: block.hash });

      const logs = logsRaw.map((l) => formatLog(l, block));
      const transactions = block.transactions.map((tx) => ({
        ...formatTransaction(tx, block),
        receipt: () =>
          this.getTransactionReceipt(tx.hash).then((r) =>
            formatReceipt(r, block),
          ),
        logs: logs.filter((l) => l.transactionHash === tx.hash),
      }));

      const ret = {
        ...block,
        transactions,
        logs,
      };

      this.eventEmitter.emit('fetchBlock');
      return ret;
    } catch (e) {
      throw this.handleError(e);
    }
  }

  private async fetchLightBlock(
    blockNumber: number,
  ): Promise<LightEthereumBlock> {
    const block = await this.getBlockPromise(blockNumber, false);
    const logs = await this.client.getLogs({ blockHash: block.hash });

    return {
      ...block,
      logs: logs.map((l) => formatLog(l, block)),
    };
  }

  async fetchBlocks(bufferBlocks: number[]): Promise<EthereumBlock[]> {
    return Promise.all(bufferBlocks.map(async (num) => this.fetchBlock(num)));
  }

  async fetchBlocksLight(
    bufferBlocks: number[],
  ): Promise<LightEthereumBlock[]> {
    console.log('FETCH BLOCKS LIGHT');
    return Promise.all(
      bufferBlocks.map(async (num) => this.fetchLightBlock(num)),
    );
  }

  get api(): Provider {
    return this.client;
  }

  getSafeApi(blockHeight: number): SafeEthProvider {
    // We cannot use a batch http client because OnF don't support routing historical queries in batches to an archive nodes
    const client =
      this.client instanceof WebSocketProvider
        ? this.client
        : this.nonBatchClient;

    return new SafeEthProvider(client, blockHeight);
  }

  private buildInterface(
    abiName: string,
    assets: Record<string, string>,
  ): Interface | undefined {
    if (!assets[abiName]) {
      throw new Error(`ABI named "${abiName}" not referenced in assets`);
    }

    // This assumes that all datasources have a different abi name or they are the same abi
    if (!this.contractInterfaces[abiName]) {
      // Constructing the interface validates the ABI
      try {
        let abiObj = JSON.parse(assets[abiName]);

        /*
         * Allows parsing JSON artifacts as well as ABIs
         * https://trufflesuite.github.io/artifact-updates/background.html#what-are-artifacts
         */
        if (!Array.isArray(abiObj) && abiObj.abi) {
          abiObj = abiObj.abi;
        }

        this.contractInterfaces[abiName] = new Interface(abiObj);
      } catch (e) {
        logger.error(`Unable to parse ABI: ${e.message}`);
        throw new Error('ABI is invalid');
      }
    }

    return this.contractInterfaces[abiName];
  }

  async parseLog<T extends EthereumResult = EthereumResult>(
    log: EthereumLog | LightEthereumLog,
    ds: SubqlRuntimeDatasource,
  ): Promise<
    EthereumLog | LightEthereumLog | EthereumLog<T> | LightEthereumLog<T>
  > {
    try {
      if (!ds?.options?.abi) {
        logger.warn('No ABI provided for datasource');
        return log;
      }
      const iface = this.buildInterface(ds.options.abi, await loadAssets(ds));
      return {
        ...log,
        args: iface?.parseLog(log).args as unknown as T,
      };
    } catch (e) {
      logger.warn(`Failed to parse log data: ${e.message}`);
      return log;
    }
  }

  async parseTransaction<T extends EthereumResult = EthereumResult>(
    transaction: EthereumTransaction,
    ds: SubqlRuntimeDatasource,
  ): Promise<EthereumTransaction<T> | EthereumTransaction> {
    try {
      if (!ds?.options?.abi) {
        logger.warn('No ABI provided for datasource');
        return transaction;
      }
      const assets = await loadAssets(ds);
      const iface = this.buildInterface(ds.options.abi, assets);
      const func = iface.getFunction(dataSlice(transaction.input, 0, 4));
      const args = iface.decodeFunctionData(
        func,
        transaction.input,
      ) as unknown as T;

      transaction.logs =
        transaction.logs &&
        ((await Promise.all(
          transaction.logs.map(async (log) => this.parseLog(log, ds)),
        )) as Array<EthereumLog | EthereumLog<T>>);

      return {
        ...transaction,
        args,
      };
    } catch (e) {
      logger.warn(`Failed to parse transaction data: ${e.message}`);
      return transaction;
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async connect(): Promise<void> {
    logger.error('Ethereum API connect is not implemented');
    throw new Error('Not implemented');
  }

  async disconnect(): Promise<void> {
    if (this.client instanceof WebSocketProvider) {
      await this.client.destroy();
    } else {
      logger.warn('Disconnect called on HTTP provider');
    }
  }

  handleError(e: Error): Error {
    if ((e as any)?.status === 429) {
      const { hostname } = new URL(this.endpoint);
      return new Error(`Rate Limited at endpoint: ${hostname}`);
    }

    return e;
  }
}
