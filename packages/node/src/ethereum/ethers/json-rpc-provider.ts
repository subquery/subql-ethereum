// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import {
  FetchRequest,
  JsonRpcApiProviderOptions,
  JsonRpcProvider as BaseJsonRpcProvider,
  Networkish,
  JsonRpcPayload,
  JsonRpcResult,
} from 'ethers';

// TODO: is this still purposeful
// function getResult(payload: {
//   error?: { code?: number; data?: any; message?: string };
//   result?: any;
// }): any {
//   if (payload.error) {
//     const error: any = new Error(payload.error.message);
//     error.code = payload.error.code;
//     error.data = payload.error.data;
//     throw error;
//   }
//
//   return payload.result;
// }

export class JsonRpcProvider extends BaseJsonRpcProvider {
  private cache: Record<string, Promise<any>> = {};

  constructor(
    url?: string | FetchRequest,
    network?: Networkish,
    options?: JsonRpcApiProviderOptions,
    private callBack?: (e: any) => Promise<void> | void,
  ) {
    super(url, network, options);
  }

  // TODO need to figure out how to do the throttling
  // TODO allowGzip
  // TODO basic autherntication check // maybe there is an in-built method that can do this
  async _send(
    payload: JsonRpcPayload | Array<JsonRpcPayload>,
  ): Promise<Array<JsonRpcResult>> {
    try {
      return await super._send(payload);
    } catch (e) {
      this.callBack(e);
      throw e;
    }
  }

  async send(method, params) {
    // TODO: Unsure why eth_blockNumber is cached
    const cacheKey = ['eth_chainId'].includes(method);

    if (cacheKey && method in this.cache) {
      return this.cache[method];
    }

    if (cacheKey) {
      console.log('setting cached chainId');
      this.cache[method] = super.send(method, params);
      return this.cache[method];
    }

    return super.send(method, params);
  }
}
