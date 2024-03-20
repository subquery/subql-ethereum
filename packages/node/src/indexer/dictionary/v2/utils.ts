// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { Formatter } from '@ethersproject/providers';
import { IBlock } from '@subql/node-core';
import { EthereumBlock } from '@subql/types-ethereum';
import {
  formatBlockUtil,
  formatLog,
  formatTransaction,
} from '../../../ethereum/utils.ethereum';
import { RawEthBlock } from './types';

export function rawBlockToEthBlock(block: RawEthBlock): IBlock<EthereumBlock> {
  try {
    const formatter = new Formatter();

    // Add gasLimit to each transaction from the block header
    block.transactions.map((tx) => (tx.gasLimit = block.header.gasLimit));

    const ethBlock = formatter.blockWithTransactions({
      ...block.header,
      transactions: block.transactions,
    }) as unknown as EthereumBlock;

    ethBlock.logs = Formatter.arrayOf(formatter.filterLog.bind(formatter))(
      block.logs ?? [],
    ).map((l) => formatLog(l, ethBlock));

    ethBlock.transactions = Formatter.arrayOf(
      formatter.transactionResponse.bind(formatter),
    )(block.transactions ?? []).map((tx) => ({
      ...formatTransaction(tx, ethBlock),
      logs: ethBlock.logs.filter((l) => l.transactionHash === tx.hash),
      input: tx.data, // Why is ethers renaming this to data?
    }));

    return formatBlockUtil(ethBlock);
  } catch (e) {
    throw new Error(
      `Convert raw block to Eth block failed at ${block.header.number},${e.message}`,
    );
  }
}
