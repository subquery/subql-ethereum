// Copyright 2020-2022 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { getAddress } from '@ethersproject/address';
import { BigNumber } from '@ethersproject/bignumber';
import { Zero } from '@ethersproject/constants';
import {
  ApiWrapper,
  EthereumBlock,
  EthereumLog,
  EthereumReceipt,
  EthereumResult,
  EthereumTransaction,
} from '@subql/types-ethereum';

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

function handleNumber(value: string | number): BigNumber {
  if (value === undefined) {
    return Zero;
  }
  if (value === '0x') {
    return Zero;
  }
  return BigNumber.from(value);
}

export function formatBlock(block: Record<string, any>): EthereumBlock {
  return {
    ...block,
    difficulty: handleNumber(block.difficulty).toBigInt(),
    gasLimit: handleNumber(block.gasLimit).toBigInt(),
    gasUsed: handleNumber(block.gasUsed).toBigInt(),
    number: handleNumber(block.number).toNumber(),
    size: handleNumber(block.size).toBigInt(),
    timestamp: handleNumber(block.timestamp).toBigInt(),
    totalDifficulty: handleNumber(block.totalDifficulty).toBigInt(),
    baseFeePerGas: block.baseFeePerGas
      ? handleNumber(block.baseFeePerGas).toBigInt()
      : undefined,
    blockGasCost: block.blockGasCost
      ? handleNumber(block.blockGasCost).toBigInt()
      : undefined,
    logs: [], // Filled in at AvalancheBlockWrapped constructor
  } as EthereumBlock;
}
export function formatLog(
  log: EthereumLog<EthereumResult> | EthereumLog,
  block: EthereumBlock,
): EthereumLog<EthereumResult> | EthereumLog {
  return {
    ...log,
    address: handleAddress(log.address),
    blockNumber: handleNumber(log.blockNumber).toNumber(),
    transactionIndex: handleNumber(log.transactionIndex).toNumber(),
    logIndex: handleNumber(log.logIndex).toNumber(),
    block,
  } as EthereumLog<EthereumResult>;
}

export function formatTransaction(
  tx: Record<string, any>,
): EthereumTransaction {
  return {
    ...tx,
    from: handleAddress(tx.from),
    to: handleAddress(tx.to),
    blockNumber: handleNumber(tx.blockNumber).toNumber(),
    gas: handleNumber(tx.gas).toBigInt(),
    gasPrice: handleNumber(tx.gasPrice).toBigInt(),
    nonce: handleNumber(tx.nonce).toBigInt(),
    transactionIndex: handleNumber(tx.transactionIndex).toBigInt(),
    value: handleNumber(tx.value).toBigInt(),
    v: handleNumber(tx.v).toBigInt(),
    maxFeePerGas: tx.maxFeePerGas
      ? handleNumber(tx.maxFeePerGas).toBigInt()
      : undefined,
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas
      ? handleNumber(tx.maxPriorityFeePerGas).toBigInt()
      : undefined,
    receipt: undefined, // Filled in at AvalancheApi.fetchBlocks
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
    blockNumber: handleNumber(receipt.blockNumber).toNumber(),
    cumulativeGasUsed: handleNumber(receipt.cumulativeGasUsed).toBigInt(),
    effectiveGasPrice: handleNumber(receipt.effectiveGasPrice).toBigInt(),
    gasUsed: handleNumber(receipt.gasUsed).toBigInt(),
    logs: receipt.logs.map((log) => formatLog(log, block)),
    status: Boolean(handleNumber(receipt.status).toNumber()),
    transactionIndex: handleNumber(receipt.transactionIndex).toNumber(),
  } as EthereumReceipt;
}
