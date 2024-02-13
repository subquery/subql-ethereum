// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { Formatter } from '@ethersproject/providers';
import { IBlock } from '@subql/node-core';
import { DictionaryQueryCondition } from '@subql/types-core';
import { EthereumBlock } from '@subql/types-ethereum';
import {
  formatBlockUtil,
  formatLog,
  formatTransaction,
} from '../../../ethereum/utils.ethereum';
import {
  EthFatDictionaryLogConditions,
  EthFatDictionaryTxConditions,
  RawEthFatBlock,
} from './types';

export function entryToTxConditions(
  conditions: DictionaryQueryCondition[],
): EthFatDictionaryTxConditions {
  const filter: EthFatDictionaryTxConditions = {};
  const toArray = [];
  const fromArray = [];
  const funcArray = [];
  for (const condition of conditions) {
    if (condition.field === 'to' && condition.matcher === 'equalTo') {
      toArray.push(condition.value);
    }
    if (condition.field === 'from' && condition.matcher === 'equalTo') {
      fromArray.push(condition.value);
    }
    if (condition.field === 'func' && condition.matcher === 'equalTo') {
      funcArray.push(condition.value);
    }
  }
  if (toArray.length !== 0) {
    // @ts-ignore
    filter.to = toArray;
  }
  if (fromArray.length !== 0) {
    // @ts-ignore
    filter.from = fromArray;
  }
  if (funcArray.length !== 0) {
    // @ts-ignore
    filter.function = funcArray;
  }
  if (
    toArray.length !== 0 ||
    fromArray.length !== 0 ||
    funcArray.length !== 0
  ) {
    return filter;
  }
}

export function entryToLogConditions(
  conditions: DictionaryQueryCondition[],
): EthFatDictionaryLogConditions {
  const filter: EthFatDictionaryLogConditions = {};
  const addressArray = [];
  const topicsArray = [];
  for (const condition of conditions) {
    if (condition.field === 'address' && condition.matcher === 'equalTo') {
      addressArray.push(condition.value);
    }
    if (condition.field === 'topics0' && condition.matcher === 'equalTo') {
      topicsArray.push(condition.value);
    }
    if (condition.field === 'topics1' && condition.matcher === 'equalTo') {
      topicsArray.push(condition.value);
    }
    if (condition.field === 'topics2' && condition.matcher === 'equalTo') {
      topicsArray.push(condition.value);
    }
  }
  if (addressArray.length !== 0) {
    // @ts-ignore
    filter.address = addressArray;
  }
  if (topicsArray.length !== 0) {
    // @ts-ignore
    filter.topics0 = topicsArray;
  }
  if (addressArray.length !== 0 || topicsArray.length !== 0) {
    return filter;
  }
}

export function rawFatBlockToEthBlock(
  block: RawEthFatBlock,
): IBlock<EthereumBlock> {
  try {
    // if logs/tx returns null treat as empty array , as when format log/tx only accept array
    block.logs = block.logs === null ? [] : block.logs;
    block.transactions = block.transactions === null ? [] : block.transactions;

    const formatter = new Formatter();

    const ethBlock = formatter.block(block.header) as unknown as EthereumBlock;

    ethBlock.logs = Formatter.arrayOf(formatter.filterLog.bind(formatter))(
      block.logs,
    ).map((l) => formatLog(l, ethBlock));

    ethBlock.transactions = Formatter.arrayOf(
      formatter.transactionResponse.bind(formatter),
    )(block.transactions).map((tx) => ({
      ...formatTransaction(tx, ethBlock),
      logs: ethBlock.logs.filter((l) => l.transactionHash === tx.hash),
    }));

    return formatBlockUtil(ethBlock);
  } catch (e) {
    console.log('rawFatBlockToEthBlock failed', e);
    throw new Error(
      `Convert fat block to Eth block failed at ${block.header.number},${e.message}`,
    );
  }
}
