// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import {
  ApiWrapper,
  EthereumBlock,
  EthereumLog,
  EthereumReceipt,
  EthereumResult,
  EthereumTransaction,
} from '@subql/types-ethereum';
import { getAddress } from 'ethers/lib.commonjs/address';
import { omit } from 'lodash';

export function calcInterval(api: ApiWrapper): number {
  // TODO find a way to get this from the blockchain
  return 6000;
}

function handleAddress(value: string): string | null {
  if (!value || value === '0x') {
    return null;
  }
  return getAddress(value);
}

function handleNumber(value: string | number): bigint {
  if (value === undefined) {
    return BigInt(0);
  }
  if (value === '0x') {
    return BigInt(0);
  }
  if (value === null) {
    return BigInt(0);
  }
  return BigInt(value);
}

export function formatBlock(block: Record<string, any>): EthereumBlock {
  return {
    ...block,
    difficulty: handleNumber(block.difficulty),
    gasLimit: handleNumber(block.gasLimit),
    gasUsed: handleNumber(block.gasUsed),
    number: Number(handleNumber(block.number)),
    size: handleNumber(block.size),
    timestamp: handleNumber(block.timestamp),
    totalDifficulty: handleNumber(block.totalDifficulty),
    baseFeePerGas: block.baseFeePerGas
      ? handleNumber(block.baseFeePerGas)
      : undefined,
    blockGasCost: block.blockGasCost
      ? handleNumber(block.blockGasCost)
      : undefined,
    logs: [], // Filled in at AvalancheBlockWrapped constructor
  } as EthereumBlock;
}

export function formatLog(
  log: Omit<
    EthereumLog<EthereumResult> | EthereumLog,
    'blockTimestamp' | 'block' | 'transaction'
  >,
  block: EthereumBlock,
): EthereumLog<EthereumResult> | EthereumLog {
  return {
    ...log,
    address: handleAddress(log.address),
    blockNumber: Number(handleNumber(log.blockNumber)),
    transactionIndex: Number(handleNumber(log.transactionIndex)),
    logIndex: Number(handleNumber(log.logIndex)),
    block,
    get transaction() {
      const rawTransaction = block.transactions?.find(
        (tx) => tx.hash === log.transactionHash,
      );
      return rawTransaction
        ? formatTransaction(rawTransaction, block)
        : undefined;
    },
    toJSON(): string {
      return JSON.stringify(omit(this, ['transaction', 'block', 'toJSON']));
    },
  } as EthereumLog<EthereumResult>;
}

export function formatTransaction(
  tx: Record<string, any>,
  block: EthereumBlock,
): EthereumTransaction {
  return {
    ...(tx as Partial<EthereumTransaction>),
    from: handleAddress(tx.from),
    to: handleAddress(tx.to),
    blockNumber: Number(handleNumber(tx.blockNumber)),
    blockTimestamp: block.timestamp,
    gas: handleNumber(tx.gas),
    gasPrice: handleNumber(tx.gasPrice),
    nonce: handleNumber(tx.nonce),
    transactionIndex: handleNumber(tx.transactionIndex),
    value: handleNumber(tx.value),
    v: handleNumber(tx.v),
    maxFeePerGas: tx.maxFeePerGas ? handleNumber(tx.maxFeePerGas) : undefined,
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas
      ? handleNumber(tx.maxPriorityFeePerGas)
      : undefined,
    receipt: undefined, // Filled in at AvalancheApi.fetchBlocks
    toJSON(): string {
      return JSON.stringify(omit(this, ['block', 'receipt', 'toJSON']));
    },
  } as EthereumTransaction;
}

export function formatReceipt(
  receipt: Record<string, any>,
  block: EthereumBlock,
): EthereumReceipt {
  return {
    ...receipt,
    from: handleAddress(receipt.from),
    to: handleAddress(receipt.to),
    blockNumber: Number(handleNumber(receipt.blockNumber)),
    cumulativeGasUsed: handleNumber(receipt.cumulativeGasUsed),
    effectiveGasPrice: handleNumber(receipt.effectiveGasPrice),
    gasUsed: handleNumber(receipt.gasUsed),
    logs: receipt.logs.map(formatLog),
    status: Boolean(handleNumber(receipt.status)),
    transactionIndex: handleNumber(receipt.transactionIndex),
    toJSON(): string {
      return JSON.stringify(omit(this, ['toJSON']));
    },
  } as unknown as EthereumReceipt;
}
