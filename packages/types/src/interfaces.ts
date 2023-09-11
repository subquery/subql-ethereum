// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import {Block} from '@ethersproject/abstract-provider';
import {
  EthereumBlock,
  EthereumBlockWrapper,
  EthereumLog,
  EthereumLogFilter,
  EthereumTransaction,
  EthereumTransactionFilter,
} from './ethereum';

export interface Entity {
  id: string;
  _name?: string;
  save?: () => Promise<void>;
}

export type FunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];

type SingleOperators = '=' | '!=';
type ArrayOperators = 'in' | '!in';
export type FieldOperators = SingleOperators | ArrayOperators;

export type FieldsExpression<T> =
  | [field: keyof T, operator: SingleOperators, value: T[keyof T]]
  | [field: keyof T, operator: ArrayOperators, value: Array<T[keyof T]>];

export interface Store {
  get(entity: string, id: string): Promise<Entity | undefined>;
  getByField(entity: string, field: string, value: any, options?: {offset?: number; limit?: number}): Promise<Entity[]>;
  getByFields<T extends Entity>(
    entity: string,
    filter: FieldsExpression<T>[],
    options?: {offset?: number; limit?: number}
  ): Promise<T[]>;
  getOneByField(entity: string, field: string, value: any): Promise<Entity | undefined>;
  set(entity: string, id: string, data: Entity): Promise<void>;
  bulkCreate(entity: string, data: Entity[]): Promise<void>;
  //if fields in provided, only specify fields will be updated
  bulkUpdate(entity: string, data: Entity[], fields?: string[]): Promise<void>;
  remove(entity: string, id: string): Promise<void>;
  bulkRemove(entity: string, ids: string[]): Promise<void>;
}

export interface BlockWrapper<
  B extends EthereumBlock = EthereumBlock,
  C extends EthereumTransaction = EthereumTransaction,
  E extends EthereumLog = EthereumLog,
  CF extends EthereumTransactionFilter = EthereumTransactionFilter,
  EF extends EthereumLogFilter = EthereumLogFilter
> {
  block: B;
  blockHeight: number;
  specVersion?: number;
  hash: string;
  calls?: (filters?: CF | CF[], ds?: any) => C[];
  transactions?: C[];
  events?: (filters?: EF | EF[], ds?: any) => E[];
  logs?: E[];
}

export interface ApiWrapper<BW extends BlockWrapper = EthereumBlockWrapper> {
  init: () => Promise<void>;
  getGenesisHash: () => string;
  getRuntimeChain: () => string;
  getChainId: () => number;
  getSpecName: () => string;
  getFinalizedBlockHeight: () => Promise<number>;
  getBestBlockHeight: () => Promise<number>;
  getBlockByHeightOrHash: (hashOrHeight: number | string) => Promise<Block>;
  fetchBlocks: (bufferBlocks: number[]) => Promise<BW[]>;
}

export type DynamicDatasourceCreator = (name: string, args: Record<string, unknown>) => Promise<void>;
