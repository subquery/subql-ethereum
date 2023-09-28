// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import { EthereumBlock, LightEthereumBlock } from '@subql/types-ethereum';

export type BestBlocks = Record<number, string>;

export type BlockContent = EthereumBlock | LightEthereumBlock;
