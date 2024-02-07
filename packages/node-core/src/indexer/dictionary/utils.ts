// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import axios, {AxiosInstance} from 'axios';
import {uniq} from 'lodash';
import {DictionaryV2Metadata} from '../dictionary/v2';
import {IBlockUtil} from './types';

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
      chain: '1', //TODO, need chain for v2 meta
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

export function getBlockHeight<FB extends IBlockUtil>(block: number | FB): number {
  if (typeof block === 'number') {
    return block;
  }
  return block.getHeader().height;
}

export function mergeNumAndBlocks<FB>(
  numberBlocks: number[],
  batchBlocks: FB[],
  getBlockHeight: (b: FB) => number
): (number | FB)[] {
  let uniqueNumbers: number[] = uniq(numberBlocks);
  const getNumber = (item: FB) => (typeof item === 'number' ? item : getBlockHeight(item));
  const uniqueBObjects: FB[] = [];
  // filter out modulo blocks that already exist in fat blocks
  for (const item of batchBlocks) {
    const height = getNumber(item);
    if (!uniqueBObjects.some((b) => getNumber(b) === height)) {
      uniqueBObjects.push(item);
      uniqueNumbers = uniqueNumbers.filter((un) => un !== height);
    }
  }
  // merge and order
  const combinedArray: (number | FB)[] = [...uniqueNumbers, ...uniqueBObjects].sort((a, b) => {
    const numA = typeof a === 'number' ? a : getBlockHeight(a as FB);
    const numB = typeof b === 'number' ? b : getBlockHeight(b as FB);
    return numA - numB;
  });

  return combinedArray;
}

export function mergeNumAndBlocksToNums<FB>(
  firstBlocks: (number | FB)[],
  secondBlocks: (number | FB)[],
  getBlockHeight: (b: FB) => number
): number[] {
  const combinedArray: (number | FB)[] = [...firstBlocks, ...secondBlocks];
  const uniqueNumbersSet = new Set<number>();
  for (const item of combinedArray) {
    if (typeof item === 'number') {
      uniqueNumbersSet.add(item);
    } else {
      uniqueNumbersSet.add(getBlockHeight(item));
    }
  }
  const uniqueNumbersArray: number[] = Array.from(uniqueNumbersSet);
  const sortedArray: number[] = uniqueNumbersArray.sort((a, b) => a - b);
  return sortedArray;
}
