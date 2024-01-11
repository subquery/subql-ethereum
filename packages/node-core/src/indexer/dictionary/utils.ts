// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import axios, {AxiosInstance} from 'axios';
import {DictionaryV2Metadata} from '../dictionary/v2';

const FAT_META_QUERY_METHOD = `subql_filterBlocksCapabilities`;

export async function subqlFilterBlocksCapabilities(
  endpoint: string,
  axiosInstance?: AxiosInstance
): Promise<DictionaryV2Metadata> {
  if (!axiosInstance) {
    axiosInstance = axios.create({
      baseURL: endpoint,
    });
  }

  const requestData = {
    jsonrpc: '2.0',
    method: FAT_META_QUERY_METHOD,
    id: 1,
  };
  try {
    const response = await axiosInstance.post(endpoint, requestData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const metadata: DictionaryV2Metadata = {
      chain: '', //TODO, need chain for v2 meta
      start: response.data.result.availableBlocks[0].startHeight,
      end: response.data.result.availableBlocks[0].endHeight,
      genesisHash: response.data.result.genesisHash,
      filters: response.data.result.filters,
      supported: response.data.result.supportedResponses,
    };
    return metadata;
  } catch (error) {
    // Handle the error as needed
    throw new Error(`Dictionary v2 get capacity failed ${error}`);
  }
}
