// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { Block } from '@ethersproject/abstract-provider';
import { Header } from '@subql/node-core';
import { BlockContent } from '../indexer/types';

export function ethereumBlockToHeader(block: BlockContent | Block): Header {
  return {
    blockHeight: block.number,
    blockHash: block.hash,
    parentHash: block.parentHash,
  };
}
