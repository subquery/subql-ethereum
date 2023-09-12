/* eslint-disable */
// import { deepCopy } from '@ethersproject/properties';

// import {JsonRpcApiProvider, JsonRpcProvider} from "ethers/lib.commonjs/lib.esm/providers/provider-jsonrpc";
import { FetchRequest } from 'ethers/lib.commonjs/utils';
import {
  JsonRpcApiProviderOptions,
  JsonRpcPayload,
  JsonRpcProvider as BaseJsonRpcProvider,
  JsonRpcResult,
  Networkish,
} from 'ethers/lib.commonjs/providers';
import { cloneDeep } from 'lodash';
import { ConnectionInfo, fetchJson } from './web';

function getResult(payload: {
  error?: { code?: number; data?: any; message?: string };
  result?: any;
}): any {
  if (payload.error) {
    // @TODO: not any
    const error: any = new Error(payload.error.message);
    error.code = payload.error.code;
    error.data = payload.error.data;
    throw error;
  }

  return payload.result;
}

export class JsonRpcProvider extends BaseJsonRpcProvider {
  private cache: Record<string, Promise<any>> = {};
  constructor(
    url?: string | FetchRequest,
    network?: Networkish,
    options?: JsonRpcApiProviderOptions,
  ) {
    super(url, network, options);
  }
  _send(payload: JsonRpcPayload): Promise<Array<JsonRpcResult>> {
    super.emit('debug', {
      action: 'request',
      request: cloneDeep(payload),
      provider: this,
    });

    const cacheKey = ['eth_chainId', 'eth_blockNumber'].includes(
      payload.method,
    );

    if (cacheKey && this.cache[payload.method]) {
      // unable to access cache here ?
      return this.cache[payload.method];
    }

    const result = fetchJson(
      super._getConnection(),
      JSON.stringify(payload),
      getResult,
    ).then(
      (result) => {
        super.emit('debug', {
          action: 'response',
          request: payload,
          response: result,
          provider: this,
        });

        return result;
      },
      (error) => {
        super.emit('debug', {
          action: 'response',
          error: error,
          request: payload,
          provider: this,
        });

        throw error;
      },
    );
    if (cacheKey) {
      this.cache[payload.method] = result;
      setTimeout(() => {
        this.cache[payload.method] = null;
      }, 0);
    }

    return result;
  }
}
