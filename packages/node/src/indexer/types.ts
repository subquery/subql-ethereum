// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { Entity } from '@subql/types-core';
import {
  EthereumBlock,
  LightEthereumBlock,
} from '@subql/types-ethereum';

export enum OperationType {
  Set = 'Set',
  Remove = 'Remove',
}

export type OperationEntity = {
  operation: OperationType;
  entityType: string;
  data: Entity | string;
};

export type BestBlocks = Record<number, string>;

export type BlockContent = EthereumBlock | LightEthereumBlock;
